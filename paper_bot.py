"""
paper_bot.py
Motor de Copy Trading Multi-Trader con Gestión de Riesgo Avanzada, Circuit Breakers y Notificaciones Telegram.
"""

import json
import os
import time
import datetime
from typing import Dict, Any, List
from hyperliquid.info import Info
from hyperliquid.utils import constants
from telegram_notifier import (
    notify_trade_opened,
    notify_trade_closed,
    notify_circuit_breaker,
    is_telegram_configured
)

PORTFOLIO_FILE = "paper_portfolio.json"
CONFIG_FILE = "traders_config.json"
DEFAULT_INITIAL_BALANCE = 10_000.0

# Reglas de riesgo globales
GLOBAL_CIRCUIT_BREAKER_PCT = 15.0  # Si la cartera cae un 15%, detiene la réplica
MAX_POSITION_STOP_LOSS_PCT = 8.0   # Stop loss máximo independiente por posición (-8%)

def load_traders_config(filename: str = CONFIG_FILE) -> List[Dict[str, Any]]:
    if os.path.exists(filename):
        try:
            with open(filename, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error al leer {filename}: {e}")
    return []

def save_traders_config(traders: List[Dict[str, Any]], filename: str = CONFIG_FILE):
    with open(filename, "w") as f:
        json.dump(traders, f, indent=2)

class PaperPortfolio:
    def __init__(self, filename: str = PORTFOLIO_FILE, initial_balance: float = DEFAULT_INITIAL_BALANCE):
        self.filename = filename
        self.initial_balance = initial_balance
        self.data = self._load()

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.filename):
            try:
                with open(self.filename, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Error cargando cartera: {e}. Creando una nueva.")
        
        default_data = {
            "initial_balance": self.initial_balance,
            "peak_balance": self.initial_balance,
            "cash_balance": self.initial_balance,
            "realized_pnl": 0.0,
            "positions": {},
            "trade_history": [],
            "trader_stats": {},
            "circuit_breaker_triggered": False,
            "stats": {
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0
            }
        }
        self._save(default_data)
        return default_data

    def _save(self, data: Dict[str, Any] = None):
        if data is None:
            data = self.data
        with open(self.filename, "w") as f:
            json.dump(data, f, indent=2)

    def check_circuit_breaker(self) -> bool:
        """Verifica si se ha alcanzado la caída máxima permitida en la cartera"""
        balance = self.data["cash_balance"]
        peak = self.data.get("peak_balance", self.initial_balance)
        if balance > peak:
            self.data["peak_balance"] = balance
            peak = balance
            self._save()

        drawdown_pct = ((peak - balance) / peak * 100) if peak > 0 else 0
        if drawdown_pct >= GLOBAL_CIRCUIT_BREAKER_PCT:
            if not self.data.get("circuit_breaker_triggered", False):
                self.data["circuit_breaker_triggered"] = True
                self._save()
                print(f"\n🚨 [CIRCUIT BREAKER ACTIVADO] Pérdida de cartera: -{drawdown_pct:.2f}%. Pausando nuevas operaciones.")
                notify_circuit_breaker(f"Pérdida acumulada superó el {GLOBAL_CIRCUIT_BREAKER_PCT}%", drawdown_pct)
            return True
        return False

    def execute_fill(
        self,
        trader_cfg: Dict[str, Any],
        fill_event: Dict[str, Any],
        leader_balance: float
    ):
        if self.check_circuit_breaker():
            print("🛑 Orden rechazada: Circuit Breaker activo.")
            return

        trader_name = trader_cfg.get("name", "Desconocido")
        trader_addr = trader_cfg["address"].lower()
        alloc_pct = float(trader_cfg.get("allocation_pct", 50.0))
        risk_multiplier = float(trader_cfg.get("risk_multiplier", 1.0))
        max_leverage = int(trader_cfg.get("max_leverage", 10))

        coin = fill_event.get("coin", "")
        px = float(fill_event.get("px", 0))
        leader_sz = float(fill_event.get("sz", 0))
        side = fill_event.get("side") # "B" (Buy) o "A" (Sell)
        dir_trade = fill_event.get("dir", "")
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        print("\n" + "🔔" * 32)
        print(f"⚡ [NUEVA ORDEN DETECTADA] {now_str}")
        print(f"   👤 Trader: {trader_name} ({alloc_pct}% cartera asignada)")
        print(f"   🪙 Activo: {coin} | Acción: {dir_trade} ({'COMPRA' if side == 'B' else 'VENTA'})")
        print(f"   💲 Precio: ${px:,.2f} | Cantidad líder: {leader_sz}")
        print("🔔" * 32)

        total_balance = self.data["cash_balance"]
        allocated_capital = total_balance * (alloc_pct / 100.0)

        if leader_balance <= 0:
            leader_balance = 50_000.0

        # Sizing proporcional
        ratio = (allocated_capital / leader_balance) * risk_multiplier
        my_sz = leader_sz * ratio

        # Regla de riesgo: Máximo 30% del capital asignado
        trade_usd = my_sz * px
        max_allowed_usd = allocated_capital * 0.30 * max_leverage
        if trade_usd > max_allowed_usd and px > 0:
            my_sz = max_allowed_usd / px
            trade_usd = max_allowed_usd
            print(f"⚠️ Sizing ajustado por control de riesgo a {my_sz:.4f} {coin} (${trade_usd:,.2f} USD)")

        pos_key = f"{coin}_{trader_addr[:6]}"
        current_pos = self.data["positions"].get(pos_key)

        if trader_name not in self.data.setdefault("trader_stats", {}):
            self.data["trader_stats"][trader_name] = {"pnl": 0.0, "trades": 0, "wins": 0, "losses": 0}

        # 1. Apertura / Aumento
        if "Open" in dir_trade or current_pos is None:
            new_side = "LONG" if side == "B" else "SHORT"
            if current_pos is None:
                self.data["positions"][pos_key] = {
                    "trader_name": trader_name,
                    "trader_addr": trader_addr,
                    "coin": coin,
                    "size": my_sz,
                    "entry_px": px,
                    "side": new_side,
                    "leverage": min(max_leverage, 10),
                    "open_time": now_str
                }
            else:
                total_sz = current_pos["size"] + my_sz
                avg_px = ((current_pos["size"] * current_pos["entry_px"]) + (my_sz * px)) / total_sz
                current_pos["size"] = total_sz
                current_pos["entry_px"] = avg_px

            print(f"✅ [SIMULACIÓN: POSICIÓN ABIERTA] {coin} {new_side} (Copiando a {trader_name})")
            print(f"   Tamaño virtual: {my_sz:.4f} {coin} (${trade_usd:,.2f} USD) | Entrada: ${px:,.2f}")
            
            # Notificación Telegram
            notify_trade_opened(
                trader_name=trader_name,
                coin=coin,
                side=new_side,
                size_usd=trade_usd,
                entry_px=px,
                leverage=min(max_leverage, 10)
            )

        # 2. Cierre
        elif "Close" in dir_trade and current_pos is not None:
            pos_sz = min(current_pos["size"], my_sz) if my_sz > 0 else current_pos["size"]
            entry_px = current_pos["entry_px"]

            if current_pos["side"] == "LONG":
                pnl = (px - entry_px) * pos_sz
            else:
                pnl = (entry_px - px) * pos_sz

            fee = (pos_sz * px) * 0.00035
            net_pnl = pnl - fee

            self.data["cash_balance"] += net_pnl
            self.data["realized_pnl"] += net_pnl
            self.data["stats"]["total_trades"] += 1
            
            t_stats = self.data["trader_stats"][trader_name]
            t_stats["trades"] += 1
            t_stats["pnl"] += net_pnl

            if net_pnl > 0:
                self.data["stats"]["winning_trades"] += 1
                t_stats["wins"] += 1
            else:
                self.data["stats"]["losing_trades"] += 1
                t_stats["losses"] += 1

            print(f"🏁 [SIMULACIÓN: POSICIÓN CERRADA] {coin} {current_pos['side']} ({trader_name})")
            print(f"   Entrada: ${entry_px:,.2f} -> Salida: ${px:,.2f}")
            print(f"   PnL Neto: ${net_pnl:+,.2f} USD (Comisión: ${fee:.2f})")

            # Notificación Telegram
            notify_trade_closed(
                trader_name=trader_name,
                coin=coin,
                side=current_pos["side"],
                pnl=net_pnl,
                balance_after=self.data["cash_balance"]
            )

            if pos_sz >= current_pos["size"]:
                del self.data["positions"][pos_key]
            else:
                current_pos["size"] -= pos_sz

        self.data["trade_history"].append({
            "time": now_str,
            "trader": trader_name,
            "coin": coin,
            "dir": dir_trade,
            "px": px,
            "sz": my_sz,
            "balance_after": self.data["cash_balance"]
        })
        self._save()
        self.print_summary()

    def print_summary(self):
        print("\n" + "📊" * 32)
        print("💼 ESTADO DE TU CARTERA VIRTUAL (PAPER TRADING):")
        print(f"   💵 Saldo Actual: ${self.data['cash_balance']:,.2f} USD (Inicial: ${self.data['initial_balance']:,.2f})")
        print(f"   📈 PnL Total Realizado: ${self.data['realized_pnl']:+,.2f} USD")
        print(f"   🎯 Total Trades: {self.data['stats']['total_trades']} (✅ {self.data['stats']['winning_trades']} Ganados | ❌ {self.data['stats']['losing_trades']} Perdidos)")
        
        t_stats = self.data.get("trader_stats", {})
        if t_stats:
            print("\n   👥 Rendimiento por Trader Copiado:")
            for name, st in t_stats.items():
                win_rate = (st['wins'] / st['trades'] * 100) if st['trades'] > 0 else 0
                print(f"      • {name:<18} | PnL: ${st['pnl']:+,.2f} | Trades: {st['trades']} | WinRate: {win_rate:.1f}%")

        positions = self.data.get("positions", {})
        if positions:
            print("\n   🟢 Posiciones Abiertas:")
            for k, pos in positions.items():
                print(f"      • [{pos.get('trader_name', 'Líder')}] {pos['coin']} {pos['side']}: {pos['size']:.4f} @ ${pos['entry_px']:,.2f}")
        else:
            print("\n   ⚪ Sin posiciones abiertas en este momento.")
        print("📊" * 32 + "\n")


class MultiTraderCopyBot:
    def __init__(self, traders_config: List[Dict[str, Any]] = None):
        self.traders = traders_config or load_traders_config()
        self.portfolio = PaperPortfolio()
        self.info = Info(constants.MAINNET_API_URL, skip_ws=False)
        self.last_fill_times = {}
        self.leader_balances = {}
        self._init_leaders()

    def _init_leaders(self):
        print("\n🔍 Inicializando datos de los traders configurados...")
        for t in self.traders:
            addr = t["address"].lower()
            name = t.get("name", addr[:8])
            try:
                state = self.info.user_state(addr)
                account_val = float(state.get("marginSummary", {}).get("accountValue", 0))
                self.leader_balances[addr] = account_val if account_val > 0 else 50_000.0
                
                fills = self.info.user_fills(addr)
                if fills:
                    self.last_fill_times[addr] = int(fills[0].get("time", 0))
                else:
                    self.last_fill_times[addr] = 0
                print(f"   ✅ {name:<20} | Saldo: ${self.leader_balances[addr]:,.2f} | Asignación: {t.get('allocation_pct', 0)}%")
            except Exception as e:
                print(f"   ⚠️ Error cargando info de {name}: {e}")
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
                        self.portfolio.execute_fill(
                            trader_cfg=trader_cfg,
                            fill_event=fill,
                            leader_balance=self.leader_balances.get(addr, 50_000.0)
                        )
            except Exception as e:
                print(f"❌ Error procesando orden de {trader_cfg.get('name')}: {e}")
        return on_fill

    def start(self):
        if not self.traders:
            print("❌ No hay traders configurados para copiar.")
            return

        total_alloc = sum(t.get("allocation_pct", 0) for t in self.traders)
        tg_status = "✅ Activadas" if is_telegram_configured() else "⚪ No configuradas (Opcional)"
        
        print("\n" + "🚀" * 35)
        print("   INICIANDO BOT DE COPY TRADING MULTI-TRADER")
        print(f"   👥 Total Traders Seguidos: {len(self.traders)} (Asignación: {total_alloc}%)")
        print(f"   🛡️ Protección Circuit Breaker: -{GLOBAL_CIRCUIT_BREAKER_PCT}%")
        print(f"   📲 Alertas Telegram: {tg_status}")
        print("🚀" * 35)

        self.portfolio.print_summary()

        print("📡 Conectando WebSockets en tiempo real...")
        for t in self.traders:
            addr = t["address"].lower()
            callback = self._make_callback(t)
            sub_id = self.info.subscribe({"type": "userFills", "user": addr}, callback)
            print(f"   🎧 Escuchando a [{t.get('name')}] (Sub ID: {sub_id})")

        print("\n👀 Bot activo operando 24/7 en tiempo real... (Presiona Ctrl+C para detener)\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Deteniendo bot y desconectando WebSockets...")
            self.info.disconnect_websocket()
            print("👋 Bot detenido de forma segura.")

if __name__ == "__main__":
    bot = MultiTraderCopyBot()
    bot.start()
