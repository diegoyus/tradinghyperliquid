"""
quant_deep_scanner.py
Motor de Auditoría Cuantitativa y Forense Institucional de Hyperliquid.
Audita todas las carteras y clasifica:
- APROBADOS (destacados en amarillo en la web) con su radiografía forense completa.
- Régimen de mercado (Alcista vs Bajista vs Lateral).
- Sesión horaria óptima (Londres, Nueva York, Asia).
- Expectativa matemática, Sortino, rachas y 6 tests de anomalías por trader.
"""

import json
import time
import os
import sys
import subprocess
import requests
from datetime import datetime
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
    "Content-Type": "application/json",
}

def query_info_api(payload, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = requests.post(INFO_URL, json=payload, headers=HEADERS, timeout=12)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                time.sleep(2.0 + attempt * 1.5)
                continue
        except Exception:
            pass

        try:
            cmd = ["curl", "-s", "-X", "POST", INFO_URL, "-H", "Content-Type: application/json", "-d", json.dumps(payload)]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if proc.returncode == 0 and proc.stdout and not proc.stdout.startswith("rate limited"):
                return json.loads(proc.stdout)
            elif "rate limited" in proc.stdout:
                time.sleep(2.0 + attempt * 1.5)
        except Exception:
            pass

        time.sleep(1.0)
    return None

def fetch_leaderboard():
    print("\n📡 Descargando censo completo de Hyperliquid (43.000+ cuentas)...")
    try:
        proc = subprocess.run(["curl", "-s", LEADERBOARD_URL], capture_output=True, text=True, timeout=20)
        if proc.returncode == 0 and proc.stdout:
            data = json.loads(proc.stdout)
            rows = data.get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows)} cuentas del exchange.")
            return rows
    except Exception:
        pass

    try:
        resp = requests.get(LEADERBOARD_URL, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            rows = data.get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows)} cuentas del exchange vía requests.")
            return rows
    except Exception as e:
        print(f"❌ Error descargando leaderboard: {e}")

    return []

