import { NextResponse } from "next/server";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

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

    // 1. Consultar estado actual (saldo y posiciones abiertas)
    const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userState", user: cleanAddress }),
    });
    const userState = stateRes.ok ? await stateRes.json() : {};

    // 2. Consultar historial de órdenes (fills)
    const fillsRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userFills", user: cleanAddress }),
    });
    const fills = fillsRes.ok && Array.isArray(await fillsRes.json()) ? await (await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userFills", user: cleanAddress }),
    })).json() : [];

    const marginSummary = userState?.marginSummary || {};
    const accountValue = parseFloat(marginSummary?.accountValue || "0");
    const totalMarginUsed = parseFloat(marginSummary?.totalMarginUsed || "0");

    // Procesar posiciones abiertas
    const rawPositions = userState?.assetPositions || [];
    const openPositions = rawPositions.map((p: any) => {
      const pos = p.position || {};
      const szi = parseFloat(pos.szi || "0");
      return {
        coin: pos.coin || "N/A",
        side: szi > 0 ? "LONG" : "SHORT",
        size: Math.abs(szi),
        entryPx: parseFloat(pos.entryPx || "0"),
        unrealizedPnl: parseFloat(pos.unrealizedPnl || "0"),
        leverage: pos.leverage?.value || 10,
        marginUsed: parseFloat(pos.marginUsed || "0"),
      };
    });

    // Procesar historial de trades (últimos 500)
    const recentFills = fills.slice(0, 500);
    const coinCounts: Record<string, number> = {};
    const closedTrades: number[] = [];

    const formattedTrades = recentFills.map((f: any) => {
      const pnl = parseFloat(f.closedPnl || "0");
      const coin = f.coin || "N/A";
      coinCounts[coin] = (coinCounts[coin] || 0) + 1;

      if (pnl !== 0) {
        closedTrades.push(pnl);
      }

      return {
        time: new Date(f.time).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }),
        coin: coin,
        dir: f.dir || "Trade",
        side: f.side === "B" ? "COMPRA" : "VENTA",
        px: parseFloat(f.px || "0"),
        sz: parseFloat(f.sz || "0"),
        closedPnl: pnl,
        fee: parseFloat(f.fee || "0"),
      };
    });

    // Estadísticas
    const wins = closedTrades.filter((p) => p > 0);
    const losses = closedTrades.filter((p) => p < 0);
    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const grossProfit = wins.reduce((acc, val) => acc + val, 0);
    const grossLoss = Math.abs(losses.reduce((acc, val) => acc + val, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;

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

    // Activos más operados
    const topAssets = Object.entries(coinCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
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
      totalFills: fills.length,
      closedTradesCount: totalTrades,
      winningTradesCount: wins.length,
      losingTradesCount: losses.length,
      openPositions,
      topAssets,
      recentTrades: formattedTrades.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
