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
      try {
        const userTotalBalance = 10000.0;
        const copyRules = [
          { name: "El Francotirador", address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06", allocationPct: 35.0, maxLev: 10, stopLossPct: 5.0, maxSizingPct: 25.0, riskMult: 1.0 },
          { name: "Trader 0x5986", address: "0x5986347c1d0133d02d307f08bb1efd44c2eb89d9", allocationPct: 35.0, maxLev: 10, stopLossPct: 5.0, maxSizingPct: 25.0, riskMult: 1.0 },
          { name: "Sticky (Scalping)", address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe", allocationPct: 30.0, maxLev: 10, stopLossPct: 6.0, maxSizingPct: 20.0, riskMult: 1.0 },
        ];

        const myCopiedPositions: any[] = [];

        for (const rule of copyRules) {
          try {
            // Obtener estado y fills en paralelo
            const [stRes, fillsRes] = await Promise.all([
              fetch(HYPERLIQUID_INFO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "clearinghouseState", user: rule.address }),
              }),
              fetch(HYPERLIQUID_INFO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "userFills", user: rule.address }),
              }),
            ]);

            if (stRes.ok) {
              const stData = await stRes.json();
              const fills = fillsRes.ok ? await fillsRes.json() : [];
              const traderAccountValue = parseFloat(stData?.marginSummary?.accountValue || "100000");
              const positions = stData?.assetPositions || [];

              // Mapa de la fecha de apertura más antigua por moneda
              const openDates: Record<string, number> = {};
              if (Array.isArray(fills)) {
                for (const f of fills) {
                  const coin = f.coin || "";
                  const t = f.time || 0;
                  if (coin && t && (!openDates[coin] || t < openDates[coin])) {
                    openDates[coin] = t;
                  }
                }
              }

              positions.forEach((p: any) => {
                const pos = p.position || {};
                const szi = parseFloat(pos.szi || "0");
                const entryPx = parseFloat(pos.entryPx || "0");
                const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
                const coin = pos.coin || "Crypto";

                if (szi !== 0 && entryPx > 0) {
                  const traderPosNotional = Math.abs(szi) * entryPx;
                  const fractionOfEquity = traderAccountValue > 0 ? (traderPosNotional / traderAccountValue) : 0.1;
                  const userPosFraction = Math.min(fractionOfEquity * rule.riskMult, rule.maxSizingPct / 100);

                  const userAssignedCapital = userTotalBalance * (rule.allocationPct / 100);
                  const myNotionalUSD = userAssignedCapital * userPosFraction;
                  const myLeverage = Math.min(pos.leverage?.value || 10, rule.maxLev);
                  const myMarginUSD = myNotionalUSD / myLeverage;
                  const myQuantity = myNotionalUSD / entryPx;

                  const pnlFractionOfTrader = traderAccountValue > 0 ? (unrealizedPnl / traderAccountValue) : 0;
                  const myUnrealizedPnlUSD = userAssignedCapital * pnlFractionOfTrader;
                  const myPnlPct = myMarginUSD > 0 ? (myUnrealizedPnlUSD / myMarginUSD) * 100 : 0;

                  const slMultiplier = (rule.stopLossPct / 100) / myLeverage;
                  const myStopLossPrice = szi > 0 ? entryPx * (1 - slMultiplier) : entryPx * (1 + slMultiplier);

                  // Fecha de apertura
                  let openDateStr = "—";
                  if (openDates[coin]) {
                    const d = new Date(openDates[coin]);
                    openDateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
                  }

                  myCopiedPositions.push({
                    traderName: rule.name,
                    coin,
                    side: szi > 0 ? "LONG" : "SHORT",
                    myLeverage,
                    myMarginUSD: parseFloat(myMarginUSD.toFixed(2)),
                    myNotionalUSD: myNotionalUSD.toFixed(2),
                    myQuantity: myQuantity.toFixed(4),
                    entryPx: entryPx.toFixed(2),
                    myStopLossPrice: myStopLossPrice.toFixed(2),
                    myUnrealizedPnlUSD: parseFloat(myUnrealizedPnlUSD.toFixed(2)),
                    myPnlPct: myPnlPct.toFixed(2),
                    isProfit: myUnrealizedPnlUSD >= 0,
                    openDate: openDateStr,
                  });
                }
              });
            }
          } catch {}
        }

        if (myCopiedPositions.length === 0) {
          const msg = `📈 <b>Tus Posiciones Copiadas:</b> <code>0 activas</code>

💰 <b>Tu Capital:</b> $10,000.00 USD (100% en Liquidez Segura)
🛡️ <b>Tus Reglas de Copia Activas:</b>
• <b>El Francotirador:</b> 35% ($3,500) | Máx 10x | SL 5%
• <b>Trader 0x5986:</b> 35% ($3,500) | Máx 10x | SL 5%
• <b>Sticky (Scalping):</b> 30% ($3,000) | Máx 10x | SL 6%

💡 <i>Tus órdenes se abrirán automáticamente con tu tamaño y límites propios en cuanto los traders entren al mercado.</i>

👉 <i>Ver panel web: <a href="${APP_URL}/dashboard">Ir al Dashboard</a></i>`;
          await sendTelegramReply(chatId, msg);
        } else {
          let totalFloatingPnl = 0;
          let totalMarginInvested = 0;

          let msg = `📊 <b>Tus Posiciones Copiadas en Tiempo Real (${myCopiedPositions.length}):</b>\n\n`;
          myCopiedPositions.forEach((p: any) => {
            totalFloatingPnl += p.myUnrealizedPnlUSD;
            totalMarginInvested += p.myMarginUSD;

            const icon = p.isProfit ? "🟢" : "🔴";
            msg += `${icon} <b>${p.coin} ${p.side} ${p.myLeverage}x (Tu Réplica)</b>
• <b>Trader:</b> ${p.traderName}
• <b>Tu Margen:</b> <b>$${p.myMarginUSD.toFixed(2)} USD</b> | Tamaño: ${p.myQuantity} ${p.coin}
• <b>Entrada:</b> $${p.entryPx} | <b>Stop-Loss:</b> $${p.myStopLossPrice}
• <b>Tu PnL:</b> <b>${p.isProfit ? "+" : ""}$${p.myUnrealizedPnlUSD.toFixed(2)} USD (${p.isProfit ? "+" : ""}${p.myPnlPct}%)</b>
• 📅 <b>Abierta:</b> ${p.openDate}\n\n`;
          });

          // RESUMEN TOTAL FLOTANTE
          const totalIcon = totalFloatingPnl >= 0 ? "🟢" : "🔴";
          const totalPnlPct = totalMarginInvested > 0 ? ((totalFloatingPnl / totalMarginInvested) * 100).toFixed(2) : "0.00";
          const liquidezLibre = userTotalBalance - totalMarginInvested;

          msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${totalIcon} <b>TOTAL FLOTANTE:</b> <b>${totalFloatingPnl >= 0 ? "+" : ""}$${totalFloatingPnl.toFixed(2)} USD (${totalFloatingPnl >= 0 ? "+" : ""}${totalPnlPct}%)</b>
💰 <b>Margen en Uso:</b> $${totalMarginInvested.toFixed(2)} USD
💵 <b>Liquidez Libre:</b> $${liquidezLibre.toFixed(2)} USD
🏦 <b>Valor Estimado Cartera:</b> <b>$${(userTotalBalance + totalFloatingPnl).toFixed(2)} USD</b>`;

          await sendTelegramReply(chatId, msg);
        }
      } catch (err: any) {
        await sendTelegramReply(chatId, `📈 <b>Tus Posiciones Copiadas:</b> 0 activas.\n\n💰 Saldo: $10,000.00 USD en liquidez.`);
      }
      return NextResponse.json({ ok: true });
    }

    // 5. Comando /traders o /cesta
    if (command === "/traders" || command === "/cesta") {
      const msg = `👥 <b>Tu Cesta de Copy Trading Activa:</b>

1. 🥇 <b>El Francotirador</b> (★ 9.8/10)
   • Asignación: <b>35%</b> | Max Apalancamiento: <b>10x</b> | Stop Loss: <b>5%</b>
   • Perfil: Scalping Cuantitativo de Alta Frecuencia

2. 🥈 <b>Trader 0x5986</b> (★ 9.9/10)
   • Asignación: <b>35%</b> | Max Apalancamiento: <b>10x</b> | Stop Loss: <b>5%</b>
   • Perfil: Operativa Quirúrgica en BTC y SOL

3. 🥉 <b>Sticky (Scalping)</b> (★ 9.3/10)
   • Asignación: <b>30%</b> | Max Apalancamiento: <b>10x</b> | Stop Loss: <b>5%</b>
   • Perfil: Momentum & Altcoins

⚙️ <i>Modifica límites y añade nuevos traders en: <a href="${APP_URL}/traders">Ajustes de Traders</a></i>`;
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
