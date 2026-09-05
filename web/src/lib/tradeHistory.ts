import { UserProfile, UnifiedTrade, TraderConfig } from "./types";
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

  const targetTraders: TraderConfig[] = (profile.trading_mode === "REAL" && profile.real_traders && profile.real_traders.length > 0)
    ? profile.real_traders
    : (profile.traders || []);

  const resetTime = getResetTimestamp();
  const requiresApproval = profile.global_risk?.execution_mode === "TELEGRAM_APPROVAL";

  // Sincronizar acciones de aprobación desde el servidor
  await syncServerTradeActions().catch(() => {});
  const approvedSet = new Set(getApprovedTradeIds());
  const rejectedSet = new Set(getRejectedTradeIds());

  // =========================================================================
  // CASO 1: MODO REAL (Trades 100% reales ejecutados en la billetera on-chain)
  // =========================================================================
  if (profile.trading_mode === "REAL" && profile.wallet_address) {
    try {
      const userAddr = profile.wallet_address;

      // 1. Consultar en paralelo: Fills del usuario, estado de cuenta del usuario, y fills de los líderes
      const [userFillsRes, userStateRes, ...leaderFillsResponses] = await Promise.all([
        fetch(HYPERLIQUID_INFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "userFills", user: userAddr }),
        }).catch(() => null),
        fetch(HYPERLIQUID_INFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "clearinghouseState", user: userAddr }),
        }).catch(() => null),
        ...targetTraders.map((t) =>
          fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "userFills", user: t.address }),
          }).catch(() => null)
        ),
      ]);

      // 2. Procesar auditorías de líderes y almacenar sus fills para correlación
      const leaderFillsMap: Record<string, any[]> = {};
      for (let i = 0; i < targetTraders.length; i++) {
        const t = targetTraders[i];
        const res = leaderFillsResponses[i];
        if (res && res.ok) {
          const fills = await res.json().catch(() => []);
          if (Array.isArray(fills)) {
            leaderFillsMap[t.address.toLowerCase()] = fills;

            let leaderWins = 0;
            let leaderLosses = 0;
            let leaderGrossProfit = 0;
            let leaderGrossLoss = 0;
            let leaderNetPnl = 0;

            fills.forEach((f: any) => {
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
          }
        }
      }

      // 3. Procesar Fills Reales del Usuario
      const userTrades: UnifiedTrade[] = [];
      let rawUserFills: any[] = [];
      if (userFillsRes && userFillsRes.ok) {
        const json = await userFillsRes.json().catch(() => []);
        if (Array.isArray(json)) rawUserFills = json;
      }

      // Ordenar cronológicamente para reconstruir aperturas / cierres
      const sortedUserFills = [...rawUserFills].sort((a, b) => (a.time || 0) - (b.time || 0));

      // Mapa para registrar aperturas por moneda
      const openFillsByCoin: Record<string, any[]> = {};
      sortedUserFills.forEach((f) => {
        const coin = (f.coin || "").toUpperCase();
        if (!openFillsByCoin[coin]) openFillsByCoin[coin] = [];
        openFillsByCoin[coin].push(f);
      });

      // Procesar cada fill cerrado
      for (const uf of sortedUserFills) {
        const closeTime = uf.time || 0;
        if (resetTime > 0 && closeTime < resetTime) continue;

        const cp = parseFloat(uf.closedPnl || "0");
        const dir = uf.dir || (uf.side === "B" ? "Buy" : "Sell");
        const dirLower = dir.toLowerCase();
        const isClosed = Math.abs(cp) > 0.00001 || dirLower.includes("close");

        // Si no es un fill de cierre ni tiene PnL cerrado, era una entrada de posición
        if (!isClosed) continue;

        const coin = (uf.coin || "").toUpperCase();
        const px = parseFloat(uf.px || "0");
        const sz = parseFloat(uf.sz || "0");
        const fee = parseFloat(uf.fee || "0");

        // Correlacionar con el líder adecuado:
        // 1. Coincidencia por moneda y ventana temporal (dentro de 120s)
        let matchedTrader: TraderConfig | null = null;
        let minTimeDiff = Infinity;

        for (const t of targetTraders) {
          const lFills = leaderFillsMap[t.address.toLowerCase()] || [];
          for (const lf of lFills) {
            if ((lf.coin || "").toUpperCase() === coin) {
              const diff = Math.abs((lf.time || 0) - closeTime);
              if (diff < 120000 && diff < minTimeDiff) {
                minTimeDiff = diff;
                matchedTrader = t;
              }
            }
          }
        }

        // 2. Si no hubo coincidencia temporal cercana, asociar al líder que opera esa moneda
        if (!matchedTrader) {
          for (const t of targetTraders) {
            const allowed = (t.allowed_coins || []).map((c) => c.toUpperCase());
            const blocked = (t.blocked_coins || []).map((c) => c.toUpperCase());
            if (t.coin_filter_mode === "ALLOWLIST" && allowed.includes(coin)) {
              matchedTrader = t;
              break;
            }
            if (t.coin_filter_mode !== "BLOCKLIST" || !blocked.includes(coin)) {
              if (!matchedTrader) matchedTrader = t;
            }
          }
        }

        // 3. Fallback a primer trader disponible si no se determinó
        if (!matchedTrader && targetTraders.length > 0) {
          matchedTrader = targetTraders[0];
        }

        // Buscar el fill de apertura correspondiente en la misma moneda previo a closeTime
        const coinFills = openFillsByCoin[coin] || [];
        const prevFills = coinFills.filter((f) => (f.time || 0) < closeTime);
        const openFill = prevFills.length > 0 ? prevFills[prevFills.length - 1] : null;
        const openTime = openFill ? (openFill.time || 0) : Math.max(0, closeTime - 1800000);
        const entryPx = openFill ? parseFloat(openFill.px || "0") : px;
        const durationMs = Math.max(60000, closeTime - openTime);

        // Identificar dirección:
        // En HL: "Close Long" proviene de vender (Side A), pero la operación original era LONG.
        // "Close Short" proviene de comprar (Side B), pero la operación original era SHORT.
        const isLong = dirLower.includes("long") ? true : dirLower.includes("short") ? false : uf.side === "B";
        const side: "LONG" | "SHORT" = isLong ? "LONG" : "SHORT";

        const lev = matchedTrader?.max_leverage || 10;
        const usdValue = sz * px;
        const marginUSD = lev > 0 ? usdValue / lev : usdValue;
        const pnlPct = marginUSD > 0 ? (cp / marginUSD) * 100 : 0;

        const tradeId = `real_${uf.hash || uf.tid || `${coin}_${closeTime}`}`;

        userTrades.push({
          id: tradeId,
          timestamp: closeTime,
          timeStr: formatShortDateTime(closeTime),
          openTimestamp: openTime,
          closeTimestamp: closeTime,
          openTimeStr: formatDateTime(openTime),
          closeTimeStr: formatDateTime(closeTime),
          durationStr: formatDuration(durationMs),
          traderName: matchedTrader ? (matchedTrader.alias ? `${matchedTrader.alias} (${matchedTrader.name})` : matchedTrader.name) : "Operación de Billetera",
          traderAddr: matchedTrader ? matchedTrader.address : userAddr,
          coin: uf.coin,
          dir,
          side,
          status: "CLOSED",
          entryPx,
          exitPx: px,
          size: sz,
          usdValue,
          leverage: lev,
          pnl: cp,
          pnlPct,
          fee,
        });
      }

      // 4. Posiciones actualmente abiertas en la cuenta real del usuario
      if (userStateRes && userStateRes.ok) {
        const userState = await userStateRes.json().catch(() => ({}));
        const assetPositions = userState.assetPositions || [];

        for (let i = 0; i < assetPositions.length; i++) {
          const ap = assetPositions[i];
          const pos = ap.position;
          if (!pos) continue;

          const szi = parseFloat(pos.szi || "0");
          if (Math.abs(szi) === 0) continue;

          const coin = (pos.coin || "").toUpperCase();
          const entryPx = parseFloat(pos.entryPx || "0");
          const posLev = pos.leverage?.value || 10;
          const upnl = parseFloat(pos.unrealizedPnl || "0");
          const side: "LONG" | "SHORT" = szi > 0 ? "LONG" : "SHORT";
          const sz = Math.abs(szi);
          const usdValue = sz * entryPx;
          const marginUSD = posLev > 0 ? usdValue / posLev : usdValue;
          const pnlPct = marginUSD > 0 ? (upnl / marginUSD) * 100 : 0;

          // Correlacionar posición abierta con líder
          let matchedTrader: TraderConfig | null = null;
          for (const t of targetTraders) {
            const allowed = (t.allowed_coins || []).map((c) => c.toUpperCase());
            const blocked = (t.blocked_coins || []).map((c) => c.toUpperCase());
            if (t.coin_filter_mode === "ALLOWLIST" && allowed.includes(coin)) {
              matchedTrader = t;
              break;
            }
            if (t.coin_filter_mode !== "BLOCKLIST" || !blocked.includes(coin)) {
              if (!matchedTrader) matchedTrader = t;
            }
          }
          if (!matchedTrader && targetTraders.length > 0) matchedTrader = targetTraders[0];

          // Buscar cuándo se abrió en los fills del usuario
          const coinFills = openFillsByCoin[coin] || [];
          const openTime = coinFills.length > 0
            ? coinFills[coinFills.length - 1].time || Date.now() - 3600000
            : Date.now() - 3600000;

          const now = Date.now();
          const durationMs = Math.max(60000, now - openTime);
          const tradeId = `real_open_${coin}_${i}`;

          let tradeStatus: "OPEN" | "PENDING_APPROVAL" = "OPEN";
          if (requiresApproval && !approvedSet.has(tradeId)) {
            tradeStatus = "PENDING_APPROVAL";
          }

          userTrades.push({
            id: tradeId,
            timestamp: now,
            timeStr: tradeStatus === "PENDING_APPROVAL" ? `⏳ Esperando Aprobación` : `En vivo • ${formatShortDateTime(openTime)}`,
            openTimestamp: openTime,
            closeTimestamp: undefined,
            openTimeStr: formatDateTime(openTime),
            closeTimeStr: tradeStatus === "PENDING_APPROVAL" ? "Pendiente Validación 📱" : "En mercado 🟢",
            durationStr: `Abierta hace ${formatDuration(durationMs)}`,
            traderName: matchedTrader ? (matchedTrader.alias ? `${matchedTrader.alias} (${matchedTrader.name})` : matchedTrader.name) : "Operación de Billetera",
            traderAddr: matchedTrader ? matchedTrader.address : userAddr,
            coin: pos.coin,
            dir: side === "LONG" ? "Open Long" : "Open Short",
            side,
            status: tradeStatus,
            entryPx,
            markPx: entryPx,
            size: sz,
            usdValue,
            leverage: posLev,
            pnl: tradeStatus === "PENDING_APPROVAL" ? 0 : upnl,
            pnlPct: tradeStatus === "PENDING_APPROVAL" ? 0 : pnlPct,
          });
        }
      }

      return userTrades.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      console.error("Error cargando historial de trading real:", err);
      return [];
    }
  }

  // =========================================================================
  // CASO 2: MODO DEMO
  // =========================================================================
  // Si el usuario tiene trade_history guardado en su perfil, usarlo directamente
  if (profile.trade_history && profile.trade_history.length > 0) {
    const demoTrades: UnifiedTrade[] = profile.trade_history.map((item, idx) => {
      const ts = new Date(item.time).getTime() || Date.now() - idx * 60000;
      const dirLower = (item.dir || "").toLowerCase();
      const isLong = dirLower.includes("long");
      const side: "LONG" | "SHORT" = isLong ? "LONG" : "SHORT";
      const isClosed = item.pnl !== undefined || dirLower.includes("close");
      const pnl = item.pnl || 0;
      const usdValue = item.px * item.sz;
      const lev = 10;
      const marginUSD = usdValue / lev;
      const pnlPct = marginUSD > 0 ? (pnl / marginUSD) * 100 : 0;

      // Buscar trader en la cesta
      const matched = targetTraders.find((t) =>
        t.name.toLowerCase() === item.trader.toLowerCase() ||
        (t.alias && t.alias.toLowerCase() === item.trader.toLowerCase())
      );

      return {
        id: `demo_${ts}_${idx}`,
        timestamp: ts,
        timeStr: formatShortDateTime(ts),
        openTimestamp: ts - 1800000,
        closeTimestamp: isClosed ? ts : undefined,
        openTimeStr: formatDateTime(ts - 1800000),
        closeTimeStr: isClosed ? formatDateTime(ts) : "En mercado 🟢",
        durationStr: formatDuration(1800000),
        traderName: matched ? (matched.alias ? `${matched.alias} (${matched.name})` : matched.name) : item.trader,
        traderAddr: matched ? matched.address : `demo_${item.trader}`,
        coin: item.coin,
        dir: item.dir,
        side,
        status: isClosed ? "CLOSED" : "OPEN",
        entryPx: item.px,
        exitPx: item.px,
        size: item.sz,
        usdValue,
        leverage: lev,
        pnl,
        pnlPct,
      };
    });

    return demoTrades.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Fallback para DEMO cuando trade_history está vacío:
  // Simular a partir de las operaciones de los líderes desde joined_at
  if (targetTraders.length === 0) return [];

  const baseCapital = profile.cash_balance || 10000;
  const profileCreatedTs = (profile as any).created_at ? new Date((profile as any).created_at).getTime() : 0;

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

            if (rejectedSet.has(tradeId)) continue;

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
