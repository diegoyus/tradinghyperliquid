"""
quant_deep_scanner.py
Motor Interactivo de Auditoría Cuantitativa Profunda de Hyperliquid.
Permite configurar el número de candidatos, operaciones por cuenta y saldo mínimo.
Cruza el historial on-chain a Corto, Medio y Largo Plazo y actualiza la web con fecha y hora.
"""

import json
import time
import os
import sys
import subprocess
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"
INFO_URL = "https://api.hyperliquid.xyz/info"
OUTPUT_FILE = "web/src/data/verified_traders.json"
OUTPUT_FILE_ROOT = "verified_traders.json"

IGNORED_ADDRESSES = {
    "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",  # HLP Vault
    "0x0000000000000000000000000000000000000000",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def fetch_leaderboard():
    print("\n📡 Descargando leaderboard completo de Hyperliquid...")
    # Usar curl si requests da timeout
    try:
        resp = requests.get(LEADERBOARD_URL, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            rows = data.get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows)} cuentas del exchange.")
            return rows
    except Exception:
        pass

    # Fallback con curl
    try:
        proc = subprocess.run(["curl", "-s", LEADERBOARD_URL], capture_output=True, text=True, timeout=20)
        if proc.returncode == 0 and proc.stdout:
            data = json.loads(proc.stdout)
            rows = data.get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows)} cuentas del exchange vía curl.")
            return rows
    except Exception as e:
        print(f"❌ Error descargando leaderboard: {e}")

    return []

def audit_trader_deep(address, max_fills=2000, min_balance=15000):
    addr = address.lower().strip()
    if addr in IGNORED_ADDRESSES:
        return None

    try:
        # 1. Consultar estado actual (saldo real en cuenta)
        state_resp = requests.post(INFO_URL, json={"type": "userState", "user": addr}, headers=HEADERS, timeout=10)
        if state_resp.status_code != 200:
            return None
        user_state = state_resp.json()
        account_value = float(user_state.get("marginSummary", {}).get("accountValue", 0))

        if account_value < min_balance:
            return None

        # 2. Consultar historial de órdenes (fills)
        fills_resp = requests.post(INFO_URL, json={"type": "userFills", "user": addr}, headers=HEADERS, timeout=12)
        if fills_resp.status_code != 200:
            return None
        fills = fills_resp.json()
        if not isinstance(fills, list) or len(fills) < 15:
            return None

        # Limitar al número de fills configurado por el usuario
        fills = fills[:max_fills]

        now_ms = time.time() * 1000
        ms_7d = now_ms - (7 * 24 * 3600 * 1000)
        ms_30d = now_ms - (30 * 24 * 3600 * 1000)

        closed_all = []
        closed_30d = []
        closed_7d = []
        coin_counts = {}

        for f in fills:
            pnl = float(f.get("closedPnl", 0))
            coin = f.get("coin", "N/A")
            t_ms = f.get("time", 0)

            coin_counts[coin] = coin_counts.get(coin, 0) + 1

            if pnl != 0:
                closed_all.append(pnl)
                if t_ms >= ms_30d:
                    closed_30d.append(pnl)
                if t_ms >= ms_7d:
                    closed_7d.append(pnl)

        total_closed = len(closed_all)
        if total_closed < 10:
            return None

        wins = [p for p in closed_all if p > 0]
        losses = [p for p in closed_all if p < 0]
        win_rate = (len(wins) / total_closed) * 100 if total_closed > 0 else 0
        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0)
        net_pnl = sum(closed_all)

        # Descartar cuentas perdedoras o inconsistentes
        if net_pnl <= 0 or profit_factor < 1.3 or win_rate < 65.0:
            return None

        pnl_30d = sum(closed_30d)
        wins_30d = len([p for p in closed_30d if p > 0])
        wr_30d = (wins_30d / len(closed_30d) * 100) if len(closed_30d) > 0 else win_rate

        pnl_7d = sum(closed_7d)
        wins_7d = len([p for p in closed_7d if p > 0])
        wr_7d = (wins_7d / len(closed_7d) * 100) if len(closed_7d) > 0 else win_rate

        # Calcular Drawdown Máximo Real
        peak = 10000.0
        curr = 10000.0
        max_dd_pct = 0.0
        ratio = 10000.0 / account_value if account_value > 0 else 0.1

        for p in reversed(closed_all):
            curr += p * ratio
            if curr > peak:
                peak = curr
            dd = ((peak - curr) / peak) * 100.0
            if dd > max_dd_pct:
                max_dd_pct = dd

        if max_dd_pct > 25.0:
            return None

        # PUNTUACIÓN CUANTITATIVA ESTRICTA
        score = 5.0
        if win_rate >= 90: score += 2.2
        elif win_rate >= 80: score += 1.6
        elif win_rate >= 70: score += 0.8

        if max_dd_pct <= 2.0: score += 1.5
        elif max_dd_pct <= 5.0: score += 1.0
        elif max_dd_pct <= 10.0: score += 0.4
        else: score -= 1.0

        if profit_factor >= 5.0: score += 1.0
        elif profit_factor >= 2.5: score += 0.5

        if pnl_30d > 0 and pnl_7d >= 0: score += 0.5
        if account_value >= 50000: score += 0.3

        score = round(min(max(score, 1.0), 9.9), 1)
        top_assets = [k for k, _ in sorted(coin_counts.items(), key=lambda x: x[1], reverse=True)[:3]]

        # Asignar un alias/nombre descriptivo
        alias = f"Trader {addr[:6]} ({top_assets[0] if top_assets else 'Crypto'})"

        return {
            "address": addr,
            "name": alias,
            "score": str(score),
            "accountValue": round(account_value, 2),
            "winRate": round(win_rate, 1),
            "profitFactor": round(profit_factor, 2),
            "maxDrawdownPct": round(max_dd_pct, 2),
            "totalFills": len(fills),
            "closedTradesCount": total_closed,
            "netPnlTotal": round(net_pnl, 2),
            "monthPnl": round(pnl_30d, 2),
            "monthRoi": round((pnl_30d / account_value * 100) if account_value > 0 else 30.0, 1),
            "allTimeRoi": round((net_pnl / account_value * 100) if account_value > 0 else 150.0, 1),
            "monthWinRate": round(wr_30d, 1),
            "weekPnl": round(pnl_7d, 2),
            "weekWinRate": round(wr_7d, 1),
            "topAssets": ", ".join(top_assets),
            "strategy": f"Operativa consistente en {', '.join(top_assets)}. Ratio B/P {profit_factor:.1f}x.",
        }
    except Exception:
        return None

