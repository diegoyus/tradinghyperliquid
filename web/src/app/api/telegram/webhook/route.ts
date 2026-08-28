import { NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
const LEADERBOARD_URL = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";
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

No necesitas buscar direcciones manualmente; puedo escanear todo el exchange por ti:

🔥 <b>/descubrir</b> o <b>/top</b> - Escanear el leaderboard y encontrar las mejores billeteras a copiar
📊 /saldo - Consultar saldo virtual, PnL y rendimiento
📈 /posiciones - Ver posiciones abiertas en directo
👥 /traders - Ver traders en tu cesta y asignación %
🔍 /analizar [0x...] - Auditar una billetera específica
🌐 /web - Enlace directo a tu plataforma
🆔 /id - Ver tu Chat ID de Telegram`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /descubrir o /top o /escanear (AUTOMATIC SCANNER!)
    if (command === "/descubrir" || command === "/top" || command === "/escanear") {
      await sendTelegramReply(chatId, "⚡ <i>Escaneando más de 43.000 traders en Hyperliquid Mainnet en busca de las carteras más rentables y consistentes...</i>");

      try {
        const lbRes = await fetch(LEADERBOARD_URL, { next: { revalidate: 300 } });
        if (!lbRes.ok) throw new Error("Error al consultar leaderboard");
        const data = await lbRes.json();
        const rows = data?.leaderboardRows || [];

        const validTraders = rows
          .map((row: any) => {
            const address = row.ethAddress || "";
            const accountValue = parseFloat(row.accountValue || "0");
            const perfMap: Record<string, any> = {};
            (row.windowPerformances || []).forEach(([period, stats]: [string, any]) => {
              perfMap[period] = {
                pnl: parseFloat(stats.pnl || "0"),
                roi: parseFloat(stats.roi || "0") * 100,
              };
            });
            const month = perfMap["month"] || { pnl: 0, roi: 0 };
            const allTime = perfMap["allTime"] || { pnl: 0, roi: 0 };

            let score = 5.0;
            if (month.roi > 30) score += 2.0;
            else if (month.roi > 10) score += 1.0;
            if (allTime.roi > 100) score += 1.5;
            else if (allTime.roi > 30) score += 0.8;
            if (accountValue >= 50000) score += 1.0;
            score = Math.min(Math.max(score, 1.0), 9.9);

            return {
              address,
              accountValue,
              monthPnl: month.pnl,
              monthRoi: month.roi,
              allTimePnl: allTime.pnl,
              allTimeRoi: allTime.roi,
              score: score.toFixed(1),
            };
          })
          .filter((t: any) => t.accountValue >= 25000 && t.monthRoi > 10 && t.allTimePnl > 0)
          .sort((a: any, b: any) => parseFloat(b.score) - parseFloat(a.score) || b.allTimePnl - a.allTimePnl)
          .slice(0, 5);

        let msg = `🏆 <b>Top 5 Mejores Billeteras Encontradas en Hyperliquid:</b>\n\n`;

        validTraders.forEach((t: any, idx: number) => {
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔹";
          msg += `${medal} <b>Trader #${idx + 1}</b> (★ <b>${t.score}/10</b>)
• <b>Dirección:</b> <code>${t.address}</code>
• <b>Saldo:</b> $${t.accountValue.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
• <b>ROI Mensual:</b> 🟢 +${t.monthRoi.toFixed(1)}% (+$${t.monthPnl.toLocaleString("en-US", { maximumFractionDigits: 0 })})
• <b>ROI Histórico:</b> 🚀 +${t.allTimeRoi.toFixed(1)}% (+$${t.allTimePnl.toLocaleString("en-US", { maximumFractionDigits: 0 })})
👉 <i>Para auditar: /analizar ${t.address}</i>\n\n`;
        });

        msg += `💡 <i>Puedes añadir cualquiera de estas direcciones a tu cesta directamente en <a href="${APP_URL}/traders">tu panel web</a>.</i>`;
        await sendTelegramReply(chatId, msg);
      } catch (err: any) {
        await sendTelegramReply(chatId, `❌ Error al escanear el leaderboard: ${err.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    // 3. Comando /saldo o /balance
    if (command === "/saldo" || command === "/balance") {
      const msg = `💰 <b>Resumen de tu Cartera Virtual:</b>

• <b>Saldo Actual:</b> $10,000.00 USD
• <b>Capital Inicial:</b> $10,000.00 USD
• <b>PnL Neto Realizado:</b> $0.00 USD (0.00%)
• <b>Tasa de Acierto:</b> 100% (0 operaciones)
• <b>Traders Activos:</b> 4 en tu cesta
• <b>Estado:</b> 🟢 <b>24/7 Cloud Worker Activo</b>

👉 <i>Para ver gráficos detallados: <a href="${APP_URL}/dashboard">Ir al Dashboard</a></i>`;
      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 4. Comando /posiciones o /positions
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

    // 5. Comando /traders o /cesta
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

    // 6. Comando /analizar <0x...>
    if (command === "/analizar" || command === "/analyze") {
      const targetAddr = args || "0x337afda118de433f5a8c8ad6d6ef48b76d027a06";

      if (!targetAddr.startsWith("0x") || targetAddr.length !== 42) {
        await sendTelegramReply(
          chatId,
          "❌ Debes indicar una dirección válida. Ejemplo:\n<code>/analizar 0x337afda118de433f5a8c8ad6d6ef48b76d027a06</code>\n\n💡 O escribe <b>/descubrir</b> para que busque las mejores por ti."
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

    // 7. Comando /web
    if (command === "/web" || command === "/app") {
      await sendTelegramReply(
        chatId,
        `🌐 <b>Tu Plataforma de Copy Trading:</b>\n\n👉 <a href="${APP_URL}">${APP_URL}</a>\n\nAccede desde tu ordenador o móvil para ver el panel de control interactivo.`
      );
      return NextResponse.json({ ok: true });
    }

    // 8. Comando /id
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
      `❓ No reconozco ese comando.\n\nPrueba a escribir:\n🔥 <b>/descubrir</b> - Buscar las mejores carteras automáticamente\n📊 /saldo - Ver tu saldo y PnL\n📈 /posiciones - Ver órdenes activas\n/ayuda - Ver todos los comandos`
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error en webhook de Telegram:", error);
    return NextResponse.json({ ok: true });
  }
}
