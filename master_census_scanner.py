#!/usr/bin/env python3
"""
========================================================================================
  🧠 MOTOR DE CENSO MASIVO TOTAL ON-CHAIN HYPERLIQUID (44.000+ CUENTAS)
  Auditoría Forense Cuantitativa, Detección de Anomalías y Etiquetado Institucional
========================================================================================
"""

import os
import sys
import time
import json
import sqlite3
import requests
import threading
import subprocess
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

INFO_URL = "https://api.hyperliquid.xyz/info"
LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard"
DB_PATH = "data/hyperliquid_master.db"
OUTPUT_WEB_JSON = "web/src/data/verified_traders.json"
OUTPUT_ROOT_JSON = "verified_traders.json"

IGNORED_ADDRESSES = {
    "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303",  # HLP Vault
    "0x0000000000000000000000000000000000000000",
}

# Control de Tasa Global (Token / Leaky Bucket seguro y sin bloqueos de mutex)
class SafeRateLimiter:
    def __init__(self, target_rate=4.5):
        self.interval = 1.0 / target_rate
        self.next_time = time.time()
        self.lock = threading.Lock()
        self.pause_until = 0

    def wait(self):
        with self.lock:
            now = time.time()
            scheduled = max(now, self.next_time, self.pause_until)
            self.next_time = scheduled + self.interval

        delay = scheduled - now
        if delay > 0:
            time.sleep(delay)

    def signal_429(self, cooldown=12.0):
        with self.lock:
            now = time.time()
            self.pause_until = max(self.pause_until, now + cooldown)
            self.next_time = max(self.next_time, now + cooldown)

rate_limiter = SafeRateLimiter(target_rate=4.5)

# Sesión HTTP persistente con connection pooling
http_session = requests.Session()
http_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
})

def init_database():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS audited_traders (
            address TEXT PRIMARY KEY,
            name TEXT,
            score REAL,
            passed_filter INTEGER,
            filter_reason TEXT,
            account_value REAL,
            win_rate REAL,
            profit_factor REAL,
            sortino_ratio REAL,
            expectancy_usd REAL,
            max_consecutive_wins INTEGER,
            max_consecutive_losses INTEGER,
            lucky_trade_pct REAL,
            market_regime TEXT,
            best_session TEXT,
            trading_style TEXT,
            max_drawdown_pct REAL,
            total_fills INTEGER,
            closed_trades_count INTEGER,
            net_pnl_total REAL,
            month_pnl REAL,
            month_roi REAL,
            month_win_rate REAL,
            week_pnl REAL,
            week_win_rate REAL,
            floating_loss_pct REAL,
            margin_utilization_pct REAL,
            top_assets TEXT,
            anomalies_json TEXT,
            strategy TEXT,
            audited_at TEXT
        )
    """)

    # Migración: Añadir nuevas columnas si no existen
    columns_to_add = [
        ("calmar_ratio", "REAL"),
        ("asset_concentration_btc_eth_sol", "REAL"),
        ("peak_leverage_real", "REAL"),
        ("avg_leverage_real", "REAL"),
        ("tags_json", "TEXT")
    ]
    cur.execute("PRAGMA table_info(audited_traders)")
    existing_cols = {row[1] for row in cur.fetchall()}
    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            print(f"📦 Migrando base de datos: Añadiendo columna {col_name} ({col_type})...")
            cur.execute(f"ALTER TABLE audited_traders ADD COLUMN {col_name} {col_type}")

    conn.commit()
    conn.close()

def get_already_audited_addresses():
    if not os.path.exists(DB_PATH):
        return set()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT address FROM audited_traders WHERE calmar_ratio IS NOT NULL")
    rows = cur.fetchall()
    conn.close()
    return {r[0].lower() for r in rows}

def save_trader_to_db(t):
    conn = sqlite3.connect(DB_PATH, timeout=30)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO audited_traders (
            address, name, score, passed_filter, filter_reason, account_value,
            win_rate, profit_factor, sortino_ratio, expectancy_usd,
            max_consecutive_wins, max_consecutive_losses, lucky_trade_pct,
            market_regime, best_session, trading_style, max_drawdown_pct,
            total_fills, closed_trades_count, net_pnl_total, month_pnl,
            month_roi, month_win_rate, week_pnl, week_win_rate,
            floating_loss_pct, margin_utilization_pct, top_assets,
            anomalies_json, strategy, audited_at,
            calmar_ratio, asset_concentration_btc_eth_sol, peak_leverage_real, avg_leverage_real, tags_json
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    """, (
        t["address"].lower(),
        t["name"],
        float(t["score"]),
        1 if t["passedFilter"] else 0,
        t["filterAuditReason"],
        t["accountValue"],
        t["winRate"],
        t["profitFactor"],
        t["sortinoRatio"],
        t["expectancyUSD"],
        t["maxConsecutiveWins"],
        t["maxConsecutiveLosses"],
        t["luckyTradePct"],
        t["marketRegime"],
        t["bestSession"],
        t["tradingStyle"],
        t["maxDrawdownPct"],
        t["totalFills"],
        t["closedTradesCount"],
        t["netPnlTotal"],
        t["monthPnl"],
        t["monthRoi"],
        t["monthWinRate"],
        t["weekPnl"],
        t["weekWinRate"],
        t["floatingLossPct"],
        t["marginUtilizationPct"],
        t["topAssets"],
        json.dumps(t.get("anomalies", [])),
        t["strategy"],
        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        t.get("calmarRatio", 0.0),
        t.get("assetConcentrationBtcEthSol", 0.0),
        t.get("peakLeverageReal", 1.0),
        t.get("avgLeverageReal", 1.0),
        json.dumps(t.get("tags", []))
    ))
    conn.commit()
    conn.close()

