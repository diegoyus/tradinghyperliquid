import { NextResponse } from "next/server";

const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const TELEGRAM_BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";

// Traders principales a monitorear en la nube
const MONITORED_TRADERS = [
  { name: "El Francotirador", address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06" },
  { name: "Sticky", address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe" },
  { name: "Macro / Acciones", address: "0xb6db1b4dc6244f86e482d834739d949d799e4da5" },
  { name: "Especialista SOL", address: "0xab7fb756330e3983e676f44c03dabda9120aa273" },
];

async function sendTelegramAlert(chatId: string, message: string) {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("Error enviando alerta Telegram:", e);
  }
}

export async function GET(req: Request) {
  try {
    const results = [];

    for (const trader of MONITORED_TRADERS) {
      // Consultar últimos fills del trader en Hyperliquid
      const res = await fetch(HYPERLIQUID_INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "userFills",
          user: trader.address,
        }),
      });

      if (res.ok) {
        const fills = await res.json();
        const recentFills = Array.isArray(fills) ? fills.slice(0, 3) : [];
        results.push({
          trader: trader.name,
          address: trader.address,
          totalFills: fills?.length || 0,
          latestTrade: recentFills[0] || null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      server: "Vercel Cloud 24/7 Engine",
      monitoredTraders: results.length,
      data: results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
