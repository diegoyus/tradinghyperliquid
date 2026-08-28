import { NextResponse } from "next/server";

const BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";

export async function POST(req: Request) {
  try {
    const { chatId } = await req.json();
    if (!chatId) {
      return NextResponse.json({ success: false, error: "Falta el Chat ID" }, { status: 400 });
    }

    const message = (
      `🚀 <b>¡Alerta de Prueba Exitosa!</b>\n\n` +
      `Tu cuenta en la plataforma de <b>Copy Trading Hyperliquid</b> está vinculada correctamente.\n\n` +
      `⚡ Recibirás aquí cada orden que abran o cierren los traders que tienes seleccionados en tu cesta.`
    );

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const data = await res.json();
    if (data.ok) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: data.description || "Error de Telegram" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
