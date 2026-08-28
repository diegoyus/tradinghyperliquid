import { NextResponse } from "next/server";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

// Caché en memoria para los nombres de tokens Spot y Perpetuos
let symbolMapCache: Record<string, string> = {};
let lastCacheTime = 0;

async function getSymbolMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(symbolMapCache).length > 0 && now - lastCacheTime < 1000 * 60 * 30) {
    return symbolMapCache;
  }

  try {
    const map: Record<string, string> = {};

    // 1. Obtener nombres de perpetuos (Perps)
    const perpsRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
    });
    if (perpsRes.ok) {
      const perpsData = await perpsRes.json();
      (perpsData.universe || []).forEach((u: any, idx: number) => {
        if (u?.name) {
          map[u.name] = u.name;
          map[`${idx}`] = u.name;
        }
      });
    }

    // 2. Obtener nombres de tokens Spot
    const spotRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotMeta" }),
    });
    if (spotRes.ok) {
      const spotData = await spotRes.json();
      const tokens = spotData.tokens || [];
      const universe = spotData.universe || [];

      // Mapear universe spot pairs
      universe.forEach((pair: any, idx: number) => {
        const baseIdx = pair.tokens?.[0];
        const baseName = tokens[baseIdx]?.name || `SPOT-${idx}`;
        map[`@${idx}`] = baseName;
        map[`@${idx + 1}`] = baseName;
        map[`${idx + 10000}`] = baseName;
      });

      // Mapear tokens spot individuales
      tokens.forEach((t: any, idx: number) => {
        if (t?.name) {
          map[`@${t.index}`] = t.name;
          map[`@${idx}`] = t.name;
        }
      });
    }

    symbolMapCache = map;
    lastCacheTime = now;
    return map;
  } catch (e) {
    console.error("Error al cargar symbolMap:", e);
    return symbolMapCache;
  }
}

