import { UserProfile, UnifiedTrade } from "./types";
import { getResetTimestamp } from "./storage";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

export function formatDateTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function formatShortDateTime(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}/${month} ${hours}:${minutes}`;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "< 1 min";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    const remMin = min % 60;
    return `${hours}h ${remMin}m`;
  }
  if (min > 0) {
    return `${min} min`;
  }
  return `${sec}s`;
}

export function getApprovedTradeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("hyperliquid_approved_trades_v1") || "[]");
  } catch {
    return [];
  }
}

export function getRejectedTradeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("hyperliquid_rejected_trades_v1") || "[]");
  } catch {
    return [];
  }
}

export function approveTradeId(tradeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getApprovedTradeIds();
    if (!list.includes(tradeId)) {
      list.push(tradeId);
      localStorage.setItem("hyperliquid_approved_trades_v1", JSON.stringify(list));
    }
    const rej = getRejectedTradeIds().filter((id) => id !== tradeId);
    localStorage.setItem("hyperliquid_rejected_trades_v1", JSON.stringify(rej));
    fetch("/api/telegram/trade-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId, action: "approve" }),
    }).catch(() => {});
  } catch {}
}

export function rejectTradeId(tradeId: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRejectedTradeIds();
    if (!list.includes(tradeId)) {
      list.push(tradeId);
      localStorage.setItem("hyperliquid_rejected_trades_v1", JSON.stringify(list));
    }
    const app = getApprovedTradeIds().filter((id) => id !== tradeId);
    localStorage.setItem("hyperliquid_approved_trades_v1", JSON.stringify(app));
    fetch("/api/telegram/trade-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tradeId, action: "reject" }),
    }).catch(() => {});
  } catch {}
}

export interface LeaderLifetimeAudit {
  totalFills: number;
  wins: number;
  losses: number;
  winRate: string;
  netPnl: number;
  profitFactor: string;
  grossProfit: number;
  grossLoss: number;
}

export const leaderAuditsCache: Record<string, LeaderLifetimeAudit> = {};

export function getLeaderAudit(address: string): LeaderLifetimeAudit | undefined {
  return leaderAuditsCache[address.toLowerCase()];
}

// Fetch and sync actions from server
export async function syncServerTradeActions(): Promise<{ approved: string[]; rejected: string[] }> {
  try {
    const res = await fetch("/api/telegram/trade-action").catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (typeof window !== "undefined") {
        if (Array.isArray(data.approved)) {
          const local = getApprovedTradeIds();
          const merged = Array.from(new Set([...local, ...data.approved]));
          localStorage.setItem("hyperliquid_approved_trades_v1", JSON.stringify(merged));
        }
        if (Array.isArray(data.rejected)) {
          const localRej = getRejectedTradeIds();
          const mergedRej = Array.from(new Set([...localRej, ...data.rejected]));
          localStorage.setItem("hyperliquid_rejected_trades_v1", JSON.stringify(mergedRej));
        }
      }
      return data;
    }
  } catch {}
  return { approved: getApprovedTradeIds(), rejected: getRejectedTradeIds() };
}

export async function fetchFullTradeHistory(profile: UserProfile): Promise<UnifiedTrade[]> {
  if (!profile) return [];
  const targetTraders = (profile.trading_mode === "REAL" && profile.real_traders && profile.real_traders.length > 0)
    ? profile.real_traders
    : (profile.traders || []);

  if (targetTraders.length === 0) {
    return [];
  }

  const resetTime = getResetTimestamp();
  const requiresApproval = profile.global_risk?.execution_mode === "TELEGRAM_APPROVAL";
  
  // Sincronizar acciones de aprobación desde el servidor
  await syncServerTradeActions().catch(() => {});
  const approvedSet = new Set(getApprovedTradeIds());
  const rejectedSet = new Set(getRejectedTradeIds());

  const baseCapital = profile.trading_mode === "REAL"
    ? (profile.initial_balance || 1000)
    : (profile.cash_balance || 10000);

  const profileCreatedTs = (profile as any).created_at ? new Date((profile as any).created_at).getTime() : 0;

  // Ejecutar todas las peticiones a la API de Hyperliquid en PARALELO para máxima velocidad
  const traderResults = await Promise.all(
    targetTraders.map(async (t) => {
      const traderTrades: UnifiedTrade[] = [];
      const userCapital = baseCapital * (t.allocation_pct / 100);
      const effectiveJoinedAt = (t.joined_at && t.joined_at > 0)
        ? t.joined_at
        : (profileCreatedTs > 0 ? profileCreatedTs : (resetTime > 0 ? resetTime : Date.now()));
      const copyExisting = t.copy_existing_positions ?? false;
      const riskMultiplier = t.risk_multiplier || 1.0;
      const allocPct = t.allocation_pct;
      const maxLev = t.max_leverage || 10;
      const coinFilterMode = t.coin_filter_mode || "ALL";
      const allowedCoins = (t.allowed_coins || []).map((c) => c.toUpperCase());
      const blockedCoins = (t.blocked_coins || []).map((c) => c.toUpperCase());

      try {
        const [fillsRes, stateRes] = await Promise.all([
          fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "userFills", user: t.address }),
          }).catch(() => null),
          fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: t.address }),
          }).catch(() => null),
        ]);

        const fillsMapByCoin: Record<string, number[]> = {};

        // 1. Procesar Fills (Operaciones Cerradas)
        if (fillsRes && fillsRes.ok) {
          const fills = await fillsRes.json().catch(() => []);
          if (Array.isArray(fills)) {
            let leaderWins = 0;
            let leaderLosses = 0;
            let leaderGrossProfit = 0;
            let leaderGrossLoss = 0;
            let leaderNetPnl = 0;

            fills.forEach((f: any) => {
              const c = (f.coin || "").toUpperCase();
              const time = f.time || 0;
              if (!fillsMapByCoin[c]) fillsMapByCoin[c] = [];
              fillsMapByCoin[c].push(time);

              const cp = parseFloat(f.closedPnl || "0");
              leaderNetPnl += cp;
              if (cp > 0) {
                leaderWins++;
                leaderGrossProfit += cp;
              } else if (cp < 0) {
                leaderLosses++;
                leaderGrossLoss += Math.abs(cp);
              }
            });

            const leaderWinRate = (leaderWins + leaderLosses) > 0
              ? ((leaderWins / (leaderWins + leaderLosses)) * 100).toFixed(1)
              : "0.0";
            const leaderProfitFactor = leaderGrossLoss > 0
              ? (leaderGrossProfit / leaderGrossLoss).toFixed(2)
              : leaderGrossProfit > 0 ? "∞" : "0.00";

            leaderAuditsCache[t.address.toLowerCase()] = {
              totalFills: fills.length,
              wins: leaderWins,
              losses: leaderLosses,
              winRate: leaderWinRate,
              netPnl: leaderNetPnl,
              profitFactor: leaderProfitFactor,
              grossProfit: leaderGrossProfit,
              grossLoss: leaderGrossLoss,
            };

            for (let i = 0; i < fills.length; i++) {
              const f = fills[i];
              const closeTime = f.time || 0;
              const coin = (f.coin || "").toUpperCase();

              // REGLA ESTRICTA DE RÉPLICA:
              // Una operación cerrada con anterioridad a la fecha en que el usuario empezó a copiar al trader (effectiveJoinedAt)
              // o antes de un reinicio de cuenta (resetTime) NUNCA fue una réplica del usuario.
              if (effectiveJoinedAt > 0 && closeTime < effectiveJoinedAt) continue;
              if (resetTime > 0 && closeTime < resetTime) continue;

              if (coinFilterMode === "ALLOWLIST" && allowedCoins.length > 0 && !allowedCoins.includes(coin)) continue;
              if (coinFilterMode === "BLOCKLIST" && blockedCoins.length > 0 && blockedCoins.includes(coin)) continue;

              const cp = parseFloat(f.closedPnl || "0");
              const px = parseFloat(f.px || "0");
              const leaderSz = parseFloat(f.sz || "0");
              const dir = f.dir || (f.side === "B" ? "Buy" : "Sell");
              const side: "LONG" | "SHORT" = f.side === "B" ? "LONG" : "SHORT";
              const fee = parseFloat(f.fee || "0");

              const userPnl = cp * riskMultiplier * (allocPct / 100);
              const userSz = leaderSz * riskMultiplier * (allocPct / 100);
              const usdValue = userSz * px;
              const pnlPct = usdValue > 0 ? (userPnl / (usdValue / maxLev)) * 100 : 0;

              const coinTimes = fillsMapByCoin[coin] || [];
              const earlierTimes = coinTimes.filter((ts) => ts < closeTime);
              const openTime = earlierTimes.length > 0
                ? Math.max(...earlierTimes)
                : Math.max(0, closeTime - (((f.tid || i) % 180 + 20) * 60 * 1000));

              const durationMs = Math.max(60000, closeTime - openTime);

              traderTrades.push({
                id: `fill_${t.address.slice(0, 6)}_${closeTime}_${i}`,
                timestamp: closeTime,
                timeStr: formatShortDateTime(closeTime),
                openTimestamp: openTime,
                closeTimestamp: closeTime,
                openTimeStr: formatDateTime(openTime),
                closeTimeStr: formatDateTime(closeTime),
                durationStr: formatDuration(durationMs),
                traderName: t.alias ? `${t.alias} (${t.name})` : t.name,
                traderAddr: t.address,
                coin: f.coin,
                dir,
                side,
                status: "CLOSED",
                entryPx: px,
                exitPx: px,
                size: userSz,
                usdValue,
                leverage: maxLev,
                pnl: userPnl,
                pnlPct,
                fee: fee * (allocPct / 100),
              });
            }
          }
        }

        // 2. Procesar Posiciones Abiertas
        if (stateRes && stateRes.ok) {
          const state = await stateRes.json().catch(() => ({}));
          const traderAccountValue = parseFloat(state.marginSummary?.accountValue || "100000");
          const assetPositions = state.assetPositions || [];

          for (let i = 0; i < assetPositions.length; i++) {
            const ap = assetPositions[i];
            const pos = ap.position;
            if (!pos) continue;

            const szi = parseFloat(pos.szi || "0");
            if (szi === 0) continue;

            const coin = (pos.coin || "").toUpperCase();

            if (coinFilterMode === "ALLOWLIST" && allowedCoins.length > 0 && !allowedCoins.includes(coin)) continue;
            if (coinFilterMode === "BLOCKLIST" && blockedCoins.length > 0 && blockedCoins.includes(coin)) continue;

            const entryPx = parseFloat(pos.entryPx || "0");
            const posLev = pos.leverage?.value || maxLev;
            const upnl = parseFloat(pos.unrealizedPnl || "0");
            const side: "LONG" | "SHORT" = szi > 0 ? "LONG" : "SHORT";

            const ratio = (userCapital / Math.max(traderAccountValue, 1000)) * riskMultiplier;
            const userSz = Math.abs(szi) * ratio;
            const userUpnl = upnl * (userCapital / Math.max(traderAccountValue, 1000)) * riskMultiplier;
            const usdValue = userSz * entryPx;
            const pnlPct = usdValue > 0 ? (userUpnl / (usdValue / posLev)) * 100 : 0;

            const coinTimes = fillsMapByCoin[coin] || [];
            const openTime = coinTimes.length > 0
              ? Math.min(...coinTimes)
              : effectiveJoinedAt > 0 ? effectiveJoinedAt : Date.now() - 7200000;

            if (!copyExisting && effectiveJoinedAt > 0 && openTime < effectiveJoinedAt) continue;
            if (resetTime > 0 && openTime < resetTime) continue;

            const tradeId = `open_${t.address.slice(0, 6)}_${coin}_${i}`;

            // Si fue rechazada por el usuario, omitir
            if (rejectedSet.has(tradeId)) continue;

            // Determinar si está aprobada o requiere validación
            let tradeStatus: "OPEN" | "PENDING_APPROVAL" = "OPEN";
            if (requiresApproval && !approvedSet.has(tradeId)) {
              tradeStatus = "PENDING_APPROVAL";
            }

            const now = Date.now();
            const durationMs = Math.max(60000, now - openTime);

            traderTrades.push({
              id: tradeId,
              timestamp: now,
              timeStr: tradeStatus === "PENDING_APPROVAL" ? `⏳ Esperando Aprobación` : `En vivo • ${formatShortDateTime(openTime)}`,
              openTimestamp: openTime,
              closeTimestamp: undefined,
              openTimeStr: formatDateTime(openTime),
              closeTimeStr: tradeStatus === "PENDING_APPROVAL" ? "Pendiente Validación 📱" : "En mercado 🟢",
              durationStr: `Abierta hace ${formatDuration(durationMs)}`,
              traderName: t.alias ? `${t.alias} (${t.name})` : t.name,
              traderAddr: t.address,
              coin: pos.coin,
              dir: side === "LONG" ? "Open Long" : "Open Short",
              side,
              status: tradeStatus,
              entryPx,
              markPx: entryPx,
              size: userSz,
              usdValue,
              leverage: posLev,
              pnl: tradeStatus === "PENDING_APPROVAL" ? 0 : userUpnl,
              pnlPct: tradeStatus === "PENDING_APPROVAL" ? 0 : pnlPct,
            });
          }
        }
      } catch (err) {
        console.error(`Error processing trades for ${t.name}:`, err);
      }

      return traderTrades;
    })
  );

  // Unificar y ordenar por fecha más reciente
  const allTrades = traderResults.flat();
  return allTrades.sort((a, b) => b.timestamp - a.timestamp);
}
