"""
multi_user_engine.py
Motor de Ejecución Multi-Usuario en Tiempo Real para Plataforma SaaS de Copy Trading en Hyperliquid.
Versión Refactorizada: Migrada a SQLite y optimizada para concurrencia.
"""

import json
import os
import time
import datetime
import requests
import logging
from typing import Dict, Any, List
from dotenv import load_dotenv
from hyperliquid.info import Info
from hyperliquid.utils import constants
import database

load_dotenv()

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("bot_engine.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

def send_telegram_alert(chat_id: str, message: str) -> bool:
    """Envía un mensaje personalizado a un usuario de Telegram usando el bot de la plataforma"""
    if not chat_id:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    try:
        res = requests.post(url, json=payload, timeout=5)
        return res.status_code == 200
    except Exception as e:
        logger.error(f"Error enviando alerta a Telegram ({chat_id}): {e}")
        return False

class MultiUserCopyEngine:
    def __init__(self):
        self.info = Info(constants.MAINNET_API_URL, skip_ws=False)
        self.leader_balances = {}
        self.last_fill_times = {}
        self.subscribed_addresses = set()

    def get_all_unique_traders(self) -> Dict[str, str]:
        """Obtiene la lista de todas las direcciones únicas seguidas por algún usuario desde la DB"""
        traders = {}
        try:
            with database.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT DISTINCT trader_address, name FROM user_traders")
                for row in cursor.fetchall():
                    traders[row['trader_address'].lower()] = row['name']
        except Exception as e:
            logger.error(f"Error obteniendo traders únicos: {e}")
        return traders

    def process_fill_for_all_users(self, leader_addr: str, fill_event: Dict[str, Any]):
        coin = fill_event.get("coin", "")
        px = float(fill_event.get("px", 0))
        leader_sz = float(fill_event.get("sz", 0))
        side = fill_event.get("side") # "B" = Buy, "A" = Sell
        dir_trade = fill_event.get("dir", "")
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        leader_balance = self.leader_balances.get(leader_addr, 50_000.0)

        logger.info(f"📡 [EVENTO DETECTADO] {leader_addr} | {coin} {dir_trade} | Px: ${px:,.2f} | Sz: {leader_sz}")

        try:
            with database.get_connection() as conn:
                cursor = conn.cursor()

                # 1. Buscar usuarios que siguen a este trader y están activos
                cursor.execute('''
                    SELECT u.user_id, u.cash_balance, u.telegram_chat_id,
                           ut.allocation_pct, ut.risk_multiplier, ut.max_leverage,
                           ut.joined_at, ut.copy_existing_positions, ut.coin_filter_mode,
                           ut.allowed_coins, ut.blocked_coins, ut.name as trader_name
                    FROM users u
                    JOIN user_traders ut ON u.user_id = ut.user_id
                    WHERE ut.trader_address = ? AND u.status = 'ACTIVE'
                ''', (leader_addr,))

                followers = cursor.fetchall()
                updated_users_count = 0

                for row in followers:
                    user_id = row['user_id']

                    # Filtros de tiempo (Copy Existing)
                    fill_time_ms = fill_event.get("time", 0)
                    joined_at = row['joined_at']
                    copy_existing = bool(row['copy_existing_positions'])
                    if not copy_existing and joined_at > 0 and fill_time_ms > 0 and fill_time_ms < joined_at:
                        continue

                    # Filtros de Moneda
                    coin_upper = coin.upper()
                    filter_mode = row['coin_filter_mode']
                    allowed = json.loads(row['allowed_coins'] or "[]")
                    blocked = json.loads(row['blocked_coins'] or "[]")

                    if filter_mode == "ALLOWLIST" and allowed and coin_upper not in [c.upper() for c in allowed]:
                        continue
                    if filter_mode == "BLOCKLIST" and blocked and coin_upper in [c.upper() for c in blocked]:
                        continue

                    # Sizing
                    alloc_pct = row['allocation_pct']
                    risk_multiplier = row['risk_multiplier']
                    max_leverage = row['max_leverage']
                    user_cash = row['cash_balance']
                    allocated_capital = user_cash * (alloc_pct / 100.0)

                    slippage_rate = 0.002
                    exec_px = px * (1.0 + slippage_rate) if side == "B" else px * (1.0 - slippage_rate)

                    ratio = (allocated_capital / leader_balance) * risk_multiplier
                    user_sz = leader_sz * ratio
                    trade_usd = user_sz * exec_px

                    # Control de Riesgo (35% max)
                    max_allowed_usd = allocated_capital * 0.35 * max_leverage
                    if trade_usd > max_allowed_usd and exec_px > 0:
                        user_sz = max_allowed_usd / exec_px
                        trade_usd = max_allowed_usd

                    pos_key = f"{coin}_{leader_addr[:6]}"

                    # Verificar posición actual en DB
                    cursor.execute("SELECT size, entry_px, side FROM positions WHERE user_id = ? AND pos_key = ?", (user_id, pos_key))
                    current_pos = cursor.fetchone()

                    # 1. Apertura / Aumento
                    if "Open" in dir_trade or current_pos is None:
                        new_side = "LONG" if side == "B" else "SHORT"
                        if current_pos is None:
                            cursor.execute('''
                                INSERT INTO positions (user_id, pos_key, trader_name, trader_addr, coin, size, entry_px, side, leverage, open_time)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (user_id, pos_key, row['trader_name'], leader_addr, coin, user_sz, exec_px, new_side, max_leverage, now_str))
                        else:
                            tot_sz = current_pos['size'] + user_sz
                            avg_px = ((current_pos['size'] * current_pos['entry_px']) + (user_sz * exec_px)) / tot_sz
                            cursor.execute("UPDATE positions SET size = ?, entry_px = ? WHERE user_id = ? AND pos_key = ?", (tot_sz, avg_px, user_id, pos_key))

                        # Notificación
                        if row['telegram_chat_id']:
                            emoji = "🟢" if new_side == "LONG" else "🔴"
                            msg = (
                                f"{emoji} <b>[NUEVA ORDEN COPIADA]</b>\n\n"
                                f"👤 <b>Trader:</b> {row['trader_name']}\n"
                                f"🪙 <b>Activo:</b> {coin}\n"
                                f"📊 <b>Posición:</b> {new_side} ({max_leverage}x)\n"
                                f"💲 <b>Precio Ejecución:</b> ${exec_px:,.2f}\n"
                                f"💵 <b>Tamaño:</b> ${trade_usd:,.2f} USD"
                            )
                            send_telegram_alert(row['telegram_chat_id'], msg)

                    # 2. Cierre
                    elif "Close" in dir_trade and current_pos is not None:
                        pos_sz = min(current_pos['size'], user_sz) if user_sz > 0 else current_pos['size']
                        entry_px = current_pos['entry_px']

                        pnl = (exec_px - entry_px) * pos_sz if current_pos['side'] == "LONG" else (entry_px - exec_px) * pos_sz
                        fee = (pos_sz * exec_px) * 0.00035
                        net_pnl = pnl - fee

                        # Actualizar saldo usuario
                        cursor.execute("UPDATE users SET cash_balance = cash_balance + ?, realized_pnl = realized_pnl + ? WHERE user_id = ?",
                                       (net_pnl, net_pnl, user_id))

                        # Actualizar stats
                        cursor.execute('''
                            UPDATE user_stats SET total_trades = total_trades + 1,
                            winning_trades = winning_trades + ? WHERE user_id = ?
                        ''', (1 if net_pnl > 0 else 0, user_id))

                        # Notificación
                        if row['telegram_chat_id']:
                            emoji = "💰" if net_pnl >= 0 else "🛑"
                            pnl_sign = f"+${net_pnl:,.2f}" if net_pnl >= 0 else f"-${abs(net_pnl):,.2f}"
                            msg = (
                                f"{emoji} <b>[POSICIÓN CERRADA]</b>\n\n"
                                f"👤 <b>Trader:</b> {row['trader_name']}\n"
                                f"🪙 <b>Activo:</b> {coin} ({current_pos['side']})\n"
                                f"📈 <b>PnL Neto:</b> <b>{pnl_sign} USD</b>\n"
                                f"💼 <b>Saldo Actual:</b> ${row['cash_balance'] + net_pnl:,.2f} USD"
                            )
                            send_telegram_alert(row['telegram_chat_id'], msg)

                        if pos_sz >= current_pos['size']:
                            cursor.execute("DELETE FROM positions WHERE user_id = ? AND pos_key = ?", (user_id, pos_key))
                        else:
                            cursor.execute("UPDATE positions SET size = size - ? WHERE user_id = ? AND pos_key = ?", (pos_sz, user_id, pos_key))

                    # Historial
                    cursor.execute('''
                        INSERT INTO trade_history (user_id, time, trader, coin, dir, px, sz, balance_after)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, now_str, row['trader_name'], coin, dir_trade, px, user_sz, row['cash_balance']))

                    updated_users_count += 1

                conn.commit()
                if updated_users_count > 0:
                    logger.info(f"✅ Se actualizaron las carteras de {updated_users_count} usuarios.")

        except Exception as e:
            logger.error(f"Error procesando fill para {leader_addr}: {e}", exc_info=True)

    def _make_callback(self, addr: str):
        def on_fill(event):
            try:
                data = event.get("data", {})
                fills = data.get("fills", [])
                for fill in fills:
                    fill_time = int(fill.get("time", 0))
                    if fill_time > self.last_fill_times.get(addr, 0):
                        self.last_fill_times[addr] = fill_time
                        self.process_fill_for_all_users(addr, fill)
            except Exception as e:
                logger.error(f"Error en callback para {addr}: {e}")
        return on_fill

    def sync_and_listen(self):
        unique_traders = self.get_all_unique_traders()

        logger.info("🚀" * 20)
        logger.info("   MOTOR SAAS MULTI-USUARIO HYPERLIQUID INICIADO")
        logger.info(f"   🎯 Traders Únicos Monitoreados: {len(unique_traders)}")
        logger.info("🚀" * 20)

        for addr, name in unique_traders.items():
            if addr not in self.subscribed_addresses:
                try:
                    state = self.info.user_state(addr)
                    val = float(state.get("marginSummary", {}).get("accountValue", 0))
                    self.leader_balances[addr] = val if val > 0 else 50_000.0
                    fills = self.info.user_fills(addr)
                    self.last_fill_times[addr] = int(fills[0].get("time", 0)) if fills else 0

                    callback = self._make_callback(addr)
                    sub_id = self.info.subscribe({"type": "userFills", "user": addr}, callback)
                    self.subscribed_addresses.add(addr)
                    logger.info(f"   🎧 Suscrito a [{name}] ({addr}) (Sub ID: {sub_id})")
                except Exception as e:
                    logger.error(f"Error suscribiendo a {addr}: {e}")

        logger.info("\n👀 Motor Multi-Usuario ejecutándose 24/7 en tiempo real...\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Deteniendo motor...")
            self.info.disconnect_websocket()

if __name__ == "__main__":
    engine = MultiUserCopyEngine()
    engine.sync_and_listen()
