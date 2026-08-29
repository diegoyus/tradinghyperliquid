import { NextResponse } from "next/server";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

// Caché para resolver nombres de símbolos
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
  } catch {
    return symbolMapCache;
  }
}

function resolveCoinSymbol(rawCoin: string, symbolMap: Record<string, string>): string {
  if (!rawCoin) return "UNKNOWN";
  const clean = String(rawCoin).trim();
  if (symbolMap[clean]) return symbolMap[clean];
  if (clean.startsWith("@") || clean.startsWith("#")) {
    const idx = clean.slice(1);
    if (symbolMap[clean]) return symbolMap[clean];
    if (symbolMap[`@${idx}`]) return symbolMap[`@${idx}`];
    return `SPOT-${idx}`;
  }
  if (/^\d+$/.test(clean) && symbolMap[clean]) return symbolMap[clean];
  return clean.toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json(
        { success: false, error: "Dirección inválida de 42 caracteres." },
        { status: 400 }
      );
    }

    const cleanAddress = address.trim().toLowerCase();
    const symbolMap = await getSymbolMap();

    // 1. Estado en tiempo real
    const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: cleanAddress }),
    });
    const userState = stateRes.ok ? await stateRes.json() : {};

    // 2. Historial de órdenes completo
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

    const accountValue = parseFloat(userState?.marginSummary?.accountValue || "0");
    const totalMarginUsed = parseFloat(userState?.marginSummary?.totalMarginUsed || "0");
    const assetPositions = userState?.assetPositions || [];

    // Formatear todos los movimientos
    const allTrades = rawFills.map((f: any, idx: number) => {
      const pnl = parseFloat(f.closedPnl || "0");
      const coin = resolveCoinSymbol(f.coin, symbolMap);
      return {
        id: idx + 1,
        time: new Date(f.time).toLocaleString("es-ES"),
        timestamp: f.time,
        coin,
        dir: f.dir || "Trade",
        side: f.side === "B" ? "COMPRA" : "VENTA",
        px: parseFloat(f.px || "0"),
        sz: parseFloat(f.sz || "0"),
        notionalUSD: parseFloat(f.px || "0") * parseFloat(f.sz || "0"),
        closedPnl: pnl,
        fee: parseFloat(f.fee || "0"),
      };
    });

    const closedTrades = allTrades.filter((t: any) => t.closedPnl !== 0);
    const wins = closedTrades.filter((t: any) => t.closedPnl > 0);
    const losses = closedTrades.filter((t: any) => t.closedPnl < 0);

    const grossProfit = wins.reduce((acc: number, t: any) => acc + t.closedPnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc: number, t: any) => acc + t.closedPnl, 0));
    const netPnl = closedTrades.reduce((acc: number, t: any) => acc + t.closedPnl, 0);
    const totalTrades = closedTrades.length;
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;

    // ==========================================
    // 🕵️‍♂️ BATERÍA DE TESTS FORENSES Y ANOMALÍAS
    // ==========================================
    const anomalies: { test: string; status: "PASS" | "WARNING" | "FAIL"; detail: string; severity: string }[] = [];

    // Test 1: Concentración de Beneficios ("Golpe de Suerte Único")
    const maxWin = wins.length > 0 ? Math.max(...wins.map((t: any) => t.closedPnl)) : 0;
    const concentrationPct = grossProfit > 0 ? (maxWin / grossProfit) * 100 : 0;

    if (concentrationPct >= 50.0) {
      anomalies.push({
        test: "Dependencia de Golpe de Suerte (Lucky Trade)",
        status: "FAIL",
        detail: `El mayor trade individual generó $${maxWin.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD (${concentrationPct.toFixed(1)}% del beneficio total). La rentabilidad no es orgánica.`,
        severity: "CRÍTICA",
      });
    } else if (concentrationPct >= 30.0) {
      anomalies.push({
        test: "Dependencia de Golpe de Suerte (Lucky Trade)",
        status: "WARNING",
        detail: `El mayor trade representa el ${concentrationPct.toFixed(1)}% de las ganancias totales. Hay cierta concentración de beneficio.`,
        severity: "MEDIA",
      });
    } else {
      anomalies.push({
        test: "Distribución Equilibrada de Ganancias",
        status: "PASS",
        detail: `Excelente: Ningún trade individual supera el ${concentrationPct.toFixed(1)}% del beneficio total. Ganancias consistentes y distribuidas.`,
        severity: "NINGUNA",
      });
    }

    // Test 2: Detector de Patrón Martingala (Averaging Down agresivo)
    let martingaleSpikes = 0;
    for (let i = 1; i < allTrades.length; i++) {
      const prev = allTrades[i - 1];
      const curr = allTrades[i];
      if (prev.closedPnl < 0 && curr.notionalUSD >= prev.notionalUSD * 2.2) {
        martingaleSpikes++;
      }
    }

    if (martingaleSpikes >= 3) {
      anomalies.push({
        test: "Detector de Martingala / Doblado de Posición",
        status: "FAIL",
        detail: `Se detectaron ${martingaleSpikes} ocasiones donde el trader duplicó drásticamente el tamaño tras una pérdida. Alto riesgo de quiebra repentina.`,
        severity: "ALTA",
      });
    } else {
      anomalies.push({
        test: "Disciplina de Dimensionamiento (Anti-Martingala)",
        status: "PASS",
        detail: "No se detectaron aumentos exponenciales de posición tras pérdidas. Gestión de tamaño responsable.",
        severity: "NINGUNA",
      });
    }

    // Test 3: Pérdidas Flotantes Ocultas en Tiempo Real (Anti-Bagholding)
    const totalUnrealized = assetPositions.reduce((acc: number, p: any) => acc + parseFloat(p.position?.unrealizedPnl || "0"), 0);
    const floatingLossPct = accountValue > 0 ? (totalUnrealized / accountValue) * 100 : 0;

    if (totalUnrealized < 0 && Math.abs(floatingLossPct) >= 10.0) {
      anomalies.push({
        test: "Auditoría de Pérdidas Flotantes (Bagholding)",
        status: "FAIL",
        detail: `Pérdida abierta no cerrada de -$${Math.abs(totalUnrealized).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD (${Math.abs(floatingLossPct).toFixed(1)}% de la cuenta). Mantiene posiciones perdedoras vivas.`,
        severity: "CRÍTICA",
      });
    } else {
      anomalies.push({
        test: "Pérdidas Flotantes Ocultas",
        status: "PASS",
        detail: totalUnrealized >= 0 ? "Sin pérdidas abiertas en curso." : `Pérdida flotante ínfima (${Math.abs(floatingLossPct).toFixed(2)}% del capital). Control de riesgo sano.`,
        severity: "NINGUNA",
      });
    }

    // Test 4: Asimetría de Riesgo (Ganancia Media vs Pérdida Media)
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 99.0;

    if (avgLoss >= avgWin * 4 && losses.length > 0) {
      anomalies.push({
        test: "Asimetría de Riesgo / Pérdida Media Excesiva",
        status: "WARNING",
        detail: `Cuando pierde, el trader pierde en promedio $${avgLoss.toFixed(0)} USD frente a $${avgWin.toFixed(0)} USD de ganancia media (Ratio ${winLossRatio.toFixed(2)}x). Una sola mala racha borra muchos aciertos.`,
        severity: "MEDIA",
      });
    } else {
      anomalies.push({
        test: "Ratio Riesgo / Beneficio",
        status: "PASS",
        detail: `Relación equilibrada: Ganancia media de +$${avgWin.toFixed(0)} vs pérdida media de -$${avgLoss.toFixed(0)} (Ratio ${winLossRatio.toFixed(2)}x).`,
        severity: "NINGUNA",
      });
    }

    // Test 5: Utilización de Margen y Apalancamiento Máximo
    const marginUsagePct = accountValue > 0 ? (totalMarginUsed / accountValue) * 100 : 0;
    if (marginUsagePct >= 50.0) {
      anomalies.push({
        test: "Sobreapalancamiento de Margen",
        status: "FAIL",
        detail: `Utilización de margen del ${marginUsagePct.toFixed(1)}%. Muy cerca del umbral de liquidación forzosa.`,
        severity: "ALTA",
      });
    } else {
      anomalies.push({
        test: "Margen y Solvencia",
        status: "PASS",
        detail: `Margen en uso del ${marginUsagePct.toFixed(1)}%. Margen libre holgado para absorber volatilidad.`,
        severity: "NINGUNA",
      });
    }

    // ==========================================
    // 🎯 RE-PUNTUACIÓN FORENSE EXACTA (0.0 - 10.0)
    // ==========================================
    let forensicScore = 6.0;

    // Factores positivos
    if (winRate >= 95) forensicScore += 2.0;
    else if (winRate >= 80) forensicScore += 1.2;
    else if (winRate >= 70) forensicScore += 0.5;

    if (profitFactor >= 4.0) forensicScore += 1.2;
    else if (profitFactor >= 2.0) forensicScore += 0.6;

    if (totalTrades >= 50) forensicScore += 0.5;
    if (accountValue >= 50000) forensicScore += 0.3;

    // Penalizaciones por anomalías
    anomalies.forEach((a) => {
      if (a.status === "FAIL") {
        forensicScore -= a.severity === "CRÍTICA" ? 3.0 : 1.8;
      } else if (a.status === "WARNING") {
        forensicScore -= 0.8;
      }
    });

    forensicScore = Math.min(Math.max(forensicScore, 1.0), 9.9);

    // Veredicto final
    let forensicVerdict = "EXCELENTE";
    if (anomalies.some((a) => a.status === "FAIL")) {
      forensicVerdict = "RIESGOSO_CON_ANOMALÍAS";
    } else if (anomalies.some((a) => a.status === "WARNING")) {
      forensicVerdict = "ACEPTABLE_CON_PRECAUCIÓN";
    }

    return NextResponse.json({
      success: true,
      address: cleanAddress,
      accountValue,
      totalTrades,
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor.toFixed(2),
      netPnl,
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      winLossRatio: winLossRatio.toFixed(2),
      concentrationPct: concentrationPct.toFixed(1),
      maxWin: maxWin.toFixed(2),
      floatingLossPct: floatingLossPct.toFixed(1),
      marginUsagePct: marginUsagePct.toFixed(1),
      forensicScore: forensicScore.toFixed(1),
      forensicVerdict,
      anomalies,
      totalFills: allTrades.length,
      allTrades: allTrades, // Todos los movimientos para análisis exhaustivo
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
