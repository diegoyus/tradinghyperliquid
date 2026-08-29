import { NextResponse } from "next/server";
import verifiedData from "@/data/verified_traders.json";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("filter") || "all"; // all, passed, monthly, whales, rejected

    const tradersList = Array.isArray(verifiedData)
      ? verifiedData
      : (verifiedData as any).traders || [];

    const lastAudited = (verifiedData as any).lastAudited || new Date().toLocaleString("es-ES");
    const totalScanned = (verifiedData as any).totalScanned || tradersList.length;
    const totalPassed = (verifiedData as any).totalPassed || tradersList.filter((t: any) => t.passedFilter).length;
    const totalFailed = (verifiedData as any).totalFailed || (tradersList.length - totalPassed);

    let list = [...tradersList];

    if (filterType === "passed") {
      list = list.filter((t) => t.passedFilter);
      list.sort((a, b) => parseFloat(b.score) - parseFloat(a.score) || b.profitFactor - a.profitFactor);
    } else if (filterType === "rejected") {
      list = list.filter((t) => !t.passedFilter);
    } else if (filterType === "monthly") {
      list.sort((a, b) => (b.passedFilter ? 1 : 0) - (a.passedFilter ? 1 : 0) || b.monthRoi - a.monthRoi);
    } else if (filterType === "whales") {
      list.sort((a, b) => (b.passedFilter ? 1 : 0) - (a.passedFilter ? 1 : 0) || b.accountValue - a.accountValue);
    } else {
      // Default: ALL traders, but APROBADOS (Yellow) first!
      list.sort((a, b) => (b.passedFilter ? 1 : 0) - (a.passedFilter ? 1 : 0) || parseFloat(b.score) - parseFloat(a.score));
    }

    return NextResponse.json({
      success: true,
      lastAudited,
      totalScanned,
      totalPassed,
      totalFailed,
      filter: filterType,
      auditMethod: "100%_FULL_FILLS_HISTORY_ONCHAIN",
      traders: list,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