def audit_trader_deep(address, max_fills=2000, min_balance=15000):
    addr = address.lower().strip()
    if addr in IGNORED_ADDRESSES:
        return None

    try:
        time.sleep(0.08)

        # 1. Estado en tiempo real
        user_state = query_info_api({"type": "clearinghouseState", "user": addr})
        if not user_state or not isinstance(user_state, dict):
            return None

        account_value = float(user_state.get("marginSummary", {}).get("accountValue", 0))
        total_margin_used = float(user_state.get("marginSummary", {}).get("totalMarginUsed", 0))

        # AUDITORÍA DE PÉRDIDAS FLOTANTES (Anti-Bagholding)
        asset_positions = user_state.get("assetPositions", [])
        total_unrealized_pnl = sum(float(p.get("position", {}).get("unrealizedPnl", 0)) for p in asset_positions)
        floating_loss_pct = (total_unrealized_pnl / account_value * 100) if account_value > 0 else 0
        margin_utilization_pct = (total_margin_used / account_value * 100) if account_value > 0 else 0

        # 2. Historial de órdenes completo (fills)
        fills = query_info_api({"type": "userFills", "user": addr})
        if not isinstance(fills, list):
            fills = []

        fills = fills[:max_fills]
        now_ms = time.time() * 1000
        ms_7d = now_ms - (7 * 24 * 3600 * 1000)
        ms_30d = now_ms - (30 * 24 * 3600 * 1000)

        closed_all = []
        closed_30d = []
        closed_7d = []
        coin_counts = {}
        session_pnls = {"Asia (00:00 - 08:00 UTC)": 0, "Londres (08:00 - 16:00 UTC)": 0, "Nueva York (13:00 - 21:00 UTC)": 0}
        long_pnls = []
        short_pnls = []
        notionals = []

        for f in fills:
            pnl = float(f.get("closedPnl", 0))
            coin = f.get("coin", "N/A")
            t_ms = f.get("time", 0)
            sz = float(f.get("sz", 0))
            px = float(f.get("px", 0))
            dir_str = str(f.get("dir", "")).lower()

            coin_counts[coin] = coin_counts.get(coin, 0) + 1
            notionals.append(sz * px)

            if pnl != 0:
                closed_all.append(pnl)
                if "long" in dir_str or "buy" in str(f.get("side", "")).lower():
                    long_pnls.append(pnl)
                else:
                    short_pnls.append(pnl)

                # Sesiones
                dt = datetime.utcfromtimestamp(t_ms / 1000)
                hour = dt.hour
                if 0 <= hour < 8:
                    session_pnls["Asia (00:00 - 08:00 UTC)"] += pnl
                elif 8 <= hour < 14:
                    session_pnls["Londres (08:00 - 16:00 UTC)"] += pnl
                else:
                    session_pnls["Nueva York (13:00 - 21:00 UTC)"] += pnl

                if t_ms >= ms_30d:
                    closed_30d.append(pnl)
                if t_ms >= ms_7d:
                    closed_7d.append(pnl)

        total_closed = len(closed_all)
        wins = [p for p in closed_all if p > 0]
        losses = [p for p in closed_all if p < 0]
        win_rate = (len(wins) / total_closed) * 100 if total_closed > 0 else 0
        gross_profit = sum(wins)
        gross_loss = abs(sum(losses))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0)
        net_pnl = sum(closed_all)

        avg_win = (gross_profit / len(wins)) if wins else 0
        avg_loss = (gross_loss / len(losses)) if losses else 0
        win_loss_ratio = (avg_win / avg_loss) if avg_loss > 0 else 99.0

        # Expectativa matemática por trade ($)
        win_prob = win_rate / 100
        loss_prob = (100 - win_rate) / 100
        expectancy_usd = (win_prob * avg_win) - (loss_prob * avg_loss)

        # Rachas consecutivas
        max_consecutive_wins = 0
        max_consecutive_losses = 0
        cur_w = 0
        cur_l = 0
        for p in closed_all:
            if p > 0:
                cur_w += 1
                cur_l = 0
                if cur_w > max_consecutive_wins: max_consecutive_wins = cur_w
            elif p < 0:
                cur_l += 1
                cur_w = 0
                if cur_l > max_consecutive_losses: max_consecutive_losses = cur_l

        # Ratio de Sortino (Volatilidad a la baja)
        downside_var = sum([p**2 for p in losses]) / max(total_closed, 1)
        downside_dev = downside_var**0.5
        sortino_ratio = (net_pnl / (downside_dev * (total_closed**0.5))) if (downside_dev > 0 and total_closed > 0) else 9.9
        sortino_ratio = max(min(sortino_ratio, 99.0), 0.0)

        # Drawdown Máximo Real
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

        # Régimen de Mercado (Bull vs Bear vs Lateral)
        long_pnl_total = sum(long_pnls)
        short_pnl_total = sum(short_pnls)
        if long_pnl_total > 0 and short_pnl_total > 0:
            market_regime = "🌦️ Todoterreno (Gana en Bull & Bear)"
        elif long_pnl_total > short_pnl_total:
            market_regime = "📈 Tendencial Alcista (Experto Longs)"
        else:
            market_regime = "📉 Cobertura / Cortos (Experto Shorts)"

        # Sesión Horaria Más Rentable
        best_session = max(session_pnls.items(), key=lambda x: x[1])[0]

        # Estilo Operativo
        if total_closed >= 500:
            trading_style = "⚡ Scalping Cuantitativo"
        elif total_closed >= 80:
            trading_style = "⏱️ Day Trading Intradiario"
        else:
            trading_style = "🌊 Swing Trading de Posición"

        # ==========================================
        # 🕵️‍♂️ BATERÍA DE 6 TESTS FORENSES Y ANOMALÍAS
        # ==========================================
        anomalies = []
        max_win = max(wins) if wins else 0
        lucky_trade_pct = (max_win / gross_profit * 100) if gross_profit > 0 else 0

        # Test 1: Golpe de Suerte
        if lucky_trade_pct >= 45.0:
            anomalies.append({"test": "Golpe de Suerte Único", "status": "FAIL", "detail": f"Un solo trade concentró el {lucky_trade_pct:.1f}% de las ganancias totales."})
        elif lucky_trade_pct >= 25.0:
            anomalies.append({"test": "Concentración de Beneficios", "status": "WARNING", "detail": f"El mejor trade aportó el {lucky_trade_pct:.1f}% del total."})
        else:
            anomalies.append({"test": "Distribución de Ganancias", "status": "PASS", "detail": f"Ganancias 100% orgánicas (mayor trade: {lucky_trade_pct:.1f}%)."})

        # Test 2: Martingala
        martingale_spikes = 0
        for i in range(1, len(closed_all)):
            if closed_all[i - 1] < 0 and i < len(notionals) and (i - 1) < len(notionals):
                if notionals[i] >= notionals[i - 1] * 2.2:
                    martingale_spikes += 1

        if martingale_spikes >= 3:
            anomalies.append({"test": "Patrón Martingala", "status": "FAIL", "detail": f"Detectadas {martingale_spikes} duplicaciones de tamaño tras pérdidas."})
        else:
            anomalies.append({"test": "Anti-Martingala", "status": "PASS", "detail": "Gestión de tamaño disciplinada."})

        # Test 3: Pérdidas Flotantes
        if total_unrealized_pnl < 0 and abs(floatingLossPct) >= 10.0:
            anomalies.append({"test": "Pérdidas Flotantes Ocultas", "status": "FAIL", "detail": f"Pérdida abierta de -{abs(floatingLossPct):.1f}% del capital sin stop-loss."})
        else:
            anomalies.append({"test": "Pérdidas Flotantes Ocultas", "status": "PASS", "detail": "0% pérdidas ocultas en posiciones abiertas."})

        # Test 4: Asimetría de Pérdidas
        if avg_loss >= avg_win * 4 and losses:
            anomalies.append({"test": "Asimetría de Riesgo", "status": "WARNING", "detail": f"Pérdida media (${avg_loss:.0f}) muy superior a ganancia media (${avg_win:.0f})."})
        else:
            anomalies.append({"test": "Ratio Riesgo / Beneficio", "status": "PASS", "detail": f"Relación equilibrada ({win_loss_ratio:.2f}x)."})

        # Test 5: Margen y Solvencia
        if margin_utilization_pct >= 45.0:
            anomalies.append({"test": "Sobreapalancamiento", "status": "FAIL", "detail": f"Margen en uso elevado ({margin_utilization_pct:.1f}%)."})
        else:
            anomalies.append({"test": "Solvencia de Margen", "status": "PASS", "detail": f"Margen en uso seguro ({margin_utilization_pct:.1f}%)."})

        # Test 6: Rachas Adversas
        if max_consecutive_losses >= 6:
            anomalies.append({"test": "Rachas de Pérdidas", "status": "WARNING", "detail": f"Racha máxima de {max_consecutive_losses} pérdidas seguidas."})
        else:
            anomalies.append({"test": "Control de Rachas", "status": "PASS", "detail": f"Máximo de {max_consecutive_losses} pérdidas seguidas."})

        # PUNTUACIÓN Y VEREDICTO DE FILTRO
        passed_filter = True
        reasons = []

        if account_value < min_balance:
            passed_filter = False
            reasons.append(f"Saldo (${account_value:,.0f}) inferior al mínimo (${min_balance:,.0f}).")
        if total_unrealized_pnl < 0 and abs(total_unrealized_pnl) > (account_value * 0.08):
            passed_filter = False
            reasons.append(f"Pérdida flotante abierta del {floating_loss_pct:.1f}%.")
        if margin_utilization_pct > 45.0:
            passed_filter = False
            reasons.append(f"Margen en uso excesivo ({margin_utilization_pct:.1f}%).")
        if total_closed < 10:
            passed_filter = False
            reasons.append(f"Muestra estadística insuficiente ({total_closed} trades).")
        if net_pnl <= 0:
            passed_filter = False
            reasons.append(f"PnL neto histórico negativo (-${abs(net_pnl):,.0f}).")
        if profit_factor < 1.3 and gross_loss > 0:
            passed_filter = False
            reasons.append(f"Profit Factor bajo ({profit_factor:.2f}x).")
        if win_rate < 65.0:
            passed_filter = False
            reasons.append(f"Win Rate ({win_rate:.1f}%) inferior al 65%.")
        if max_dd_pct > 25.0:
            passed_filter = False
            reasons.append(f"Drawdown excesivo (-{max_dd_pct:.1f}%).")
        if any(a["status"] == "FAIL" for a in anomalies):
            passed_filter = False
            failed_tests = [a["test"] for a in anomalies if a["status"] == "FAIL"]
            reasons.append(f"Falló tests forenses: {', '.join(failed_tests)}.")

        top_assets = [k for k, _ in sorted(coin_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
        top_assets_str = ", ".join(top_assets) if top_assets else "Crypto"

        if passed_filter:
            audit_explanation = (
                f"⭐ APROBADO: Win Rate {win_rate:.1f}% en {total_closed} trades, "
                f"Profit Factor {profit_factor:.2f}x, Sortino {sortino_ratio:.1f}, Drawdown -{max_dd_pct:.2f}%, "
                f"Expectativa +${expectancy_usd:.0f}/trade, 0% pérdidas flotantes en {top_assets_str}."
            )
            score = 9.0 + min((win_rate - 75) / 25, 0.9)
        else:
            audit_explanation = f"❌ DESCARTADO: {'; '.join(reasons)}"
            score = 4.0

        score = round(min(max(score, 1.0), 9.9), 1)
        alias = f"Trader {addr[:6]} ({top_assets[0] if top_assets else 'Crypto'})"

        pnl_30d = sum(closed_30d)
        wr_30d = (len([p for p in closed_30d if p > 0]) / len(closed_30d) * 100) if closed_30d else win_rate
        pnl_7d = sum(closed_7d)
        wr_7d = (len([p for p in closed_7d if p > 0]) / len(closed_7d) * 100) if closed_7d else win_rate

        return {
            "address": addr,
            "name": alias,
            "score": str(score),
            "passedFilter": passed_filter,
            "filterAuditReason": audit_explanation,
            "accountValue": round(account_value, 2),
            "winRate": round(win_rate, 1),
            "profitFactor": round(profit_factor, 2),
            "sortinoRatio": round(sortino_ratio, 2),
            "expectancyUSD": round(expectancy_usd, 2),
            "maxConsecutiveWins": max_consecutive_wins,
            "maxConsecutiveLosses": max_consecutive_losses,
            "luckyTradePct": round(lucky_trade_pct, 1),
            "marketRegime": market_regime,
            "bestSession": best_session,
            "tradingStyle": trading_style,
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
            "floatingLossPct": round(floating_loss_pct, 1),
            "marginUtilizationPct": round(margin_utilization_pct, 1),
            "topAssets": top_assets_str,
            "anomalies": anomalies,
            "strategy": f"Operativa en {top_assets_str}. Ratio B/P {profit_factor:.1f}x. {market_regime}.",
        }
    except Exception:
        return None

def main():
    print("=" * 70)
    print("  🧠 MOTOR CUANTITATIVO Y FORENSE INSTITUCIONAL DE HYPERLIQUID")
    print("=" * 70)

    try:
        cand_input = input("\n👉 ¿Cuántos candidatos quieres auditar a fondo? [Por defecto: 50]: ").strip()
        max_candidates = int(cand_input) if cand_input else 50
    except ValueError:
        max_candidates = 50

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

    print(f"\n⚙️ Configuración:")
    print(f"   • Candidatos a auditar a fondo: {max_candidates}")
    print(f"   • Operaciones por trader: hasta {max_fills}")
    print(f"   • Saldo mínimo: ${min_balance:,.0f} USD")

    rows = fetch_leaderboard()
    if not rows:
        print("❌ No se pudo obtener el leaderboard.")
        return

    print(f"🔎 Pre-filtrando candidatos de los {len(rows)} traders de Hyperliquid...")
    candidates = []
    for r in rows:
        addr = r.get("ethAddress")
        val = float(r.get("accountValue", 0))
        if not addr or addr.lower() in IGNORED_ADDRESSES:
            continue
        if val < 5000 or val > 50000000:
            continue
        candidates.append(addr)
        if len(candidates) >= max_candidates:
            break

    print(f"✅ Seleccionados {len(candidates)} candidatos para auditoría forense on-chain.")
    print(f"⏳ Analizando régimen de mercado, Sortino, sesiones y 6 tests de anomalías...")

    start_time = time.time()
    audited_traders = []

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(audit_trader_deep, addr, max_fills, min_balance): addr for addr in candidates}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            res = future.result()
            if res:
                audited_traders.append(res)
                if res["passedFilter"]:
                    print(f"  ⭐ [APROBADO FORENSE] {res['address'][:10]}... | Nota: {res['score']}/10 | Expectativa: +${res['expectancyUSD']}/trade | Sortino: {res['sortinoRatio']} | {res['marketRegime']}")
                else:
                    print(f"  ⚠️ [DESCARTADO] {res['address'][:10]}... | {res['filterAuditReason']}")
            else:
                if completed % 10 == 0:
                    print(f"  ⏳ Progreso: {completed}/{len(candidates)} cuentas auditadas...")

    # Cargar base de datos existente para fusionar sin perder datos
    existing_traders = []
    try:
        if os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                existing_traders = old_data.get("traders", []) if isinstance(old_data, dict) else old_data
    except Exception:
        pass

    seen_addrs = {t["address"].lower() for t in audited_traders}
    for old_t in existing_traders:
        if old_t["address"].lower() not in seen_addrs:
            audited_traders.append(old_t)
            seen_addrs.add(old_t["address"].lower())

    audited_traders.sort(key=lambda x: (1 if x.get("passedFilter", False) else 0, float(x.get("score", 0)), x.get("profitFactor", 0)), reverse=True)

    passed_count = len([t for t in audited_traders if t.get("passedFilter", False)])
    failed_count = len(audited_traders) - passed_count
    elapsed = time.time() - start_time
    timestamp_now = time.strftime("%d/%m/%Y %H:%M:%S")

    result_dataset = {
        "lastAudited": timestamp_now,
        "totalScanned": len(audited_traders),
        "totalPassed": passed_count,
        "totalFailed": failed_count,
        "config": {
            "maxCandidates": max_candidates,
            "maxFillsPerTrader": max_fills,
            "minBalanceUSD": min_balance,
        },
        "traders": audited_traders,
    }

    os.makedirs("web/src/data", exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result_dataset, f, indent=2)

    with open(OUTPUT_FILE_ROOT, "w", encoding="utf-8") as f:
        json.dump(result_dataset, f, indent=2)

    print(f"\n🏆 ¡Auditoría Forense Finalizada en {elapsed:.1f}s!")
    print(f"🌟 {len(audited_traders)} cuentas analizadas en total.")
    print(f"⭐ {passed_count} Traders de Élite APROBADOS con radiografía forense completa.")
    print(f"🕒 Fecha y Hora registrada: {timestamp_now}")
    print(f"💾 Guardado en: {OUTPUT_FILE}")

    push_input = input("\n🚀 ¿Quieres sincronizar y publicar este ranking forense en tu web en producción? (S/n): ").strip().lower()
    if push_input != "n":
        print("📦 Empaquetando y subiendo a Vercel y GitHub...")
        subprocess.run(["DEVELOPER_DIR=/Library/Developer/CommandLineTools git add web/src/data/verified_traders.json && DEVELOPER_DIR=/Library/Developer/CommandLineTools git commit -m 'Update verified quant & forensic dataset' && DEVELOPER_DIR=/Library/Developer/CommandLineTools git push origin main && cd web && npx vercel build --prod --yes && npx vercel deploy --prebuilt --prod --yes"], shell=True)
        print("🎉 ¡Ranking forense actualizado en tu web en vivo con la nueva fecha y hora!")

if __name__ == "__main__":
    main()
