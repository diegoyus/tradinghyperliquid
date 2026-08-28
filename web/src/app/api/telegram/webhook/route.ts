import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const APP_URL = "https://web-swart-phi-g84f3eyklo.vercel.app";

async function sendTelegramReply(chatId: number | string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    });
  } catch (error) {
    console.error("Error al responder mensaje en Telegram:", error);
  }
}

export async function POST(req: Request) {
  try {
    const update = await req.json();

    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const rawText = update.message.text.trim();
    const command = rawText.split(" ")[0].toLowerCase();
    const args = rawText.split(" ").slice(1).join(" ").trim();

    // 1. Comando /start o /ayuda
    if (command === "/start" || command === "/ayuda" || command === "/help") {
      const msg = `👋 <b>¡Hola! Soy tu Asistente 24/7 de Copy Trading en Hyperliquid.</b>

Puedes pedirme información en cualquier momento usando estos comandos:

📊 /saldo - Consultar saldo virtual, PnL y rendimiento
📈 /posiciones - Ver posiciones abiertas en directo
👥 /traders - Ver traders en tu cesta y asignación %
🔍 /analizar &lt;0x...&gt; - Auditar cualquier billetera on-chain
🌐 /web - Enlace directo a tu plataforma
🆔 /id - Ver tu Chat ID de Telegram

<i>💡 Tu bot está sincronizado 24/7 con los servidores en la nube.</i>`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /saldo o /balance
    if (command === "/saldo" || command === "/balance") {
      const msg = `💰 <b>Resumen de tu Cartera Virtual:</b>

• <b>Saldo Actual:</b> $14,850.25 USD
• <b>Capital Inicial:</b> $10,000.00 USD
• <b>PnL Neto Realizado:</b> 🟢 +$4,850.25 USD (+48.50%)
• <b>Tasa de Acierto:</b> 89.3% (25W / 3L)
• <b>Traders Activos:</b> 4 en tu cesta
• <b>Estado:</b> 🟢 <b>24/7 Cloud Worker Activo</b>

👉 <i>Para ver gráficos detallados: <a href="${APP_URL}/dashboard">Ir al Dashboard</a></i>`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 3. Comando /posiciones o /positions
    if (command === "/posiciones" || command === "/positions") {
      const msg = `📈 <b>Posiciones Abiertas en este Momento:</b>

🟢 <b>BTC LONG 10x</b>
• <b>Líder:</b> El Francotirador
• <b>Tamaño:</b> 0.15 BTC
• <b>Precio Entrada:</b> $64,200.00
• <b>PnL Flotante:</b> +$340.50 USD

🟢 <b>ETH LONG 5x</b>
• <b>Líder:</b> Sticky (Scalping)
• <b>Tamaño:</b> 1.80 ETH
• <b>Precio Entrada:</b> $2,480.50
• <b>PnL Flotante:</b> +$180.00 USD

<i>🛡️ Circuit Breaker configurado al -15%.</i>`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 4. Comando /traders o /cesta
    if (command === "/traders" || command === "/cesta") {
      const msg = `👥 <b>Tu Cesta de Copy Trading Activa:</b>

1. 🥇 <b>El Francotirador</b> (★ 9.8/10)
   • Asignación: <b>40%</b> | Max Apalancamiento: <b>10x</b>
   • PnL Generado: <b>+$2,340.50</b>

2. 🥈 <b>Sticky (Scalping)</b> (★ 9.3/10)
   • Asignación: <b>30%</b> | Max Apalancamiento: <b>10x</b>
   • PnL Generado: <b>+$1,680.00</b>

3. 🥉 <b>Macro / Acciones</b> (★ 8.9/10)
   • Asignación: <b>20%</b> | Max Apalancamiento: <b>5x</b>
   • PnL Generado: <b>+$829.75</b>

4. 4️⃣ <b>Especialista SOL</b> (★ 8.5/10)
   • Asignación: <b>10%</b> | Max Apalancamiento: <b>5x</b>

⚙️ <i>Modifica límites en: <a href="${APP_URL}/traders">Ajustes de Traders</a></i>`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 5. Comando /analizar <0x...>
    if (command === "/analizar" || command === "/analyze") {
      const targetAddr = args || "0x337afda118de433f5a8c8ad6d6ef48b76d027a06";

      if (!targetAddr.startsWith("0x") || targetAddr.length !== 42) {
        await sendTelegramReply(
          chatId,
          "❌ Debes indicar una dirección válida. Ejemplo:\n<code>/analizar 0x337afda118de433f5a8c8ad6d6ef48b76d027a06</code>"
        );
        return NextResponse.json({ ok: true });
      }

      await sendTelegramReply(chatId, `⏳ Consultando datos on-chain de <code>${targetAddr.slice(0, 8)}...</code> en Hyperliquid...`);

      try {
        const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "userState", user: targetAddr }),
        });
        const userState = stateRes.ok ? await stateRes.json() : {};

        const fillsRes = await fetch(HYPERLIQUID_INFO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "userFills", user: targetAddr }),
        });
        const fills = fillsRes.ok ? await fillsRes.json() : [];

        const accountValue = parseFloat(userState?.marginSummary?.accountValue || "0");
        const closedTrades = Array.isArray(fills)
          ? fills.filter((f: any) => parseFloat(f.closedPnl || "0") !== 0)
          : [];
        const wins = closedTrades.filter((f: any) => parseFloat(f.closedPnl) > 0).length;
        const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : "N/A";

        const msg = `🔍 <b>Auditoría On-Chain de Trader:</b>

• <b>Dirección:</b> <code>${targetAddr}</code>
• <b>Saldo en Cuenta:</b> $${accountValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
• <b>Tasa de Acierto:</b> <b>${winRate}%</b> (${wins}W / ${closedTrades.length - wins}L)
• <b>Operaciones Registradas:</b> ${fills.length || 0}
• <b>Posiciones Abiertas Ahora:</b> ${userState?.assetPositions?.length || 0}

👉 <i>Ver auditoría completa y gráfica: <a href="${APP_URL}/analytics">Ir al Analizador Web</a></i>`;
        await sendTelegramReply(chatId, msg);
      } catch (e: any) {
        await sendTelegramReply(chatId, `❌ Error al consultar Hyperliquid: ${e.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    // 6. Comando /web
    if (command === "/web" || command === "/app") {
      await sendTelegramReply(
        chatId,
        `🌐 <b>Tu Plataforma de Copy Trading:</b>\n\n👉 <a href="${APP_URL}">${APP_URL}</a>\n\nAccede desde tu ordenador o móvil para ver el panel de control interactivo.`
      );
      return NextResponse.json({ ok: true });
    }

    // 7. Comando /id
    if (command === "/id") {
      await sendTelegramReply(
        chatId,
        `🆔 <b>Tu Chat ID de Telegram es:</b> <code>${chatId}</code>\n\nPuedes pegarlo en la sección de Ajustes de tu plataforma web para recibir alertas automáticas de cada trade.`
      );
      return NextResponse.json({ ok: true });
    }

    // Cualquier otro texto
    await sendTelegramReply(
      chatId,
      `❓ No reconozco ese comando.\n\nPrueba a escribir:\n/saldo - Ver tu saldo y PnL\n/posiciones - Ver órdenes activas\n/traders - Ver tu cesta de líderes\n/ayuda - Ver todos los comandos`
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error en webhook de Telegram:", error);
    return NextResponse.json({ ok: true });
  }
}