def main():
    print("=" * 65)
    print("  🧠 MOTOR CUANTITATIVO DE AUDITORÍA ON-CHAIN DE HYPERLIQUID")
    print("=" * 65)

    # Configuración interactiva o por defecto
    try:
        cand_input = input("\n👉 ¿Cuántos candidatos del leaderboard quieres analizar? [Por defecto: 100]: ").strip()
        max_candidates = int(cand_input) if cand_input else 100
    except ValueError:
        max_candidates = 100

    try:
        fills_input = input("👉 ¿Cuántas operaciones (fills) históricas por trader analizar? [Por defecto: 2000]: ").strip()
        max_fills = int(fills_input) if fills_input else 2000
    except ValueError:
        max_fills = 2000

    try:
        bal_input = input("👉 ¿Saldo mínimo en cuenta en USD? [Por defecto: 15000]: ").strip()
        min_balance = float(bal_input) if bal_input else 15000.0
    except ValueError:
        min_balance = 15000.0

    print(f"\n⚙️ Configuración seleccionada:")
    print(f"   • Candidatos a evaluar: {max_candidates}")
    print(f"   • Operaciones por trader: hasta {max_fills}")
    print(f"   • Saldo mínimo: ${min_balance:,.0f} USD")

    rows = fetch_leaderboard()
    if not rows:
        print("❌ No se pudo obtener el leaderboard.")
        return

    candidates = []
    for r in rows:
        addr = r.get("ethAddress")
        val = float(r.get("accountValue", 0))
        if addr and val >= min_balance and addr.lower() not in IGNORED_ADDRESSES:
            candidates.append(addr)
            if len(candidates) >= max_candidates:
                break

    print(f"\n🔍 Auditando a fondo {len(candidates)} carteras seleccionadas...")
    start_time = time.time()
    verified = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(audit_trader_deep, addr, max_fills, min_balance): addr for addr in candidates}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            res = future.result()
            if res:
                verified.append(res)
                print(f"  ⭐ [{completed}/{len(candidates)}] Verificado: {res['address'][:10]}... | Nota: {res['score']}/10 | WR: {res['winRate']}% | DD: -{res['maxDrawdownPct']}% | PnL: +${res['netPnlTotal']:,.0f}")
            else:
                if completed % 10 == 0:
                    print(f"  ⏳ Progreso: {completed}/{len(candidates)} cuentas auditadas...")

    # Ordenar de mejor a peor
    verified.sort(key=lambda x: (float(x["score"]), x["profitFactor"], x["netPnlTotal"]), reverse=True)

    elapsed = time.time() - start_time
    timestamp_now = time.strftime("%d/%m/%Y %H:%M:%S")

    # Guardar archivo enriquecido con metadatos
    result_dataset = {
        "lastAudited": timestamp_now,
        "totalScanned": len(candidates),
        "totalVerified": len(verified),
        "config": {
            "maxCandidates": max_candidates,
            "maxFillsPerTrader": max_fills,
            "minBalanceUSD": min_balance,
        },
        "traders": verified,
    }

    os.makedirs("web/src/data", exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result_dataset, f, indent=2)

    with open(OUTPUT_FILE_ROOT, "w", encoding="utf-8") as f:
        json.dump(result_dataset, f, indent=2)

    print(f"\n🏆 ¡Auditoría Finalizada en {elapsed:.1f}s!")
    print(f"📊 {len(verified)} traders de élite superaron los filtros cuantitativos.")
    print(f"🕒 Fecha y Hora registrada: {timestamp_now}")
    print(f"💾 Guardado en: {OUTPUT_FILE}")

    # Preguntar si desea sincronizar a producción
    push_input = input("\n🚀 ¿Quieres sincronizar y publicar este nuevo ranking en tu web en producción? (S/n): ").strip().lower()
    if push_input != "n":
        print("📦 Empaquetando y subiendo a Vercel y GitHub...")
        subprocess.run(["DEVELOPER_DIR=/Library/Developer/CommandLineTools", "git", "add", "web/src/data/verified_traders.json"], shell=True)
        subprocess.run(["DEVELOPER_DIR=/Library/Developer/CommandLineTools", "git", "commit", "-m", f"Update verified quant traders ranking {timestamp_now}"], shell=True)
        subprocess.run(["DEVELOPER_DIR=/Library/Developer/CommandLineTools", "git", "push", "origin", "main"], shell=True)
        subprocess.run(["cd web && npx vercel deploy --prebuilt --prod --yes"], shell=True)
        print("🎉 ¡Ranking actualizado en tu web en vivo con la nueva fecha y hora!")

if __name__ == "__main__":
    main()