function resolveCoinSymbol(rawCoin: string, symbolMap: Record<string, string>): string {
  if (!rawCoin) return "UNKNOWN";
  const clean = String(rawCoin).trim();
  if (symbolMap[clean]) return symbolMap[clean];

  // Si empieza por @ o # (token Spot de Hyperliquid)
  if (clean.startsWith("@") || clean.startsWith("#")) {
    const spotIndex = clean.slice(1);
    if (symbolMap[clean]) return symbolMap[clean];
    if (symbolMap[`@${spotIndex}`]) return symbolMap[`@${spotIndex}`];
    if (symbolMap[spotIndex]) return symbolMap[spotIndex];
    return `SPOT-${spotIndex}`;
  }

  // Si es un índice numérico
  if (/^\d+$/.test(clean) && symbolMap[clean]) {
    return symbolMap[clean];
  }

  return clean.toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json(
        { success: false, error: "Dirección de billetera inválida (debe empezar por 0x y tener 42 caracteres)." },
        { status: 400 }
      );
    }

    const cleanAddress = address.trim().toLowerCase();
    const symbolMap = await getSymbolMap();

    // 1. Consultar estado actual (saldo y posiciones abiertas)
    const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userState", user: cleanAddress }),
    });
    const userState = stateRes.ok ? await stateRes.json() : {};

    // 2. Consultar historial COMPLETO de órdenes (fills)
    const fillsRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userFills", user: cleanAddress }),
    });
    const rawFills = fillsRes.ok && Array.isArray(await fillsRes.json())
      ? await (await fetch(HYPERLIQUID_INFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "userFills", user: cleanAddress }),
        })).json()
      : [];

    const marginSummary = userState?.marginSummary || {};
    const accountValue = parseFloat(marginSummary?.accountValue || "0");
    const totalMarginUsed = parseFloat(marginSummary?.totalMarginUsed || "0");

    // Procesar posiciones abiertas con nombres legibles
    const rawPositions = userState?.assetPositions || [];
    const openPositions = rawPositions.map((p: any) => {
      const pos = p.position || {};
      const szi = parseFloat(pos.szi || "0");
      const coinName = resolveCoinSymbol(pos.coin, symbolMap);
      return {
        coin: coinName,
        side: szi > 0 ? "LONG" : "SHORT",
        size: Math.abs(szi),
        entryPx: parseFloat(pos.entryPx || "0"),
        unrealizedPnl: parseFloat(pos.unrealizedPnl || "0"),
        leverage: pos.leverage?.value || 10,
        marginUsed: parseFloat(pos.marginUsed || "0"),
      };
    });

    // Procesar TODO el track record histórico
    const coinCounts: Record<string, number> = {};
    const closedTrades: number[] = [];

    const formattedTrades = rawFills.map((f: any, idx: number) => {
      const pnl = parseFloat(f.closedPnl || "0");
      const coinName = resolveCoinSymbol(f.coin, symbolMap);
      coinCounts[coinName] = (coinCounts[coinName] || 0) + 1;

      if (pnl !== 0) {
        closedTrades.push(pnl);
      }

      return {
        id: idx + 1,
        time: new Date(f.time).toLocaleString("es-ES", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        timestamp: f.time,
        coin: coinName,
        dir: f.dir || "Trade",
        side: f.side === "B" ? "COMPRA" : "VENTA",
        px: parseFloat(f.px || "0"),
        sz: parseFloat(f.sz || "0"),
        closedPnl: pnl,
        fee: parseFloat(f.fee || "0"),
        hash: f.hash || "",
      };
    });

    // Estadísticas completas
    const wins = closedTrades.filter((p) => p > 0);
    const losses = closedTrades.filter((p) => p < 0);
    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const grossProfit = wins.reduce((acc, val) => acc + val, 0);
    const grossLoss = Math.abs(losses.reduce((acc, val) => acc + val, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;
    const netPnlTotal = closedTrades.reduce((acc, val) => acc + val, 0);

    // Curva de PnL acumulada histórica del trader
    let runningPnl = 0;
    const pnlCurve: { tradeIndex: number; time: string; pnl: number }[] = [];
    const step = Math.max(1, Math.floor(closedTrades.length / 50));
    [...closedTrades].reverse().forEach((pnl, i) => {
      runningPnl += pnl;
      if (i % step === 0 || i === closedTrades.length - 1) {
        pnlCurve.push({
          tradeIndex: i + 1,
          time: `#${i + 1}`,
          pnl: Math.round(runningPnl),
        });
      }
    });

    // Estimación de Max Drawdown histórico
    let peak = 10000;
    let currentBalance = 10000;
    let maxDrawdownPct = 0;
    for (const pnl of [...closedTrades].reverse()) {
      const ratio = accountValue > 0 ? 10000 / accountValue : 0.1;
      currentBalance += pnl * ratio;
      if (currentBalance > peak) peak = currentBalance;
      const dd = ((peak - currentBalance) / peak) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    // Calcular Puntuación Algorítmica (0.0 a 10.0)
    let score = 5.0;
    if (winRate >= 90) score += 2.5;
    else if (winRate >= 75) score += 1.8;
    else if (winRate >= 60) score += 1.0;

    if (maxDrawdownPct <= 5) score += 1.5;
    else if (maxDrawdownPct <= 15) score += 0.8;
    else score -= 1.5;

    if (profitFactor >= 5) score += 1.0;
    else if (profitFactor >= 2) score += 0.5;

    if (accountValue >= 50000) score += 0.5;
    score = Math.min(Math.max(score, 1.0), 9.9);

    // Activos más operados (con nombres resueltos)
    const topAssets = Object.entries(coinCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([coin, count]) => ({ coin, count }));

    return NextResponse.json({
      success: true,
      address: cleanAddress,
      accountValue,
      totalMarginUsed,
      score: score.toFixed(1),
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor.toFixed(2),
      maxDrawdownPct: maxDrawdownPct.toFixed(2),
      netPnlTotal,
      totalFills: rawFills.length,
      closedTradesCount: totalTrades,
      winningTradesCount: wins.length,
      losingTradesCount: losses.length,
      openPositions,
      topAssets,
      pnlCurve,
      allTrades: formattedTrades, // TODO EL TRACK RECORD HISTÓRICO
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
