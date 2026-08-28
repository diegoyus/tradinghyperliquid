import { NextResponse } from "next/server";

const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("filter") || "consistent"; // consistent, monthly, whales

    const res = await fetch(LEADERBOARD_URL, {
      next: { revalidate: 300 }, // Cache por 5 min
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: "Error al consultar el leaderboard de Hyperliquid." }, { status: 502 });
    }

    const data = await res.json();
    const rows = data?.leaderboardRows || [];

    const parsedTraders = rows.map((row: any) => {
      const address = row.ethAddress || "";
      const accountValue = parseFloat(row.accountValue || "0");
      const perfMap: Record<string, any> = {};

      (row.windowPerformances || []).forEach(([period, stats]: [string, any]) => {
        perfMap[period] = {
          pnl: parseFloat(stats.pnl || "0"),
          roi: parseFloat(stats.roi || "0") * 100,
          vlm: parseFloat(stats.vlm || "0"),
        };
      });

      const day = perfMap["day"] || { pnl: 0, roi: 0 };
      const week = perfMap["week"] || { pnl: 0, roi: 0 };
      const month = perfMap["month"] || { pnl: 0, roi: 0 };
      const allTime = perfMap["allTime"] || { pnl: 0, roi: 0 };

      // Algoritmo de puntuación de consistencia
      let consistencyScore = 5.0;
      if (month.roi > 30) consistencyScore += 2.0;
      else if (month.roi > 10) consistencyScore += 1.0;

      if (allTime.roi > 100) consistencyScore += 1.5;
      else if (allTime.roi > 30) consistencyScore += 0.8;

      if (accountValue >= 100000) consistencyScore += 1.0;
      else if (accountValue >= 25000) consistencyScore += 0.5;

      if (month.pnl > 0 && week.pnl > 0) consistencyScore += 0.5;
      consistencyScore = Math.min(Math.max(consistencyScore, 1.0), 9.9);

      return {
        address,
        accountValue,
        dayPnl: day.pnl,
        dayRoi: day.roi,
        weekPnl: week.pnl,
        weekRoi: week.roi,
        monthPnl: month.pnl,
        monthRoi: month.roi,
        allTimePnl: allTime.pnl,
        allTimeRoi: allTime.roi,
        score: consistencyScore.toFixed(1),
      };
    });

    let filtered = parsedTraders.filter((t: any) => t.accountValue >= 15000 && t.allTimePnl > 0);

    if (filterType === "monthly") {
      filtered.sort((a: any, b: any) => b.monthRoi - a.monthRoi);
    } else if (filterType === "whales") {
      filtered.sort((a: any, b: any) => b.accountValue - a.accountValue);
    } else {
      // Consistent (Default)
      filtered = filtered.filter((t: any) => t.monthRoi > 5 && t.allTimeRoi > 15);
      filtered.sort((a: any, b: any) => parseFloat(b.score) - parseFloat(a.score) || b.allTimePnl - a.allTimePnl);
    }

    return NextResponse.json({
      success: true,
      totalScanned: rows.length,
      filter: filterType,
      traders: filtered.slice(0, 12),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
