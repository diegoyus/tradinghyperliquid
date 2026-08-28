"""
backtest_trader.py
Simulador / Backtester histórico para evaluar el rendimiento real de cualquier trader de Hyperliquid.
Calcula exactamente qué rentabilidad habrías obtenido replicando de forma proporcional las operaciones del líder.
"""

import sys
import datetime
from typing import Dict, Any, List
from hyperliquid.info import Info
from hyperliquid.utils import constants

def format_ts(ts_ms: int) -> str:
    return datetime.datetime.fromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d %H:%M')

def ejecutar_backtest(
    trader_address: str,
    capital_inicial: float = 10_000.0,
    risk_multiplier: float = 1.0,
    stop_loss_pct_portfolio: float = 15.0 # Pausar si cae más de 15%
):
    print("\n" + "=" * 80)
    print(f"🔬 INICIANDO BACKTEST HISTÓRICO PARA: {trader_address}")
    print(f"   💵 Capital Inicial: ${capital_inicial:,.2f} USD")
    print(f"   ⚙️ Multiplicador de Riesgo: {risk_multiplier}x")
    print(f"   🛡️ Circuito de Parada de Emergencia: -{stop_loss_pct_portfolio}% drawdown")
    print("=" * 80)
    
    info = Info(constants.MAINNET_API_URL, skip_ws=True)
    
    print("⏳ Descargando historial de operaciones públicas y balance...")
    try:
        user_state = info.user_state(trader_address)
        leader_balance = float(user_state.get("marginSummary", {}).get("accountValue", 0))
        if leader_balance <= 0:
            leader_balance = 50_000.0
        
        fills = info.user_fills(trader_address)
    except Exception as e:
        print(f"❌ Error al consultar historial: {e}")
        return

    if not fills:
        print("⚠️ Esta billetera no tiene historial de trades registrado.")
        return

    # Invertir para ordenar cronológicamente
    fills_cronologicos = list(reversed(fills))
    print(f"✅ Se analizaron {len(fills_cronologicos)} operaciones ejecutadas.")
    print(f"📅 Periodo: Desde {format_ts(fills_cronologicos[0]['time'])} hasta {format_ts(fills_cronologicos[-1]['time'])}")
    print(f"💰 Saldo de referencia del líder: ${leader_balance:,.2f} USD\n")

    balance = capital_inicial
    peak_balance = capital_inicial
    max_drawdown_usd = 0.0
    max_drawdown_pct = 0.0

    total_ganados = 0
    total_perdidos = 0
    ganancia_bruta = 0.0
    perdida_bruta = 0.0
    total_comisiones = 0.0

    for fill in fills_cronologicos:
        closed_pnl_leader = float(fill.get("closedPnl", 0))
        
        # Solo calculamos cuando hay cierre de posición o toma de beneficio/pérdida
        if closed_pnl_leader != 0:
            # Proporcionalidad: mi retorno es proporcional al PnL del líder
            ratio = (balance / leader_balance) * risk_multiplier
            mi_pnl_bruto = closed_pnl_leader * ratio
            
            # Estimación de comisiones taker (0.035% del notional replicado)
            px = float(fill.get("px", 1))
            sz = float(fill.get("sz", 0))
            mi_sz = sz * ratio
            fee = (mi_sz * px) * 0.00035
            
            mi_pnl_neto = mi_pnl_bruto - fee
            total_comisiones += fee
            balance += mi_pnl_neto

            if mi_pnl_neto > 0:
                total_ganados += 1
                ganancia_bruta += mi_pnl_neto
            else:
                total_perdidos += 1
                perdida_bruta += abs(mi_pnl_neto)

            # Cálculo de Drawdown
            if balance > peak_balance:
                peak_balance = balance
            dd_usd = peak_balance - balance
            dd_pct = (dd_usd / peak_balance * 100) if peak_balance > 0 else 0
            if dd_usd > max_drawdown_usd:
                max_drawdown_usd = dd_usd
                max_drawdown_pct = dd_pct

            # Circuit breaker
            if dd_pct >= stop_loss_pct_portfolio:
                print(f"🛑 [CIRCUIT BREAKER] Se alcanzó la caída máxima permitida (-{dd_pct:.1f}%). Deteniendo réplica.")
                break

    total_trades = total_ganados + total_perdidos
    win_rate = (total_ganados / total_trades * 100) if total_trades > 0 else 0
    pnl_neto = balance - capital_inicial
    roi_neto = (pnl_neto / capital_inicial) * 100
    profit_factor = (ganancia_bruta / perdida_bruta) if perdida_bruta > 0 else float('inf')

    print("=" * 80)
    print("📊 RESULTADOS DEL BACKTEST PROPORCIONAL:")
    print("=" * 80)
    print(f"💰 Balance Final:            ${balance:,.2f} USD")
    print(f"📈 Beneficio Neto (PnL):     ${pnl_neto:+,.2f} USD ({roi_neto:+.2f}%)")
    print(f"💸 Comisiones Totales:       ${total_comisiones:,.2f} USD")
    print(f"🎯 Trades Cerrados:          {total_trades}")
    print(f"🏆 Tasa de Acierto (WinRate):{win_rate:.1f}% (✅ {total_ganados} Ganados | ❌ {total_perdidos} Perdidos)")
    print(f"⚖️ Profit Factor:            {profit_factor:.2f}")
    print(f"📉 Peor Caída (Max Drawdown):-${max_drawdown_usd:,.2f} USD (-{max_drawdown_pct:.2f}%)")
    print("=" * 80)

    if roi_neto > 15 and max_drawdown_pct < 15:
        print("🌟 VEREDICTO: ¡TRADER DE ALTO RENDIMIENTO! Rentabilidad sólida y bajo drawdown.")
    elif roi_neto > 0:
        print("👍 VEREDICTO: RENTABLE. Buen candidato para asignarle entre 20% y 40% de cartera.")
    else:
        print("❌ VEREDICTO: NO RECOMENDADO. El trader tuvo pérdidas netas en este periodo.")
    print("=" * 80 + "\n")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe"
    ejecutar_backtest(target)
