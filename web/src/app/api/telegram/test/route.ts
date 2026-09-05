import { NextResponse } from "next/server";

const BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";

export async function POST(req: Request) {
  try {
    const { chatId, executionMode } = await req.json();
    if (!chatId) {
      return NextResponse.json({ success: false, error: "Falta el Chat ID" }, { status: 400 });
    }

    const modeText = executionMode === "TELEGRAM_APPROVAL"
      ? "📱 <b>Modo Aprobación Previa Activo:</b> Te enviaremos botones de confirmación antes de ejecutar cualquier posición."
      : "⚡ <b>Modo 100% Automático Activo:</b> Las posiciones se replicarán de inmediato al instante.";

    const message = (
      `🚀 <b>¡Alerta de Prueba Exitosa!</b>\n\n` +
      `Tu cuenta en la plataforma de <b>Copy Trading Hyperliquid</b> está vinculada correctamente.\n\n` +
      `${modeText}\n\n` +
      `⚡ Recibirás aquí cada orden de los traders seleccionados en tu cesta.`
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
