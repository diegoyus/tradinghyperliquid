"""
telegram_notifier.py
Módulo de notificaciones en tiempo real a Telegram para el bot de Copy Trading.
100% Gratuito utilizando la API oficial de Telegram Bots.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

def is_telegram_configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)

def send_telegram_message(message: str) -> bool:
    """Envía un mensaje de texto formateado con HTML a Telegram"""
    if not is_telegram_configured():
        return False
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    
    try:
        res = requests.post(url, json=payload, timeout=5)
        return res.status_code == 200
    except Exception as e:
        print(f"⚠️ Error enviando alerta a Telegram: {e}")
        return False

def notify_trade_opened(trader_name: str, coin: str, side: str, size_usd: float, entry_px: float, leverage: int):
    emoji = "🟢" if side == "LONG" else "🔴"
    msg = (
        f"{emoji} <b>[NUEVA ORDEN COPIADA]</b>\n\n"
        f"👤 <b>Trader Líder:</b> {trader_name}\n"
        f"🪙 <b>Activo:</b> {coin}\n"
        f"📊 <b>Posición:</b> {side} ({leverage}x)\n"
        f"💲 <b>Precio Entrada:</b> ${entry_px:,.2f}\n"
        f"💵 <b>Tamaño Posición:</b> ${size_usd:,.2f} USD\n"
        f"⏰ <i>Modo Paper Trading Activo</i>"
    )
    send_telegram_message(msg)

def notify_trade_closed(trader_name: str, coin: str, side: str, pnl: float, balance_after: float):
    emoji = "💰" if pnl >= 0 else "🛑"
    pnl_sign = f"+${pnl:,.2f}" if pnl >= 0 else f"-${abs(pnl):,.2f}"
    msg = (
        f"{emoji} <b>[POSICIÓN CERRADA]</b>\n\n"
        f"👤 <b>Trader:</b> {trader_name}\n"
        f"🪙 <b>Activo:</b> {coin} ({side})\n"
        f"📈 <b>PnL Neto:</b> <b>{pnl_sign} USD</b>\n"
        f"💼 <b>Nuevo Saldo Cartera:</b> ${balance_after:,.2f} USD"
    )
    send_telegram_message(msg)

def notify_circuit_breaker(reason: str, drawdown_pct: float):
    msg = (
        f"🚨 <b>[CIRCUIT BREAKER - PARADA DE EMERGENCIA]</b>\n\n"
        f"⚠️ <b>Alerta:</b> {reason}\n"
        f"📉 <b>Drawdown actual:</b> -{drawdown_pct:.2f}%\n"
        f"🛑 <i>El bot ha pausado la réplica automática para proteger tu capital.</i>"
    )
    send_telegram_message(msg)

if __name__ == "__main__":
    if is_telegram_configured():
        print("📲 Probando conexión con Telegram...")
        ok = send_telegram_message("🤖 <b>¡Bot de Copy Trading conectado con éxito!</b>\nRecibirás alertas en tiempo real de cada operación.")
        if ok:
            print("✅ Mensaje de prueba enviado con éxito.")
        else:
            print("❌ No se pudo enviar el mensaje. Revisa tu Token y Chat ID.")
    else:
        print("ℹ️ Telegram no está configurado aún. Configúralo en el menú principal.")
