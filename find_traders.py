"""
find_traders.py
Herramienta para escanear y filtrar los mejores traders de Hyperliquid DEX.
"""

import requests
import json
from typing import List, Dict, Any

LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"

def obtener_traders() -> List[Dict[str, Any]]:
    print("⏳ Conectando con Hyperliquid y descargando ranking de traders...")
    try:
        response = requests.get(LEADERBOARD_URL, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get("leaderboardRows", [])
    except Exception as e:
        print(f"❌ Error al obtener datos del leaderboard: {e}")
        return []

def extraer_metricas(row: Dict[str, Any]) -> Dict[str, Any]:
    address = row.get("ethAddress", "")
    display_name = row.get("displayName") or "Anónimo"
    account_value = float(row.get("accountValue", 0))
    
    # Extraer rendimiento por periodos
    performances = dict(row.get("windowPerformances", []))
    
    day_perf = performances.get("day", {})
    week_perf = performances.get("week", {})
    month_perf = performances.get("month", {})
    all_time_perf = performances.get("allTime", {})
    
    return {
        "address": address,
        "name": display_name,
        "balance": account_value,
        "pnl_day": float(day_perf.get("pnl", 0)),
        "roi_day": float(day_perf.get("roi", 0)) * 100,
        "pnl_month": float(month_perf.get("pnl", 0)),
        "roi_month": float(month_perf.get("roi", 0)) * 100,
        "pnl_all_time": float(all_time_perf.get("pnl", 0)),
        "roi_all_time": float(all_time_perf.get("roi", 0)) * 100,
    }

def filtrar_mejores_traders(
    traders: List[Dict[str, Any]],
    min_balance: float = 10_000.0,
    min_roi_month: float = 5.0,
    min_roi_all_time: float = 10.0,
    top_n: int = 10
) -> List[Dict[str, Any]]:
    """
    Filtra traders que tengan:
    - Saldo mínimo en cuenta (para descartar cuentas basura o de lotería)
    - Rentabilidad positiva en el último mes
    - Rentabilidad positiva histórica
    """
    procesados = [extraer_metricas(t) for t in traders]
    
    filtrados = [
        t for t in procesados
        if t["balance"] >= min_balance
        and t["roi_month"] >= min_roi_month
        and t["roi_all_time"] >= min_roi_all_time
    ]
    
    # Ordenar por ROI del último mes descendente
    filtrados.sort(key=lambda x: x["roi_month"], reverse=True)
    return filtrados[:top_n]

def mostrar_tabla(traders: List[Dict[str, Any]]):
    if not traders:
        print("⚠️ No se encontraron traders con los criterios seleccionados.")
        return

    print("\n" + "=" * 125)
    print(f"{'#':<3} | {'Nombre / Alias':<20} | {'Saldo ($)':<12} | {'ROI Mes (%)':<12} | {'PnL Mes ($)':<14} | {'ROI Total (%)':<14} | {'Dirección Billetera':<42}")
    print("=" * 125)
    
    for i, t in enumerate(traders, 1):
        nombre = (t['name'][:18] + '..') if len(t['name']) > 20 else t['name']
        saldo_fmt = f"${t['balance']:,.0f}"
        roi_m_fmt = f"{t['roi_month']:+.1f}%"
        pnl_m_fmt = f"${t['pnl_month']:+,.0f}"
        roi_all_fmt = f"{t['roi_all_time']:+.1f}%"
        
        print(f"{i:<3} | {nombre:<20} | {saldo_fmt:<12} | {roi_m_fmt:<12} | {pnl_m_fmt:<14} | {roi_all_fmt:<14} | {t['address']:<42}")
    
    print("=" * 125)
    print("💡 Consejo: Copia cualquiera de estas direcciones (0x...) para configurar tu bot de réplica.\n")

if __name__ == "__main__":
    print("🏆 BUSCADOR DE TRADERS CONSISTENTES EN HYPERLIQUID 🏆")
    raw_data = obtener_traders()
    print(f"✅ Se analizaron {len(raw_data):,} cuentas activas.")
    
    mejores = filtrar_mejores_traders(
        raw_data,
        min_balance=25_000.0,   # Cuentas con al menos $25,000
        min_roi_month=10.0,      # Ganaron al menos +10% en el último mes
        min_roi_all_time=20.0,   # Ganaron al menos +20% en su historial
        top_n=10
    )
    
    mostrar_tabla(mejores)
