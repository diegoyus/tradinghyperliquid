"""
inspect_trader.py
Analiza en detalle las posiciones abiertas y el historial de trading de una billetera en Hyperliquid.
"""

import sys
import datetime
from hyperliquid.info import Info
from hyperliquid.utils import constants

def format_timestamp(ts_ms: int) -> str:
    return datetime.datetime.fromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')

def inspeccionar_trader(address: str):
    print(f"\n🔍 Inspeccionando billetera: {address}")
    print("=" * 90)
    
    info = Info(constants.MAINNET_API_URL, skip_ws=True)
    
    try:
        user_state = info.user_state(address)
        margin = user_state.get("marginSummary", {})
        account_value = float(margin.get("accountValue", 0))
        total_margin_used = float(margin.get("totalMarginUsed", 0))
        
        print(f"💰 Saldo de la cuenta (Equity): ${account_value:,.2f}")
        print(f"🔒 Margen utilizado: ${total_margin_used:,.2f}")
        
        # Posiciones abiertas actuales
        positions = user_state.get("assetPositions", [])
        print(f"\n📊 Posiciones Abiertas Actualmente ({len(positions)}):")
        if not positions:
            print("   (Sin posiciones abiertas en este momento)")
        else:
            for p in positions:
                pos = p.get("position", {})
                coin = pos.get("coin", "N/A")
                szi = float(pos.get("szi", 0))
                entry_px = float(pos.get("entryPx", 0))
                pnl = float(pos.get("unrealizedPnl", 0))
                leverage = pos.get("leverage", {}).get("value", "N/A")
                side = "🟢 LONG" if szi > 0 else "🔴 SHORT"
                
                print(f"   • {coin:<6} | {side} | Tamaño: {abs(szi):<10} | Entrada: ${entry_px:<10,.2f} | PnL No Realizado: ${pnl:+,.2f} | Apalancamiento: {leverage}x")

        # Historial de últimos trades (fills)
        fills = info.user_fills(address)
        print(f"\n📜 Últimos 5 Trades Ejecutados (de {len(fills)} totales):")
        if not fills:
            print("   (Sin historial de trades reciente)")
        else:
            for fill in fills[:5]:
                fecha = format_timestamp(fill.get("time", 0))
                coin = fill.get("coin", "")
                px = float(fill.get("px", 0))
                sz = float(fill.get("sz", 0))
                side = "COMPRA (BUY)" if fill.get("side") == "B" else "VENTA (SELL)"
                dir_trade = fill.get("dir", "")
                closed_pnl = float(fill.get("closedPnl", 0))
                pnl_str = f"| PnL Cerrado: ${closed_pnl:+,.2f}" if closed_pnl != 0 else ""
                
                print(f"   • [{fecha}] {coin:<6} | {side:<12} | Dir: {dir_trade:<10} | Precio: ${px:<10,.2f} | Cantidad: {sz} {pnl_str}")

        print("=" * 90)

    except Exception as e:
        print(f"❌ Error al consultar la billetera: {e}")

if __name__ == "__main__":
    # Si se pasa una dirección por argumento, usarla. Si no, usar una por defecto del top
    target = sys.argv[1] if len(sys.argv) > 1 else "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe" # Sticky
    inspeccionar_trader(target)
