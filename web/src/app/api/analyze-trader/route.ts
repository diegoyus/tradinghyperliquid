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

    const spotRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "spotMeta" }),
    });
    if (spotRes.ok) {
      const spotData = await spotRes.json();
      (spotData.tokens || []).forEach((t: any, idx: number) => {
        if (t?.name) {
          map[`@${t.index}`] = t.name;
          map[`@${idx}`] = t.name;
          map[`#${idx}`] = t.name;
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

  if (clean.startsWith("@") || clean.startsWith("#")) {
    const spotIndex = clean.slice(1);
    if (symbolMap[clean]) return symbolMap[clean];
    if (symbolMap[`@${spotIndex}`]) return symbolMap[`@${spotIndex}`];
    if (symbolMap[spotIndex]) return symbolMap[spotIndex];
    return `SPOT-${spotIndex}`;
  }

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

    // 1. Consultar estado en tiempo real (clearinghouseState)
    const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: cleanAddress }),
    });

    if (stateRes.status === 429) {
      return NextResponse.json(
        {
          success: false,
          isRateLimited: true,
          error: "⚠️ Límite de consultas de Hyperliquid alcanzado (HTTP 429). Tu IP ha superado temporalmente las peticiones por segundo. Espera 10-15 segundos para consultar de nuevo.",
        },
        { status: 429 }
      );
    }

    const userState = stateRes.ok ? await stateRes.json() : {};

    // 2. Consultar historial COMPLETO de órdenes (fills)
    const fillsRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userFills", user: cleanAddress }),
    });

    if (fillsRes.status === 429) {
      return NextResponse.json(
        {
          success: false,
          isRateLimited: true,
          error: "⚠️ Límite de consultas de Hyperliquid alcanzado (HTTP 429) al descargar el historial de trades. Espera 10-15 segundos.",
        },
        { status: 429 }
      );
    }

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
    const rawPositions = userState?.assetPositions || [];

    // Procesar posiciones abiertas con nombres legibles
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

    // Procesar todo el historial de trades
    const coinCounts: Record<string, number> = {};
    const closedTrades: { pnl: number; time: number; notional: number; fee: number }[] = [];

    const formattedTrades = rawFills.map((f: any, idx: number) => {
      const pnl = parseFloat(f.closedPnl || "0");
      const coinName = resolveCoinSymbol(f.coin, symbolMap);
      const px = parseFloat(f.px || "0");
      const sz = parseFloat(f.sz || "0");
      const notional = px * sz;
      const fee = parseFloat(f.fee || "0");

      coinCounts[coinName] = (coinCounts[coinName] || 0) + 1;

      if (pnl !== 0) {
        closedTrades.push({ pnl, time: f.time, notional, fee });
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
        px,
        sz,
        notionalUSD: notional,
        closedPnl: pnl,
        fee,
        hash: f.hash || "",
      };
    });

    // Métricas Estadísticas Base
    const pnls = closedTrades.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const totalTrades = pnls.length;
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const grossProfit = wins.reduce((acc, val) => acc + val, 0);
    const grossLoss = Math.abs(losses.reduce((acc, val) => acc + val, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;
    const netPnlTotal = pnls.reduce((acc, val) => acc + val, 0);

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 99.0;

    // 1. EXPECTATIVA MATEMÁTICA POR TRADE ($)
    const winProbability = winRate / 100;
    const lossProbability = (100 - winRate) / 100;
    const expectancyPerTrade = (winProbability * avgWin) - (lossProbability * avgLoss);

    // 2. RACHA MÁXIMA DE GANANCIAS Y PÉRDIDAS CONSECUTIVAS
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const p of pnls) {
      if (p > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
      } else if (p < 0) {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
      }
    }

    // 3. AUDITORÍA DE PÉRDIDAS FLOTANTES & MARGEN
    const totalUnrealizedPnl = openPositions.reduce((acc: number, p: any) => acc + (p.unrealizedPnl || 0), 0);
    const floatingLossPct = accountValue > 0 ? (totalUnrealizedPnl / accountValue) * 100 : 0;
    const marginUtilizationPct = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;

    // 4. RATIO DE SORTINO & CALMAR RATIO (Métricas de Hedge Fund)
    const downsideReturns = losses.map((p) => Math.pow(p, 2));
    const downsideDev = downsideReturns.length > 0 ? Math.sqrt(downsideReturns.reduce((a, b) => a + b, 0) / totalTrades) : 1;
    const sortinoRatio = downsideDev > 0 ? Math.max(0, netPnlTotal / (downsideDev * Math.sqrt(totalTrades))) : 9.9;

    // Curva de PnL y Drawdown Máximo
    let peak = 10000;
    let currentBalance = 10000;
    let maxDrawdownPct = 0;
    let peakUSD = 0;
    let currUSD = 0;
    let maxDrawdownUSD = 0;

    const pnlCurve: { tradeIndex: number; time: string; pnl: number }[] = [];
    const step = Math.max(1, Math.floor(pnls.length / 50));
    let runningPnl = 0;

    [...pnls].reverse().forEach((pnl, i) => {
      runningPnl += pnl;
      const ratio = accountValue > 0 ? 10000 / accountValue : 0.1;
      currentBalance += pnl * ratio;
      if (currentBalance > peak) peak = currentBalance;
      const dd = ((peak - currentBalance) / peak) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;

      currUSD += pnl;
      if (currUSD > peakUSD) peakUSD = currUSD;
      const ddUSD = peakUSD - currUSD;
      if (ddUSD > maxDrawdownUSD) maxDrawdownUSD = ddUSD;

      if (i % step === 0 || i === pnls.length - 1) {
        pnlCurve.push({
          tradeIndex: i + 1,
          time: `#${i + 1}`,
          pnl: Math.round(runningPnl),
        });
      }
    });

    const calmarRatio = maxDrawdownUSD > 0 ? (netPnlTotal / maxDrawdownUSD) : 99.0;

    // 5. ESTILO OPERATIVO ESTIMADO
    let tradingStyle = "Intradiario / Scalping";
    if (totalTrades >= 500) tradingStyle = "⚡ Alta Frecuencia / Scalping Cuantitativo";
    else if (totalTrades >= 100) tradingStyle = "⏱️ Day Trading Intradiario";
    else tradingStyle = "🌊 Swing Trading de Posición";

    // ==========================================
    // 🕵️‍♂️ BATERÍA DE 6 TESTS FORENSES Y ANOMALÍAS
    // ==========================================
    const anomalies: { test: string; status: "PASS" | "WARNING" | "FAIL"; detail: string; severity: string }[] = [];

    // Test 1: Concentración de Beneficios (Lucky Trade)
    const maxWin = wins.length > 0 ? Math.max(...wins) : 0;
    const concentrationPct = grossProfit > 0 ? (maxWin / grossProfit) * 100 : 0;
    if (concentrationPct >= 45.0) {
      anomalies.push({
        test: "Dependencia de Golpe de Suerte (Lucky Trade)",
        status: "FAIL",
        detail: `El mayor trade individual aportó $${maxWin.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD (${concentrationPct.toFixed(1)}% del beneficio total). Beneficio excesivamente concentrado.`,
        severity: "CRÍTICA",
      });
    } else if (concentrationPct >= 25.0) {
      anomalies.push({
        test: "Concentración Moderada de Beneficios",
        status: "WARNING",
        detail: `El mayor trade representa el ${concentrationPct.toFixed(1)}% de las ganancias totales.`,
        severity: "MEDIA",
      });
    } else {
      anomalies.push({
        test: "Distribución Equilibrada de Ganancias",
        status: "PASS",
        detail: `Excelente: Ganancias uniformes. Ningún trade individual supera el ${concentrationPct.toFixed(1)}% del total.`,
        severity: "NINGUNA",
      });
    }

    // Test 2: Detector de Patrón Martingala
    let martingaleSpikes = 0;
    for (let i = 1; i < formattedTrades.length; i++) {
      const prev = formattedTrades[i - 1];
      const curr = formattedTrades[i];
      if (prev.closedPnl < 0 && curr.notionalUSD >= prev.notionalUSD * 2.2) {
        martingaleSpikes++;
      }
    }
    if (martingaleSpikes >= 3) {
      anomalies.push({
        test: "Detector de Martingala / Doblado de Posición",
        status: "FAIL",
        detail: `Se detectaron ${martingaleSpikes} aumentos bruscos de tamaño tras pérdidas. Patrón de riesgo de quiebra.`,
        severity: "ALTA",
      });
    } else {
      anomalies.push({
        test: "Gestión de Tamaño Disciplinada (Anti-Martingala)",
        status: "PASS",
        detail: "No duplica posiciones tras pérdidas. Dimensionamiento de posición profesional.",
        severity: "NINGUNA",
      });
    }

    // Test 3: Pérdidas Flotantes Ocultas en Tiempo Real (Anti-Bagholding)
    if (totalUnrealizedPnl < 0 && Math.abs(floatingLossPct) >= 10.0) {
      anomalies.push({
        test: "Pérdidas Flotantes Ocultas (Bagholding)",
        status: "FAIL",
        detail: `Mantiene -$${Math.abs(totalUnrealizedPnl).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD (${Math.abs(floatingLossPct).toFixed(1)}% del capital) en pérdidas abiertas sin cerrar.`,
        severity: "CRÍTICA",
      });
    } else {
      anomalies.push({
        test: "Pérdidas Flotantes Ocultas",
        status: "PASS",
        detail: totalUnrealizedPnl >= 0 ? "Sin pérdidas abiertas en curso." : `Pérdida flotante ínfima (${Math.abs(floatingLossPct).toFixed(2)}%). Control de stop-loss adecuado.`,
        severity: "NINGUNA",
      });
    }

    // Test 4: Asimetría de Pérdida Media vs Ganancia Media
    if (avgLoss >= avgWin * 4 && losses.length > 0) {
      anomalies.push({
        test: "Asimetría de Riesgo / Pérdida Media Desproporcionada",
        status: "WARNING",
        detail: `Pierde en promedio $${avgLoss.toFixed(0)} USD frente a $${avgWin.toFixed(0)} USD de ganancia media (Ratio ${winLossRatio.toFixed(2)}x).`,
        severity: "MEDIA",
      });
    } else {
      anomalies.push({
        test: "Ratio Riesgo / Beneficio",
        status: "PASS",
        detail: `Relación sana: +$${avgWin.toFixed(0)} ganancia media vs -$${avgLoss.toFixed(0)} pérdida media (${winLossRatio.toFixed(2)}x).`,
        severity: "NINGUNA",
      });
    }

    // Test 5: Utilización de Margen y Apalancamiento Extremo
    if (marginUtilizationPct >= 45.0) {
      anomalies.push({
        test: "Sobreapalancamiento de Margen",
        status: "FAIL",
        detail: `Margen en uso del ${marginUtilizationPct.toFixed(1)}%. Elevado riesgo de liquidación.`,
        severity: "ALTA",
      });
    } else {
      anomalies.push({
        test: "Margen Libre y Solvencia",
        status: "PASS",
        detail: `Margen en uso del ${marginUtilizationPct.toFixed(1)}%. Solvencia holgada para absorber volatilidad.`,
        severity: "NINGUNA",
      });
    }

    // Test 6: Resistencia a Rachas Adversas (Losing Streaks)
    if (maxConsecutiveLosses >= 6) {
      anomalies.push({
        test: "Tolerancia a Rachas Adversas",
        status: "WARNING",
        detail: `Racha histórica de ${maxConsecutiveLosses} pérdidas seguidas. Requiere stop-loss y apalancamiento conservador.`,
        severity: "BAJA",
      });
    } else {
      anomalies.push({
        test: "Control de Rachas Adversas",
        status: "PASS",
        detail: `Racha máxima de solo ${maxConsecutiveLosses} pérdidas consecutivas en su historial.`,
        severity: "NINGUNA",
      });
    }

    // PUNTUACIÓN CALIBRADA INSTITUCIONAL (0.0 a 10.0)
    let score = 5.0;
    if (winRate >= 90) score += 2.2;
    else if (winRate >= 75) score += 1.5;
    else if (winRate >= 60) score += 0.8;

    if (maxDrawdownPct <= 3) score += 1.5;
    else if (maxDrawdownPct <= 10) score += 0.8;
    else score -= 1.5;

    if (profitFactor >= 4) score += 1.0;
    else if (profitFactor >= 2) score += 0.5;

    if (expectancyPerTrade > 50) score += 0.5;
    if (sortinoRatio > 3.0) score += 0.5;

    anomalies.forEach((a) => {
      if (a.status === "FAIL") score -= a.severity === "CRÍTICA" ? 3.0 : 1.5;
      else if (a.status === "WARNING") score -= 0.6;
    });

    score = Math.min(Math.max(score, 1.0), 9.9);

    const topAssets = Object.entries(coinCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([coin, count]) => ({ coin, count }));

    return NextResponse.json({
      success: true,
      address: cleanAddress,
      accountValue,
      totalMarginUsed,
      marginUtilizationPct: marginUtilizationPct.toFixed(1),
      totalUnrealizedPnl,
      floatingLossPct: floatingLossPct.toFixed(1),
      score: score.toFixed(1),
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      winLossRatio: winLossRatio.toFixed(2),
      expectancyPerTrade: expectancyPerTrade.toFixed(2),
      maxConsecutiveWins,
      maxConsecutiveLosses,
      sortinoRatio: sortinoRatio.toFixed(2),
      calmarRatio: calmarRatio.toFixed(2),
      tradingStyle,
      maxDrawdownPct: maxDrawdownPct.toFixed(2),
      maxDrawdownUSD: maxDrawdownUSD.toFixed(2),
      netPnlTotal,
      totalFills: rawFills.length,
      closedTradesCount: totalTrades,
      winningTradesCount: wins.length,
      losingTradesCount: losses.length,
      concentrationPct: concentrationPct.toFixed(1),
      maxWin: maxWin.toFixed(2),
      openPositions,
      topAssets,
      pnlCurve,
      anomalies,
      allTrades: formattedTrades,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
