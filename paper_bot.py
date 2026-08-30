"""
paper_bot.py
Motor de Copy Trading Multi-Trader con Gestión de Riesgo Avanzada y Persistencia en SQLite.
"""

import os
import datetime
import logging
from typing import Dict, Any, List
from hyperliquid.info import Info
from hyperliquid.utils import constants
import database
from telegram_notifier import (
    notify_trade_opened,
    notify_trade_closed,
    notify_circuit_breaker,
    is_telegram_configured
)

# Configuración de Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Reglas de riesgo globales
GLOBAL_CIRCUIT_BREAKER_PCT = 15.0
MAX_POSITION_STOP_LOSS_PCT = 8.0

class PaperPortfolio:
    def __init__(self, user_id: str = "default_user"):
        self.user_id = user_id

    def get_state(self):
        """Obtiene el estado actual del usuario desde la DB"""
        user = database.get_user(self.user_id)
        if not user:
            # Crear usuario si no existe
            with database.get_connection() as conn:
                conn.execute("INSERT INTO users (user_id) VALUES (?)", (self.user_id,))
                conn.commit()
            return database.get_user(self.user_id)
        return user

    def check_circuit_breaker(self) -> bool:
        user = self.get_state()
        balance = user['cash_balance']
        peak = user['peak_balance']

        if balance > peak:
            with database.get_connection() as conn:
                conn.execute("UPDATE users SET peak_balance = ? WHERE user_id = ?", (balance, self.user_id))
                conn.commit()
            peak = balance

        drawdown_pct = ((peak - balance) / peak * 100) if peak > 0 else 0
        if drawdown_pct >= GLOBAL_CIRCUIT_BREAKER_PCT:
            if not user['circuit_breaker_triggered']:
                with database.get_connection() as conn:
                    conn.execute("UPDATE users SET circuit_breaker_triggered = 1 WHERE user_id = ?", (self.user_id,))
                    conn.commit()
                logger.warning(f"🚨 [CIRCUIT BREAKER ACTIVADO] Pérdida: -{drawdown_pct:.2f}%")
                notify_circuit_breaker(f"Pérdida acumulada superó el {GLOBAL_CIRCUIT_BREAKER_PCT}%", drawdown_pct)
            return True
        return False

    def execute_fill(self, trader_cfg: Dict[str, Any], fill_event: Dict[str, Any], leader_balance: float):
        if self.check_circuit_breaker():
            logger.info("🛑 Orden rechazada: Circuit Breaker activo.")
            return

        trader_name = trader_cfg.get("name", "Desconocido")
        trader_addr = trader_cfg["address"].lower()
        alloc_pct = float(trader_cfg.get("allocation_pct", 50.0))
        risk_multiplier = float(trader_cfg.get("risk_multiplier", 1.0))
        max_leverage = int(trader_cfg.get("max_leverage", 10))

        coin = fill_event.get("coin", "")
        px = float(fill_event.get("px", 0))
        leader_sz = float(fill_event.get("sz", 0))
        side = fill_event.get("side")
        dir_trade = fill_event.get("dir", "")
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        user = self.get_state()
        allocated_capital = user['cash_balance'] * (alloc_pct / 100.0)

        if leader_balance <= 0:
            leader_balance = 50_000.0

        ratio = (allocated_capital / leader_balance) * risk_multiplier
        my_sz = leader_sz * ratio

        trade_usd = my_sz * px
        max_allowed_usd = allocated_capital * 0.30 * max_leverage
        if trade_usd > max_allowed_usd and px > 0:
            my_sz = max_allowed_usd / px
            trade_usd = max_allowed_usd

        pos_key = f"{coin}_{trader_addr[:6]}"
        positions = database.get_positions(self.user_id)
        current_pos = next((p for p in positions if p['pos_key'] == pos_key), None)

        if "Open" in dir_trade or current_pos is None:
            new_side = "LONG" if side == "B" else "SHORT"
            if current_pos is None:
                database.upsert_position(self.user_id, pos_key, {
                    "trader_name": trader_name, "trader_addr": trader_addr, "coin": coin,
                    "size": my_sz, "entry_px": px, "side": new_side, "leverage": min(max_leverage, 10), "open_time": now_str
                })
            else:
                total_sz = current_pos['size'] + my_sz
                avg_px = ((current_pos['size'] * current_pos['entry_px']) + (my_sz * px)) / total_sz
                database.upsert_position(self.user_id, pos_key, {
                    "trader_name": trader_name, "trader_addr": trader_addr, "coin": coin,
                    "size": total_sz, "entry_px": avg_px, "side": current_pos['side'],
                    "leverage": current_pos['leverage'], "open_time": current_pos['open_time']
                })

            notify_trade_opened(trader_name, coin, new_side, trade_usd, px, min(max_leverage, 10))

        elif "Close" in dir_trade and current_pos is not None:
            pos_sz = min(current_pos['size'], my_sz) if my_sz > 0 else current_pos['size']
            entry_px = current_pos['entry_px']

            pnl = (px - entry_px) * pos_sz if current_pos['side'] == "LONG" else (entry_px - px) * pos_sz
            fee = (pos_sz * px) * 0.00035
            net_pnl = pnl - fee

            database.update_user_balance(self.user_id, net_pnl)

            # Update stats
            with database.get_connection() as conn:
                conn.execute('''
                    INSERT INTO user_stats (user_id, total_trades, winning_trades, losing_trades)
                    VALUES (?, 1, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        total_trades = total_trades + 1,
                        winning_trades = winning_trades + ?,
                        losing_trades = losing_trades + ?
                ''', (self.user_id, 1 if net_pnl > 0 else 0, 0 if net_pnl > 0 else 1,
                      1 if net_pnl > 0 else 0, 0 if net_pnl > 0 else 1))
                conn.commit()

            notify_trade_closed(trader_name, coin, current_pos['side'], net_pnl, user['cash_balance'] + net_pnl)

            if pos_sz >= current_pos['size']:
                database.delete_position(self.user_id, pos_key)
            else:
                # Update size by reading and upserting
                new_size = current_pos['size'] - pos_sz
                database.upsert_position(self.user_id, pos_key, {
                    "trader_name": trader_name, "trader_addr": trader_addr, "coin": coin,
                    "size": new_size, "entry_px": entry_px, "side": current_pos['side'],
                    "leverage": current_pos['leverage'], "open_time": current_pos['open_time']
                })

        database.add_trade_history(self.user_id, {
            "time": now_str, "trader": trader_name, "coin": coin, "dir": dir_trade,
            "px": px, "sz": my_sz, "balance_after": self.get_state()['cash_balance']
        })
        self.print_summary()

    def print_summary(self):
        user = self.get_state()
        print("\n" + "📊" * 32)
        print(f"💼 CARTERA VIRTUAL: {self.user_id}")
        print(f"   💵 Saldo Actual: ${user['cash_balance']:,.2f} USD")
        print(f"   📈 PnL Realizado: ${user['realized_pnl']:+,.2f} USD")

        with database.get_connection() as conn:
            stats = conn.execute("SELECT * FROM user_stats WHERE user_id = ?", (self.user_id,)).fetchone()
            if stats:
                wr = (stats['winning_trades'] / stats['total_trades'] * 100) if stats['total_trades'] > 0 else 0
                print(f"   🎯 Trades: {stats['total_trades']} (✅ {stats['winning_trades']} | ❌ {stats['losing_trades']}) | WR: {wr:.1f}%")

        positions = database.get_positions(self.user_id)
        if positions:
            print("\n   🟢 Posiciones Abiertas:")
            for p in positions:
                print(f"      • [{p['trader_name']}] {p['coin']} {p['side']}: {p['size']:.4f} @ ${p['entry_px']:,.2f}")
        print("📊" * 32 + "\n")

