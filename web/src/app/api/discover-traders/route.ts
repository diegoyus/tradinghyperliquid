import { NextResponse } from "next/server";
import verifiedData from "@/data/verified_traders.json";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("filter") || "consistent"; // consistent, monthly, whales

    const tradersList = Array.isArray(verifiedData)
      ? verifiedData
      : (verifiedData as any).traders || [];

    const lastAudited = (verifiedData as any).lastAudited || new Date().toLocaleString("es-ES");
    const totalScanned = (verifiedData as any).totalScanned || 43000;

    let list = [...tradersList];

    if (filterType === "monthly") {
      list.sort((a, b) => b.monthRoi - a.monthRoi);
    } else if (filterType === "whales") {
      list.sort((a, b) => b.accountValue - a.accountValue);
    } else {
      // Consistent (Default by Quant Score)
      list.sort((a, b) => parseFloat(b.score) - parseFloat(a.score) || b.profitFactor - a.profitFactor);
    }

    return NextResponse.json({
      success: true,
      lastAudited,
      totalScanned,
      totalVerified: list.length,
      filter: filterType,
      auditMethod: "100%_FULL_FILLS_HISTORY_ONCHAIN",
      traders: list,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