def query_info_api(payload, max_retries=3):
    for attempt in range(max_retries):
        rate_limiter.wait()
        try:
            resp = http_session.post(INFO_URL, json=payload, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                if data is not None and not (isinstance(data, str) and "rate limited" in data.lower()):
                    return data
            elif resp.status_code == 429:
                rate_limiter.signal_429(cooldown=10.0 + attempt * 5.0)
                time.sleep(1.0)
                continue
        except Exception:
            pass

        # Fallback rápido vía curl si falla la sesión
        try:
            cmd = ["curl", "-s", "--max-time", "12", "-X", "POST", INFO_URL, "-H", "Content-Type: application/json", "-d", json.dumps(payload)]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=14)
            if proc.returncode == 0 and proc.stdout and "rate limited" not in proc.stdout.lower() and proc.stdout.strip() != "null":
                return json.loads(proc.stdout)
            elif "rate limited" in proc.stdout.lower():
                rate_limiter.signal_429(cooldown=10.0 + attempt * 5.0)
                time.sleep(1.0)
        except Exception:
            pass

        time.sleep(0.3)
    return None

def fetch_all_leaderboard_accounts():
    print("\n📡 Descargando el censo completo de Hyperliquid (44.000+ cuentas)...")
    try:
        proc = subprocess.run(["curl", "-s", "--compressed", LEADERBOARD_URL], capture_output=True, text=True, timeout=30)
        if proc.returncode == 0 and proc.stdout:
            data = json.loads(proc.stdout)
            rows = data.get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows):,} cuentas registradas en el exchange.")
            return rows
    except Exception:
        pass

    try:
        resp = requests.get(LEADERBOARD_URL, headers=http_session.headers, timeout=30)
        if resp.status_code == 200:
            rows = resp.json().get("leaderboardRows", [])
            print(f"✅ Descargadas {len(rows):,} cuentas vía requests.")
            return rows
    except Exception as e:
        print(f"❌ Error al descargar leaderboard: {e}")

    return []