class MultiTraderCopyBot:
    def __init__(self, traders_config: List[Dict[str, Any]] = None):
        self.traders = traders_config or [] # In real app, this would come from DB
        self.portfolio = PaperPortfolio()
        self.info = Info(constants.MAINNET_API_URL, skip_ws=False)
        self.last_fill_times = {}
        self.leader_balances = {}
        self._init_leaders()

    def _init_leaders(self):
        for t in self.traders:
            addr = t["address"].lower()
            name = t.get("name", addr[:8])
            try:
                state = self.info.user_state(addr)
                val = float(state.get("marginSummary", {}).get("accountValue", 0))
                self.leader_balances[addr] = val if val > 0 else 50_000.0
                fills = self.info.user_fills(addr)
                self.last_fill_times[addr] = int(fills[0].get("time", 0)) if fills else 0
            except Exception as e:
                logger.error(f"Error cargando info de {name}: {e}")
                self.leader_balances[addr] = 50_000.0
                self.last_fill_times[addr] = 0

    def _make_callback(self, trader_cfg):
        addr = trader_cfg["address"].lower()
        def on_fill(event):
            try:
                data = event.get("data", {})
                fills = data.get("fills", [])
                for fill in fills:
                    fill_time = int(fill.get("time", 0))
                    if fill_time > self.last_fill_times.get(addr, 0):
                        self.last_fill_times[addr] = fill_time
                        self.portfolio.execute_fill(trader_cfg, fill, self.leader_balances.get(addr, 50_000.0))
            except Exception as e:
                logger.error(f"Error procesando orden de {trader_cfg.get('name')}: {e}")
        return on_fill

    def start(self):
        if not self.traders:
            logger.error("❌ No hay traders configurados.")
            return

        self.portfolio.print_summary()
        for t in self.traders:
            addr = t["address"].lower()
            callback = self._make_callback(t)
            self.info.subscribe({"type": "userFills", "user": addr}, callback)

        logger.info("👀 Bot activo operando en tiempo real... (Ctrl+C para detener)")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.info.disconnect_websocket()
