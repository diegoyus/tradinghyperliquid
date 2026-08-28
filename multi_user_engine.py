"""
multi_user_engine.py
Motor de Ejecución Multi-Usuario en Tiempo Real para Plataforma SaaS de Copy Trading en Hyperliquid.
Escucha las operaciones de todos los traders seguidos por cualquier usuario y replica las órdenes
personalizadas según el saldo y porcentaje (%) de cada cuenta.
"""

import json
import os
import time
import datetime
import requests
from typing import Dict, Any, List
from hyperliquid.info import Info
from hyperliquid.utils import constants

USERS_DB_FILE = "users_db.json"
TELEGRAM_BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI"

def load_users_db() -> Dict[str, Any]:
    if os.path.exists(USERS_DB_FILE):
        try:
            with open(USERS_DB_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error al leer {USERS_DB_FILE}: {e}")
    return {}

def save_users_db(users: Dict[str, Any]):
    with open(USERS_DB_FILE, "w") as f:
        json.dump(users, f, indent=2)

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
        print(f"⚠️ Error enviando alerta a Telegram ({chat_id}): {e}")
        return False

class MultiUserCopyEngine:
    def __init__(self):
        self.info = Info(constants.MAINNET_API_URL, skip_ws=False)
        self.leader_balances = {}
        self.last_fill_times = {}
        self.subscribed_addresses = set()

    def get_all_unique_traders(self, users: Dict[str, Any]) -> Dict[str, str]:
        """Obtiene la lista de todas las direcciones únicas seguidas por algún usuario"""
        traders = {}
        for user_id, user in users.items():
            for t in user.get("traders", []):
                addr = t["address"].lower()
                traders[addr] = t.get("name", addr[:8])
        return traders

    def process_fill_for_all_users(self, leader_addr: str, fill_event: Dict[str, Any]):
        users = load_users_db()
        coin = fill_event.get("coin", "")
        px = float(fill_event.get("px", 0))
        leader_sz = float(fill_event.get("sz", 0))
        side = fill_event.get("side") # "B" = Buy, "A" = Sell
        dir_trade = fill_event.get("dir", "")
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        leader_balance = self.leader_balances.get(leader_addr, 50_000.0)

        print("\n" + "⚡" * 35)
        print(f"📡 [EVENTO DE HYPERLIQUID DETECTADO] {now_str}")
        print(f"   👤 Trader: {leader_addr}")
        print(f"   🪙 {coin} | Acción: {dir_trade} ({'COMPRA' if side == 'B' else 'VENTA'}) | Precio: ${px:,.2f} | Tamaño: {leader_sz}")
        print("⚡" * 35)

        updated_users_count = 0

        for user_id, user in users.items():
            # Buscar si el usuario copia a este líder
            user_trader_cfg = None
            for t in user.get("traders", []):
                if t["address"].lower() == leader_addr:
                    user_trader_cfg = t
                    break

            if not user_trader_cfg:
                continue

            # Parámetros del usuario
            alloc_pct = float(user_trader_cfg.get("allocation_pct", 25.0))
            risk_multiplier = float(user_trader_cfg.get("risk_multiplier", 1.0))
            max_leverage = int(user_trader_cfg.get("max_leverage", 10))
            trader_name = user_trader_cfg.get("name", leader_addr[:8])
            
            user_cash = user.get("cash_balance", 10_000.0)
            allocated_capital = user_cash * (alloc_pct / 100.0)

            # Sizing proporcional al saldo y asignación del usuario
            ratio = (allocated_capital / leader_balance) * risk_multiplier
            user_sz = leader_sz * ratio
            trade_usd = user_sz * px

            # Control de riesgo del usuario
            max_allowed_usd = allocated_capital * 0.35 * max_leverage
            if trade_usd > max_allowed_usd and px > 0:
                user_sz = max_allowed_usd / px
                trade_usd = max_allowed_usd

            pos_key = f"{coin}_{leader_addr[:6]}"
            positions = user.setdefault("positions", {})
            current_pos = positions.get(pos_key)

            # 1. Apertura / Aumento
            if "Open" in dir_trade or current_pos is None:
                new_side = "LONG" if side == "B" else "SHORT"
                if current_pos is None:
                    positions[pos_key] = {
                        "trader_name": trader_name,
                        "trader_addr": leader_addr,
                        "coin": coin,
                        "size": user_sz,
                        "entry_px": px,
                        "side": new_side,
                        "leverage": min(max_leverage, 10),
                        "open_time": now_str
                    }
                else:
                    tot_sz = current_pos["size"] + user_sz
                    avg_px = ((current_pos["size"] * current_pos["entry_px"]) + (user_sz * px)) / tot_sz
                    current_pos["size"] = tot_sz
                    current_pos["entry_px"] = avg_px

                # Notificación Telegram al usuario si tiene Chat ID
                chat_id = user.get("telegram_chat_id")
                if chat_id:
                    emoji = "🟢" if new_side == "LONG" else "🔴"
                    msg = (
                        f"{emoji} <b>[NUEVA ORDEN COPIADA]</b>\n\n"
                        f"👤 <b>Trader:</b> {trader_name}\n"
                        f"🪙 <b>Activo:</b> {coin}\n"
                        f"📊 <b>Posición:</b> {new_side} ({min(max_leverage, 10)}x)\n"
                        f"💲 <b>Precio Entrada:</b> ${px:,.2f}\n"
                        f"💵 <b>Tamaño Virtual:</b> ${trade_usd:,.2f} USD\n"
                        f"💼 <b>Tu Asignación:</b> {alloc_pct}% de cartera"
                    )
                    send_telegram_alert(chat_id, msg)

            # 2. Cierre
            elif "Close" in dir_trade and current_pos is not None:
                pos_sz = min(current_pos["size"], user_sz) if user_sz > 0 else current_pos["size"]
                entry_px = current_pos["entry_px"]

                if current_pos["side"] == "LONG":
                    pnl = (px - entry_px) * pos_sz
                else:
                    pnl = (entry_px - px) * pos_sz

                fee = (pos_sz * px) * 0.00035
                net_pnl = pnl - fee

                user["cash_balance"] += net_pnl
                user["realized_pnl"] += net_pnl
                
                stats = user.setdefault("stats", {"total_trades": 0, "winning_trades": 0, "losing_trades": 0})
                stats["total_trades"] += 1
                if net_pnl > 0:
                    stats["winning_trades"] += 1
                else:
                    stats["losing_trades"] += 1

                # Guardar snapshot de curva de capital para la gráfica
                equity_hist = user.setdefault("equity_history", [])
                equity_hist.append({
                    "time": datetime.datetime.now().strftime("%H:%M:%S"),
                    "balance": round(user["cash_balance"], 2)
                })

                # Notificación Telegram al usuario
                chat_id = user.get("telegram_chat_id")
                if chat_id:
                    emoji = "💰" if net_pnl >= 0 else "🛑"
                    pnl_sign = f"+${net_pnl:,.2f}" if net_pnl >= 0 else f"-${abs(net_pnl):,.2f}"
                    msg = (
                        f"{emoji} <b>[POSICIÓN CERRADA]</b>\n\n"
                        f"👤 <b>Trader:</b> {trader_name}\n"
                        f"🪙 <b>Activo:</b> {coin} ({current_pos['side']})\n"
                        f"📈 <b>PnL Neto:</b> <b>{pnl_sign} USD</b>\n"
                        f"💼 <b>Nuevo Saldo Virtual:</b> ${user['cash_balance']:,.2f} USD"
                    )
                    send_telegram_alert(chat_id, msg)

                if pos_sz >= current_pos["size"]:
                    del positions[pos_key]
                else:
                    current_pos["size"] -= pos_sz

            # Registrar en historial del usuario
            user.setdefault("trade_history", []).append({
                "time": now_str,
                "trader": trader_name,
                "coin": coin,
                "dir": dir_trade,
                "px": px,
                "sz": user_sz,
                "balance_after": user["cash_balance"]
            })
            updated_users_count += 1

        if updated_users_count > 0:
            save_users_db(users)
            print(f"✅ Se actualizaron las carteras de {updated_users_count} usuarios.")

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
                print(f"❌ Error en callback para {addr}: {e}")
        return on_fill

    def sync_and_listen(self):
        users = load_users_db()
        unique_traders = self.get_all_unique_traders(users)

        print("\n" + "🚀" * 38)
        print("   MOTOR SAAS MULTI-USUARIO HYPERLIQUID INICIADO")
        print(f"   👥 Usuarios Registrados: {len(users)}")
        print(f"   🎯 Traders Únicos Monitoreados: {len(unique_traders)}")
        print(f"   🤖 Bot Token Telegram: {TELEGRAM_BOT_TOKEN[:10]}... (Activo)")
        print("🚀" * 38)

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
                    print(f"   🎧 Suscrito a [{name}] ({addr}) (Sub ID: {sub_id})")
                except Exception as e:
                    print(f"   ⚠️ Error suscribiendo a {addr}: {e}")

        print("\n👀 Motor Multi-Usuario ejecutándose 24/7 en tiempo real...\n")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Deteniendo motor...")
            self.info.disconnect_websocket()

if __name__ == "__main__":
    engine = MultiUserCopyEngine()
    engine.sync_and_listen()