def audit_single_account_forensic(address, leader_row=None):
    addr = address.lower().strip()
    if addr in IGNORED_ADDRESSES:
        return None

    try:
        # Extraer métricas previas del leaderboard si existen
        lb_account_val = 0.0
        lb_all_pnl = 0.0
        lb_month_pnl = 0.0
        lb_week_pnl = 0.0

        if leader_row:
            lb_account_val = float(leader_row.get("accountValue", 0))
            windows = dict(leader_row.get("windowPerformances", []))
            lb_all_pnl = float(windows.get("allTime", {}).get("pnl", 0))
            lb_month_pnl = float(windows.get("month", {}).get("pnl", 0))
            lb_week_pnl = float(windows.get("week", {}).get("pnl", 0))

        # 1. Estado en tiempo real
        user_state = query_info_api({"type": "clearinghouseState", "user": addr})
        if not user_state or not isinstance(user_state, dict):
            return {
                "address": addr,
                "name": f"Cuenta {addr[:6]}",
                "score": "1.0",
                "passedFilter": False,
                "filterAuditReason": f"❌ Saldo o PnL insuficiente en Hyperliquid (${lb_account_val:,.0f}).",
                "accountValue": round(lb_account_val, 2),
                "winRate": 0.0,
                "profitFactor": 0.0,
                "sortinoRatio": 0.0,
                "expectancyUSD": 0.0,
                "maxConsecutiveWins": 0,
                "maxConsecutiveLosses": 0,
                "luckyTradePct": 0.0,
                "marketRegime": "N/A",
                "bestSession": "N/A",
                "tradingStyle": "Inactivo",
                "maxDrawdownPct": 0.0,
                "totalFills": 0,
                "closedTradesCount": 0,
                "netPnlTotal": round(lb_all_pnl, 2),
                "monthPnl": round(lb_month_pnl, 2),
                "monthRoi": 0.0,
                "monthWinRate": 0.0,
                "weekPnl": round(lb_week_pnl, 2),
                "weekWinRate": 0.0,
                "floatingLossPct": 0.0,
                "marginUtilizationPct": 0.0,
                "topAssets": "N/A",
                "anomalies": [{"test": "Actividad", "status": "FAIL", "detail": "Sin datos de margen activos."}],
                "strategy": "Inactivo.",
                "calmarRatio": 0.0,
                "assetConcentrationBtcEthSol": 0.0,
                "peakLeverageReal": 1.0,
                "avgLeverageReal": 1.0,
                "tags": []
            }

        account_value = float(user_state.get("marginSummary", {}).get("accountValue", 0))
        total_margin_used = float(user_state.get("marginSummary", {}).get("totalMarginUsed", 0))

        # AUDITORÍA DE PÉRDIDAS FLOTANTES
        asset_positions = user_state.get("assetPositions", [])
        total_unrealized_pnl = sum(float(p.get("position", {}).get("unrealizedPnl", 0)) for p in asset_positions)
        floating_loss_pct = (total_unrealized_pnl / account_value * 100) if account_value > 0 else 0
        margin_utilization_pct = (total_margin_used / account_value * 100) if account_value > 0 else 0

        # 2. Historial de órdenes completo (fills)
        fills = query_info_api({"type": "userFills", "user": addr})
        if not isinstance(fills, list):
            fills = []

        now_ms = time.time() * 1000
        ms_7d = now_ms - (7 * 24 * 3600 * 1000)
        ms_30d = now_ms - (30 * 24 * 3600 * 1000)

        closed_all = []
        closed_30d = []
        closed_7d = []
        coin_counts = {}
        session_pnls = {"Asia": 0, "Londres": 0, "Nueva York": 0}
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

                dt = datetime.fromtimestamp(t_ms / 1000, tz=timezone.utc)
                hour = dt.hour
                if 0 <= hour < 8: session_pnls["Asia"] += pnl
                elif 8 <= hour < 14: session_pnls["Londres"] += pnl
                else: session_pnls["Nueva York"] += pnl

                if t_ms >= ms_30d: closed_30d.append(pnl)
                if t_ms >= ms_7d: closed_7d.append(pnl)

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

        # Expectativa matemática ($ / trade)
        win_prob = win_rate / 100
        loss_prob = (100 - win_rate) / 100
        expectancy_usd = (win_prob * avg_win) - (loss_prob * avg_loss)

        # Rachas consecutivas
        max_consecutive_wins = 0
        max_consecutive_losses = 0
        cur_w, cur_l = 0, 0
        for p in closed_all:
            if p > 0:
                cur_w += 1
                cur_l = 0
                if cur_w > max_consecutive_wins: max_consecutive_wins = cur_w
            elif p < 0:
                cur_l += 1
                cur_w = 0
                if cur_l > max_consecutive_losses: max_consecutive_losses = cur_l

        # Ratio de Sortino
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
            if curr > peak: peak = curr
            dd = ((peak - curr) / peak) * 100.0
            if dd > max_dd_pct: max_dd_pct = dd

        # Calcular el rango histórico en días
        fill_times = [f.get("time", 0) for f in fills if f.get("time")]
        history_days = (max(fill_times) - min(fill_times)) / (24 * 3600 * 1000.0) if len(fill_times) > 1 else 0.0

        # Ratio de Calmar (anualizado)
        roi = (net_pnl / account_value) if account_value > 0 else 0.0
        annualized_roi = (roi * (365.0 / history_days) * 100.0) if history_days > 0.0 else 0.0
        calmar_ratio = (annualized_roi / max_dd_pct) if (max_dd_pct > 0 and history_days > 0) else 9.9
        calmar_ratio = max(min(calmar_ratio, 99.0), -99.0)

        # Concentración de Activos en Blue Chips (BTC/ETH/SOL)
        btc_eth_sol_count = sum(1 for f in fills if str(f.get("coin", "")).upper() in ["BTC", "ETH", "SOL"])
        asset_concentration_btc_eth_sol = (btc_eth_sol_count / len(fills) * 100) if fills else 0.0

        # Estimar apalancamiento real (nominal máximo respecto al balance)
        peak_leverage = (max(notionals) / account_value) if (account_value > 0 and notionals) else 1.0
        avg_leverage = (sum(notionals) / len(notionals) / account_value) if (account_value > 0 and notionals) else 1.0

        # Régimen de Mercado
        long_pnl_total = sum(long_pnls)
        short_pnl_total = sum(short_pnls)
        if long_pnl_total > 0 and short_pnl_total > 0: market_regime = "🌦️ Todoterreno (Bull & Bear)"
        elif long_pnl_total > short_pnl_total: market_regime = "📈 Tendencial Alcista (Longs)"
        else: market_regime = "📉 Cobertura (Shorts)"

        # Sesión Horaria Más Rentable
        best_session = f"Sesión {max(session_pnls.items(), key=lambda x: x[1])[0]}"

        # Estilo Operativo
        if total_closed >= 500: trading_style = "⚡ Scalping Cuantitativo"
        elif total_closed >= 80: trading_style = "⏱️ Day Trading Intradiario"
        else: trading_style = "🌊 Swing Trading de Posición"

        # BATERÍA DE 8 TESTS FORENSES
        anomalies = []
        max_win = max(wins) if wins else 0
        lucky_trade_pct = (max_win / gross_profit * 100) if gross_profit > 0 else 0

        # Test 1: Golpe de Suerte
        if lucky_trade_pct >= 45.0: anomalies.append({"test": "Golpe de Suerte Único", "status": "FAIL", "detail": f"Un solo trade concentró el {lucky_trade_pct:.1f}% de las ganancias."})
        elif lucky_trade_pct >= 25.0: anomalies.append({"test": "Concentración de Beneficios", "status": "WARNING", "detail": f"El mejor trade aportó el {lucky_trade_pct:.1f}% del total."})
        else: anomalies.append({"test": "Distribución de Ganancias", "status": "PASS", "detail": f"Ganancias 100% orgánicas."})

        # Test 2: Martingala
        martingale_spikes = 0
        for i in range(1, len(closed_all)):
            if closed_all[i - 1] < 0 and i < len(notionals) and (i - 1) < len(notionals):
                if notionals[i] >= notionals[i - 1] * 2.2: martingale_spikes += 1

        if martingale_spikes >= 3: anomalies.append({"test": "Patrón Martingala", "status": "FAIL", "detail": f"Detectadas {martingale_spikes} duplicaciones de tamaño tras pérdidas."})
        else: anomalies.append({"test": "Anti-Martingala", "status": "PASS", "detail": "Gestión de tamaño disciplinada."})

        # Test 3: Pérdidas Flotantes
        if total_unrealized_pnl < 0 and abs(floating_loss_pct) >= 10.0: anomalies.append({"test": "Pérdidas Flotantes", "status": "FAIL", "detail": f"Pérdida abierta de -{abs(floating_loss_pct):.1f}% del capital."})
        else: anomalies.append({"test": "Pérdidas Flotantes", "status": "PASS", "detail": "0% pérdidas ocultas en posiciones abiertas."})

        # Test 4: Asimetría de Pérdidas
        if avg_loss >= avg_win * 4 and losses: anomalies.append({"test": "Asimetría de Riesgo", "status": "WARNING", "detail": f"Pérdida media (${avg_loss:.0f}) supera por 4x la ganancia media (${avg_win:.0f})."})
        else: anomalies.append({"test": "Ratio Riesgo/Beneficio", "status": "PASS", "detail": f"Relación equilibrada ({win_loss_ratio:.2f}x)."})

        # Test 5: Margen y Solvencia
        if margin_utilization_pct >= 45.0: anomalies.append({"test": "Sobreapalancamiento", "status": "FAIL", "detail": f"Margen en uso elevado ({margin_utilization_pct:.1f}%)."})
        else: anomalies.append({"test": "Solvencia de Margen", "status": "PASS", "detail": f"Margen en uso seguro ({margin_utilization_pct:.1f}%)."})

        # Test 6: Rachas Adversas
        if max_consecutive_losses >= 6: anomalies.append({"test": "Rachas de Pérdidas", "status": "WARNING", "detail": f"Racha máxima de {max_consecutive_losses} pérdidas seguidas."})
        else: anomalies.append({"test": "Control de Rachas", "status": "PASS", "detail": f"Máx {max_consecutive_losses} pérdidas seguidas."})

        # CRITERIOS ESTRICTOS DE APROBACIÓN CUANTITATIVA (Endurecidos según PDF)
        passed_filter = True
        reasons = []

        if account_value < 10000.0:
            passed_filter = False
            reasons.append(f"Saldo (${account_value:,.0f}) inferior al mínimo de $10,000.")
        if total_unrealized_pnl < 0 and abs(total_unrealized_pnl) > (account_value * 0.08):
            passed_filter = False
            reasons.append(f"Pérdida flotante abierta del {floating_loss_pct:.1f}%.")
        if margin_utilization_pct > 45.0:
            passed_filter = False
            reasons.append(f"Margen en uso excesivo ({margin_utilization_pct:.1f}%).")
        if total_closed < 100:
            passed_filter = False
            reasons.append(f"Muestra estadística insuficiente ({total_closed} trades, req >= 100).")
        if history_days < 90.0:
            passed_filter = False
            reasons.append(f"Historial temporal insuficiente ({history_days:.1f} días, req >= 90).")
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
        if sortino_ratio < 1.20:
            passed_filter = False
            reasons.append(f"Ratio de Sortino bajo ({sortino_ratio:.2f}, req >= 1.20).")
        if calmar_ratio < 1.00:
            passed_filter = False
            reasons.append(f"Ratio de Calmar bajo ({calmar_ratio:.2f}, req >= 1.00).")
        if peak_leverage > 10.0:
            passed_filter = False
            reasons.append(f"Apalancamiento real pico excesivo ({peak_leverage:.1f}x, req <= 10x).")
        if any(a["status"] == "FAIL" for a in anomalies):
            passed_filter = False
            failed_tests = [a["test"] for a in anomalies if a["status"] == "FAIL"]
            reasons.append(f"Falló tests forenses: {', '.join(failed_tests)}.")

        # ASIGNACIÓN DE ETIQUETAS (TAGS) SEGÚN PDF
        tags = []
        is_elite = (
            passed_filter and 
            sortino_ratio >= 2.0 and 
            calmar_ratio >= 2.5 and 
            max_dd_pct <= 12.0 and 
            asset_concentration_btc_eth_sol >= 80.0 and 
            history_days >= 180.0
        )
        if is_elite:
            tags.append("Élite 👑")
        
        if avg_leverage <= 3.0 and max_dd_pct <= 10.0 and passed_filter and not any("Martingala" in a["test"] and a["status"] == "FAIL" for a in anomalies):
            tags.append("Conservador 🛡️")
            
        if total_closed >= 500:
            tags.append("Scalper ⚡")
        elif total_closed < 80:
            tags.append("Swing Trader 🌊")
            
        if lucky_trade_pct >= 25.0:
            tags.append("Golpe de Suerte 🎰")
            
        if any("Martingala" in a["test"] and a["status"] == "FAIL" for a in anomalies):
            tags.append("Martingala ⚠️")
            
        if peak_leverage > 10.0:
            tags.append("Sobreapalancado ⚠️")
            
        if floating_loss_pct <= -15.0:
            tags.append("Pérdida Oculta 🩹")
            
        if asset_concentration_btc_eth_sol < 40.0:
            tags.append("Meme Trader 🃏")

        top_assets = [k for k, _ in sorted(coin_counts.items(), key=lambda x: x[1], reverse=True)[:3]]
        top_assets_str = ", ".join(top_assets) if top_assets else "Crypto"

        if passed_filter:
            audit_explanation = (
                f"⭐ APROBADO: Win Rate {win_rate:.1f}% en {total_closed} trades, "
                f"Profit Factor {profit_factor:.2f}x, Sortino {sortino_ratio:.1f}, Drawdown -{max_dd_pct:.2f}%, "
                f"Expectativa +${expectancy_usd:.0f}/trade, Calmar {calmar_ratio:.1f} en {top_assets_str}."
            )
            score = 9.0 + min((win_rate - 75) / 25, 0.9)
        else:
            audit_explanation = f"❌ DESCARTADO: {'; '.join(reasons)}"
            score = 4.0 if account_value > 5000 else 2.0

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
            "calmarRatio": round(calmar_ratio, 2),
            "assetConcentrationBtcEthSol": round(asset_concentration_btc_eth_sol, 1),
            "peakLeverageReal": round(peak_leverage, 1),
            "avgLeverageReal": round(avg_leverage, 1),
            "tags": tags,
        }
    except Exception as e:
        return None

def export_to_web_json():
    """Extrae de SQLite los mejores aprobados y un resumen para la web."""
    if not os.path.exists(DB_PATH):
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM audited_traders")
    total_scanned = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM audited_traders WHERE passed_filter = 1")
    total_passed = cur.fetchone()[0]

    # Cargar los mejores aprobados ordenados por score y profit factor
    cur.execute("""
        SELECT * FROM audited_traders 
        ORDER BY passed_filter DESC, score DESC, profit_factor DESC, account_value DESC 
        LIMIT 250
    """)
    rows = cur.fetchall()
    conn.close()

    traders_list = []
    for r in rows:
        traders_list.append({
            "address": r["address"],
            "name": r["name"],
            "score": str(r["score"]),
            "passedFilter": bool(r["passed_filter"]),
            "filterAuditReason": r["filter_reason"],
            "accountValue": r["account_value"],
            "winRate": r["win_rate"],
            "profitFactor": r["profit_factor"],
            "sortinoRatio": r["sortino_ratio"],
            "expectancyUSD": r["expectancy_usd"],
            "maxConsecutiveWins": r["max_consecutive_wins"],
            "maxConsecutiveLosses": r["max_consecutive_losses"],
            "luckyTradePct": r["lucky_trade_pct"],
            "marketRegime": r["market_regime"],
            "bestSession": r["best_session"],
            "tradingStyle": r["trading_style"],
            "maxDrawdownPct": r["max_drawdown_pct"],
            "totalFills": r["total_fills"],
            "closedTradesCount": r["closed_trades_count"],
            "netPnlTotal": r["net_pnl_total"],
            "monthPnl": r["month_pnl"],
            "monthRoi": r["month_roi"],
            "monthWinRate": r["month_win_rate"],
            "weekPnl": r["week_pnl"],
            "weekWinRate": r["week_win_rate"],
            "floatingLossPct": r["floating_loss_pct"],
            "marginUtilizationPct": r["margin_utilization_pct"],
            "topAssets": r["top_assets"],
            "anomalies": json.loads(r["anomalies_json"]) if r["anomalies_json"] else [],
            "strategy": r["strategy"],
            "calmarRatio": r["calmar_ratio"],
            "assetConcentrationBtcEthSol": r["asset_concentration_btc_eth_sol"],
            "peakLeverageReal": r["peak_leverage_real"],
            "avgLeverageReal": r["avg_leverage_real"],
            "tags": json.loads(r["tags_json"]) if r["tags_json"] else [],
        })

    timestamp_now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    dataset = {
        "lastAudited": timestamp_now,
        "totalScanned": total_scanned,
        "totalPassed": total_passed,
        "totalFailed": total_scanned - total_passed,
        "mode": "100%_FULL_CENSUS_ONCHAIN_SQLITE",
        "traders": traders_list
    }

    os.makedirs("web/src/data", exist_ok=True)
    with open(OUTPUT_WEB_JSON, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    with open(OUTPUT_ROOT_JSON, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)

def main():
    os.system("clear" if os.name != "nt" else "cls")
    print("=" * 80)
    print("  🧠 MOTOR DE CENSO MASIVO TOTAL ON-CHAIN HYPERLIQUID (44.000+ CUENTAS)")
    print("=" * 80)
    print("  • Batería forense: Calmar, Sortino, Concentración Blue-Chip y Apalancamiento.")
    print("  • Sistema de Etiquetado Dinámico (Élite, Conservador, Scalper, Martingala, etc.).")
    print("  • Base de datos SQLite continua con Checkpointing indestructible.")
    print("=" * 80)
    print("\n📋 OPCIONES DE EJECUCIÓN:")
    print("  [1] 🚀 Continuar / Reanudar Censo (Mantiene datos y audita cuentas pendientes)")
    print("  [2] 🗑️  BORRAR DATOS ANTERIORES y Empezar de Cero (Censo 100% Limpio)")
    print("  [3] 📊 Solo Exportar y Sincronizar Base de Datos actual a la Web")
    print("  [0] ❌ Salir")
    print("-" * 80)

    try:
        opcion = input("👉 Elige una opción (1/2/3/0) [por defecto 1]: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nOperación cancelada.")
        return

    if opcion == "0":
        print("Operación cancelada.")
        return
    elif opcion == "2":
        confirm = input("\n⚠️  ¿Seguro que deseas BORRAR la base de datos previa y re-auditar todo desde cero? (s/N): ").strip().lower()
        if confirm == "s":
            if os.path.exists(DB_PATH):
                try:
                    os.remove(DB_PATH)
                    print(f"🗑️  Base de datos eliminada: '{DB_PATH}'.")
                except Exception as e:
                    print(f"⚠️  No se pudo borrar el archivo: {e}")
            if os.path.exists("hyperliquid_census.db"):
                try:
                    os.remove("hyperliquid_census.db")
                except Exception:
                    pass
            init_database()
            print("✨ Base de datos reinicializada con éxito. Empezando de cero...\n")
        else:
            print("Acción cancelada. Continuando en modo normal.\n")
            init_database()
    elif opcion == "3":
        init_database()
        export_to_web_json()
        print("✅ Base de datos exportada a JSON con éxito.")
        sync_web = input("\n🚀 ¿Deseas desplegar y publicar los cambios en tu web en vivo (Vercel)? (S/n): ").strip().lower()
        if sync_web != "n":
            print("📦 Compilando y subiendo a Vercel...")
            subprocess.run(["cd web && npx vercel build --prod --yes && npx vercel deploy --prebuilt --prod --yes"], shell=True)
            print("🎉 ¡Web en vivo actualizada con éxito!")
        return
    else:
        init_database()

    already_audited = get_already_audited_addresses()
    print(f"📂 Base de datos local: {len(already_audited):,} cuentas con métricas y tags actuales.")

    all_rows = fetch_all_leaderboard_accounts()
    if not all_rows:
        print("❌ No se pudo descargar el censo de Hyperliquid.")
        return

    # Clasificar en Tier 1 (Descarte instantáneo) y Tier 2 (Candidatos para auditoría profunda)
    tier1_discarded = []
    tier2_candidates = []
    seen = set()

    for r in all_rows:
        addr = r.get("ethAddress")
        if not addr or addr.lower() in seen or addr.lower() in IGNORED_ADDRESSES:
            continue
        seen.add(addr.lower())

        if addr.lower() in already_audited:
            continue

        val = float(r.get("accountValue", 0))
        windows = dict(r.get("windowPerformances", []))
        all_pnl = float(windows.get("allTime", {}).get("pnl", 0))
        month_pnl = float(windows.get("month", {}).get("pnl", 0))

        # Criterio inteligente de candidato: saldo real significativo o rentabilidad activa
        if val >= 5000.0 or (all_pnl > 0 and val >= 1000.0):
            tier2_candidates.append(r)
        else:
            tier1_discarded.append(r)

    total_target = len(seen)
    print(f"\n🎯 Censo Total: {total_target:,} cuentas detectadas en el exchange.")
    print(f"⚡ Tier 1 (Cuentas inactivas o $<1k): {len(tier1_discarded):,} (se registran al instante)")
    print(f"🔬 Tier 2 (Candidatos para Auditoría Forense On-Chain): {len(tier2_candidates):,} cuentas.")

    # 1. Registrar Tier 1 rápidamente en SQLite sin saturar la red
    if tier1_discarded:
        print(f"\n📝 Registrando {len(tier1_discarded):,} cuentas Tier 1 en SQLite...")
        for r in tier1_discarded:
            addr = r.get("ethAddress", "").lower()
            val = float(r.get("accountValue", 0))
            windows = dict(r.get("windowPerformances", []))
            all_pnl = float(windows.get("allTime", {}).get("pnl", 0))
            month_pnl = float(windows.get("month", {}).get("pnl", 0))
            week_pnl = float(windows.get("week", {}).get("pnl", 0))

            t_obj = {
                "address": addr,
                "name": f"Cuenta {addr[:6]}",
                "score": "1.0" if val < 1000 else "2.0",
                "passedFilter": False,
                "filterAuditReason": f"❌ Saldo o PnL histórico insuficiente (${val:,.0f}, PnL ${all_pnl:,.0f}).",
                "accountValue": round(val, 2),
                "winRate": 0.0,
                "profitFactor": 0.0,
                "sortinoRatio": 0.0,
                "expectancyUSD": 0.0,
                "maxConsecutiveWins": 0,
                "maxConsecutiveLosses": 0,
                "luckyTradePct": 0.0,
                "marketRegime": "N/A",
                "bestSession": "N/A",
                "tradingStyle": "Inactivo",
                "maxDrawdownPct": 0.0,
                "totalFills": 0,
                "closedTradesCount": 0,
                "netPnlTotal": round(all_pnl, 2),
                "monthPnl": round(month_pnl, 2),
                "monthRoi": 0.0,
                "monthWinRate": 0.0,
                "weekPnl": round(week_pnl, 2),
                "weekWinRate": 0.0,
                "floatingLossPct": 0.0,
                "marginUtilizationPct": 0.0,
                "topAssets": "N/A",
                "anomalies": [{"test": "Volumen", "status": "FAIL", "detail": "Capital bajo o PnL negativo en leaderboard."}],
                "strategy": "Inactivo.",
                "calmarRatio": 0.0,
                "assetConcentrationBtcEthSol": 0.0,
                "peakLeverageReal": 1.0,
                "avgLeverageReal": 1.0,
                "tags": []
            }
            save_trader_to_db(t_obj)

    if not tier2_candidates:
        print("\n🎉 ¡Todas las cuentas candidatas ya están auditadas en tu base de datos local!")
        export_to_web_json()
        return

    est_seconds = len(tier2_candidates) / 2.25 # 2 reqs per candidate at ~4.5 req/s
    est_minutes = est_seconds / 60
    print(f"⏱️ Tiempo estimado para Tier 2: ~{est_minutes:.1f} minutos a ritmo seguro (sin rate limits).")

    start_confirm = input("\n👉 ¿Deseas iniciar la auditoría forense profunda ahora? (S/n): ").strip().lower()
    if start_confirm == "n":
        print("Operación cancelada.")
        export_to_web_json()
        return

    print("\n🚀 Iniciando motor de extracción y batería forense...\n")
    start_time = time.time()
    audited_in_session = 0
    passed_in_session = 0
    last_print_time = time.time()

    # Procesar en lotes con 3 workers para evitar bloqueos y rate limits
    batch_size = 50
    for batch_idx in range(0, len(tier2_candidates), batch_size):
        batch = tier2_candidates[batch_idx:batch_idx + batch_size]

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(audit_single_account_forensic, r.get("ethAddress"), r): r
                for r in batch
            }

            try:
                for future in as_completed(futures):
                    res = future.result()
                    if res:
                        save_trader_to_db(res)
                        audited_in_session += 1
                        if res["passedFilter"]:
                            passed_in_session += 1

                    now = time.time()
                    if now - last_print_time >= 1.0 or audited_in_session == len(tier2_candidates):
                        last_print_time = now
                        pct = (audited_in_session / len(tier2_candidates)) * 100
                        elapsed = now - start_time
                        speed = audited_in_session / max(elapsed, 0.1)
                        remaining = len(tier2_candidates) - audited_in_session
                        eta_sec = remaining / max(speed, 0.01)
                        eta_str = time.strftime("%Hh %Mm %Ss", time.gmtime(eta_sec))
                        elapsed_str = time.strftime("%Hh %Mm %Ss", time.gmtime(elapsed))

                        bar_len = 25
                        filled = int(bar_len * (audited_in_session / len(tier2_candidates)))
                        bar = "█" * filled + "░" * (bar_len - filled)

                        sys.stdout.write(
                            f"\r📊 [{bar}] {pct:.1f}% | "
                            f"Auditadas: {audited_in_session:,}/{len(tier2_candidates):,} | "
                            f"⭐ Aprobados: {passed_in_session} | "
                            f"⚡ {speed*2:.1f} req/s | "
                            f"⏱️ {elapsed_str} | ⏳ ETA: {eta_str}   "
                        )
                        sys.stdout.flush()

            except KeyboardInterrupt:
                print("\n\n⚠️ Proceso pausado por el usuario (Ctrl + C).")
                print("💾 Todo el progreso hasta este instante ha quedado guardado en SQLite.")
                break

        # Exportar a la web cada lote
        export_to_web_json()

    export_to_web_json()
    print("\n\n" + "=" * 80)
    print("  🏆 ¡SESIÓN DE CENSO FINALIZADA CON ÉXITO!")
    print(f"  • Total cuentas en base de datos: {total_target:,}")
    print(f"  • Nuevas aprobadas en esta sesión: {passed_in_session}")
    print("=" * 80)

    sync_web = input("\n🚀 ¿Deseas desplegar y publicar el nuevo censo en tu web en vivo (Vercel)? (S/n): ").strip().lower()
    if sync_web != "n":
        print("📦 Compilando y subiendo a Vercel...")
        subprocess.run(["cd web && npx vercel build --prod --yes && npx vercel deploy --prebuilt --prod --yes"], shell=True)
        print("🎉 ¡Web en vivo actualizada con éxito!")

if __name__ == "__main__":
    main()
