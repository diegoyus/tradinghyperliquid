import { NextResponse } from "next/server";
import { getUserByChatId, saveUserByChatId, recordTradeAction } from "@/lib/telegramStore";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateUserStatusInCloud } from "@/lib/cloudSync";

const BOT_TOKEN = "8619700844:AAHKO9gGk--e4jYPvC7tXrgGEPaohFrbyqI";
const APP_URL = "https://web-swart-phi-g84f3eyklo.vercel.app";
const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

function buildWebAuthUrl(targetPath: string = "/dashboard", userEmail?: string): string {
  const params = new URLSearchParams();
  if (targetPath) params.set("redirect", targetPath);
  if (userEmail && userEmail.includes("@")) params.set("email", userEmail.trim().toLowerCase());
  return `${APP_URL}/auth?${params.toString()}`;
}

async function sendTelegramReply(chatId: string | number, text: string, replyMarkup?: any) {
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Error enviando respuesta a Telegram:", err);
  }
}

function formatUSD(val: number): string {
  if (Math.abs(val) === 0) return "$0.00";
  if (Math.abs(val) < 0.01) return `$${val.toFixed(4)}`;
  return `$${val.toFixed(2)}`;
}

function formatQty(val: number): string {
  if (Math.abs(val) === 0) return "0.00";
  if (Math.abs(val) < 0.001) return val.toFixed(4);
  return val.toFixed(2);
}

export async function POST(req: Request) {
  try {
    const update = await req.json();

    // Manejar Callback Queries (Botones Inline de Aprobación de Usuarios para el Superadmin)
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbData = cb.data || "";
      const cbChatId = cb.message?.chat?.id;
      const cbMessageId = cb.message?.message_id;

      if (cbData.startsWith("approve_user:")) {
        const target = cbData.replace("approve_user:", "").trim();
        try {
          await updateUserStatusInCloud(target, "ACTIVE");
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: `✅ Usuario ${target} Aprobado y Activado con éxito`,
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `✅ <b>ACCESO APROBADO & ACTIVADO</b>\n\n👤 <b>Usuario:</b> <code>${target}</code>\n🟢 <b>Estado:</b> <b>ACTIVO</b> en Firestore (Permisos de copia habilitados)\n👑 <b>Aprobado por:</b> Superadministrador\n\n<i>Ya puede ingresar y operar libremente en la plataforma.</i>`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error answering approve callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      if (cbData.startsWith("reject_user:")) {
        const target = cbData.replace("reject_user:", "").trim();
        try {
          await updateUserStatusInCloud(target, "INACTIVE");
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: `❌ Usuario ${target} Denegado / Bloqueado`,
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `❌ <b>ACCESO DENEGADO / USUARIO BLOQUEADO</b>\n\n👤 <b>Usuario:</b> <code>${target}</code>\n🔴 <b>Estado:</b> <b>INACTIVO</b> en Firestore (Acceso suspendido)\n👑 <b>Gestionado por:</b> Superadministrador`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error answering reject callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      if (cbData.startsWith("approve_trade:")) {
        const tradeId = cbData.replace("approve_trade:", "");
        try {
          recordTradeAction(tradeId, "approve");

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: "✅ ¡Orden Aprobada y Ejecutada!",
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `✅ <b>ORDEN AUTORIZADA Y EJECUTADA</b>\n\n🆔 <b>Operación:</b> <code>${tradeId}</code>\n🟢 <b>Estado:</b> REPLICADA EN TU CARTERA\n⚡ <b>Ejecución:</b> Confirmada por el usuario en Telegram`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error answering trade approval callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      if (cbData.startsWith("reject_trade:")) {
        const tradeId = cbData.replace("reject_trade:", "");
        try {
          recordTradeAction(tradeId, "reject");

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: "❌ Orden Rechazada y Omitida",
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `❌ <b>ORDEN RECHAZADA POR EL USUARIO</b>\n\n🆔 <b>Operación:</b> <code>${tradeId}</code>\n🔴 <b>Estado:</b> OMITIDA (Capital protegido, sin exposición)`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error answering trade reject callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      if (cbData.startsWith("switch_mode:")) {
        const targetMode = cbData.replace("switch_mode:", "") as "DEMO" | "REAL";
        try {
          const userP = await getUserByChatId(cbChatId ? cbChatId.toString() : "");
          if (userP) {
            userP.trading_mode = targetMode;
            saveUserByChatId(cbChatId.toString(), userP);
          }

          const modeName = targetMode === "REAL" ? "🔵 REAL (Hyperliquid Mainnet)" : "🟢 SIMULADO (Paper Trading)";

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: `✅ Entorno cambiado a: ${targetMode === "REAL" ? "🔵 REAL" : "🟢 SIMULADO"}`,
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `✅ <b>ENTORNO DE OPERACIÓN ACTUALIZADO</b>\n\n🎮 <b>Modo Activo:</b> <b>${modeName}</b>\n\n<i>A partir de ahora, /saldo y /posiciones responderán con los datos de este entorno. También puedes cambiarlo con el selector superior en la plataforma web.</i>\n\n👉 <a href="${buildWebAuthUrl("/dashboard", userP?.email)}">Ir al Dashboard</a>`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error answering switch mode callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      if (cbData.startsWith("close_pos:")) {
        const coin = cbData.replace("close_pos:", "").toUpperCase();
        try {
          const userP = await getUserByChatId(cbChatId ? cbChatId.toString() : "");
          if (!userP) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: cb.id,
                text: "❌ Usuario no vinculado.",
              }),
            });
            return NextResponse.json({ ok: true });
          }

          // Registrar orden de cierre en Firestore para que el engine local/servidor lo ejecute
          const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await setDoc(doc(db, "trading_commands", cmdId), {
            action: "CLOSE",
            coin: coin,
            chat_id: cbChatId ? cbChatId.toString() : "",
            user_email: userP.email,
            status: "PENDING",
            created_at: new Date().toISOString(),
          });

          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callback_query_id: cb.id,
              text: `⏳ Cerrando ${coin} a mercado en Hyperliquid...`,
            }),
          });

          if (cbChatId && cbMessageId) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: cbChatId,
                message_id: cbMessageId,
                text: `⏳ <b>ORDEN DE CIERRE ENVIADA A HYPERLIQUID</b>\n\n• <b>Activo:</b> <b>${coin}</b>\n• <b>Tipo:</b> Market Close On-Chain\n• <b>Estado:</b> ⚡ Despachando a blockchain...\n\n<i>En unos segundos recibirás la confirmación con el margen liberado a tu cuenta.</i>`,
                parse_mode: "HTML",
              }),
            });
          }
        } catch (e) {
          console.error("Error handling close_pos callback:", e);
        }
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    if (!update.message || !update.message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = update.message.chat.id.toString();
    const text = update.message.text.trim();
    const senderName = update.message.from?.first_name || "Inversor";

    const parts = text.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ").trim();

    // Obtener perfil sincronizado del usuario desde la base de datos / memoria
    const userProfile = await getUserByChatId(chatId);

    const isRealMode = userProfile?.trading_mode === "REAL";

    // 1. Comando /web o /dashboard o /app o /panel o /plataforma o /inicio
    if (
      command === "/web" ||
      command === "/app" ||
      command === "/dashboard" ||
      command === "/panel" ||
      command === "/plataforma" ||
      command === "/inicio"
    ) {
      const isLinked = !!userProfile;
      const userName = userProfile?.name || senderName;

      const email = userProfile?.email;
      const webMsg = `🌐 <b>Plataforma Web de Copy Trading:</b>
Hola <b>${userName}</b>, aquí tienes los accesos directos a tu panel de control y herramientas:

📊 <b>Dashboard Principal:</b>
<a href="${buildWebAuthUrl("/dashboard", email)}">${APP_URL}/dashboard</a>

👑 <b>Hall de la Fama & Traders:</b>
<a href="${buildWebAuthUrl("/traders", email)}">${APP_URL}/traders</a>

🔬 <b>Analizador de Billeteras:</b>
<a href="${buildWebAuthUrl("/analytics", email)}">${APP_URL}/analytics</a>

📜 <b>Historial de Operaciones:</b>
<a href="${buildWebAuthUrl("/history", email)}">${APP_URL}/history</a>

⚙️ <b>Ajustes & Gestión de Riesgo:</b>
<a href="${buildWebAuthUrl("/settings", email)}">${APP_URL}/settings</a>

<i>Toca los botones inferiores para abrir la web directamente:</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "📊 Ir al Dashboard", url: buildWebAuthUrl("/dashboard", email) },
            { text: "👑 Hall de la Fama", url: buildWebAuthUrl("/traders", email) },
          ],
          [
            { text: "🔬 Analizador On-Chain", url: buildWebAuthUrl("/analytics", email) },
            { text: "⚙️ Ajustes", url: buildWebAuthUrl("/settings", email) },
          ],
        ],
      };

      await sendTelegramReply(chatId, webMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // 2. Comando /modo o /entorno o /mode
    if (command === "/modo" || command === "/entorno" || command === "/mode") {
      const currentModeLabel = isRealMode ? "🔵 REAL (Hyperliquid Mainnet)" : "🟢 SIMULADO (Paper Trading)";

      const modeMsg = `🎮 <b>Gestor de Entorno de Operación:</b>

• <b>Entorno Activo:</b> <b>${currentModeLabel}</b>

• 🟢 <b>Simulado (Verde):</b> Opera con $10,000 USD virtuales y réplicas proporcionales sin riesgo.
• 🔵 <b>Real (Azul):</b> Saldo real y posiciones on-chain en Hyperliquid DEX.

<i>Toca el botón abajo para cambiar de entorno al instante:</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: !isRealMode ? "✅ 🟢 Simulado (Activo)" : "🟢 Activar Simulado", callback_data: "switch_mode:DEMO" },
            { text: isRealMode ? "✅ 🔵 Real (Activo)" : "🔵 Activar Real", callback_data: "switch_mode:REAL" },
          ],
        ],
      };

      await sendTelegramReply(chatId, modeMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // 3. Comando /start o /ayuda
    if (command === "/start" || command === "/help" || command === "/ayuda") {
      const isLinked = !!userProfile;
      const userName = userProfile?.name || senderName;
      const currentEnvText = isRealMode ? "🔵 REAL (Hyperliquid)" : "🟢 SIMULADO (Paper Trading)";
      const statusText = isLinked
        ? `🟢 <b>Cuenta Vinculada:</b> ${userName} | <b>Entorno:</b> ${currentEnvText}`
        : `⚠️ <b>Cuenta No Vinculada:</b> Pega tu Chat ID (<code>${chatId}</code>) en los Ajustes de la plataforma web.`;

      const welcomeMsg = `🤖 <b>¡Hola ${userName}! Bienvenido a HyperCopy Bot.</b>
Plataforma de Copy Trading Cuantitativo en Hyperliquid DEX.

${statusText}

📋 <b>Comandos Disponibles:</b>
• 🎮 <b>/modo</b> - Alternar entre Simulado (🟢) y Real (🔵)
• 💰 <b>/saldo</b> - Ver tu saldo (${isRealMode ? "Real de Hyperliquid" : "Virtual Simulado"})
• 📈 <b>/posiciones</b> - Ver posiciones activas (${isRealMode ? "de tu billetera real" : "de tu cesta simulada"})
• 👥 <b>/cesta</b> - Ver los traders configurados
• 🔥 <b>/descubrir</b> - Ver líderes del Hall de la Fama
• 🔍 <b>/analizar [0x...]</b> - Auditar cualquier trader on-chain
• 🌐 <b>/web</b> - Enlaces a la plataforma web
• 🆔 <b>/id</b> - Ver tu número de Chat ID

👉 <b>Panel Web:</b> <a href="${buildWebAuthUrl("/dashboard", userProfile?.email)}">${APP_URL}</a>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: !isRealMode ? "🟢 Simulado (Activo)" : "🟢 Pasar a Simulado", callback_data: "switch_mode:DEMO" },
            { text: isRealMode ? "🔵 Real (Activo)" : "🔵 Pasar a Real", callback_data: "switch_mode:REAL" },
          ],
          [
            { text: "🌐 Abrir Plataforma Web", url: buildWebAuthUrl("/dashboard", userProfile?.email) },
          ],
        ],
      };

      await sendTelegramReply(chatId, welcomeMsg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // 4. Comando /saldo o /balance
    if (command === "/saldo" || command === "/balance") {
      if (!userProfile) {
        const msg = `💰 <b>Tu Cuenta en HyperCopy:</b>

🆔 <b>Tu Chat ID:</b> <code>${chatId}</code>
⚠️ <i>Aún no has vinculado tu Chat ID en la web. Entra en <a href="${buildWebAuthUrl("/settings")}">Ajustes</a> y guarda tu Chat ID para sincronizar tu cuenta.</i>`;
        await sendTelegramReply(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      const tradersCount = (userProfile.traders || []).length;
      const execMode = userProfile.global_risk?.execution_mode === "TELEGRAM_APPROVAL" ? "📱 Aprobación Previa" : "⚡ 100% Automático";

      // ── CASO A: ENTORNO REAL SELECCIONADO ──
      if (isRealMode) {
        if (userProfile.wallet_address) {
          try {
            const walletRes = await fetch(HYPERLIQUID_INFO_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "clearinghouseState", user: userProfile.wallet_address }),
            });
            const walletData = walletRes.ok ? await walletRes.json() : null;

            // Saldo en Spot verdaderamente libre (sin duplicar el margen en hold que ya computa en Perps)
            let spotFreeUsdc = 0;
            try {
              const spotRes = await fetch(HYPERLIQUID_INFO_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "spotClearinghouseState", user: userProfile.wallet_address }),
              });
              if (spotRes.ok) {
                const spotData = await spotRes.json();
                const usdcBal = (spotData.balances || []).find((b: any) => b.coin === "USDC");
                if (usdcBal) {
                  const total = parseFloat(usdcBal.total || "0");
                  const hold = parseFloat(usdcBal.hold || "0");
                  spotFreeUsdc = Math.max(0, total - hold);
                }
              }
            } catch {}

            if (walletData?.marginSummary || spotFreeUsdc > 0) {
              const perpsAccountVal = parseFloat(walletData?.marginSummary?.accountValue || "0");
              const perpsRawUsd = parseFloat(walletData?.marginSummary?.totalRawUsd || "0");
              const accountValue = perpsAccountVal + spotFreeUsdc;
              const totalUnrealizedPnl = parseFloat(walletData?.marginSummary?.totalUnrealizedPnl || "0");
              const totalRawUsd = perpsRawUsd + spotFreeUsdc;
              const openPositionsCount = (walletData?.assetPositions || []).filter(
                (p: any) => Math.abs(parseFloat(p.position?.szi || "0")) > 0
              ).length;
              const pnlIcon = totalUnrealizedPnl >= 0 ? "🟢" : "🔴";

              const agentStatus = userProfile.agent_wallet?.is_approved_on_chain
                ? "🟢 Autorizado On-Chain"
                : userProfile.agent_wallet
                ? "⏳ Pendiente de Aprobación"
                : "⚪ No Configurado";

              const msg = `🔵 <b>Tu Cartera en MODO REAL (Hyperliquid Mainnet):</b>
👤 <b>Inversor:</b> ${userProfile.name}
<code>${userProfile.wallet_address.slice(0, 10)}...${userProfile.wallet_address.slice(-6)}</code>

• <b>Valor Total de Cuenta:</b> <b>$${accountValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</b>
• <b>USDC Disponible:</b> $${totalRawUsd.toFixed(2)} USD
• <b>PnL Flotante Actual:</b> ${pnlIcon} <b>${totalUnrealizedPnl >= 0 ? "+" : ""}$${totalUnrealizedPnl.toFixed(2)} USD</b>
• <b>Posiciones On-Chain:</b> <b>${openPositionsCount} abiertas</b>
• <b>Traders en Cesta:</b> ${tradersCount} configurados
• <b>Agente de Trading Real:</b> <b>${agentStatus}</b>
• <b>Modo de Ejecución:</b> ${execMode}

💡 <i>Entorno activo: 🔵 REAL. Toca el botón abajo para alternar:</i>`;

              const replyMarkup = {
                inline_keyboard: [
                  [
                    { text: "🟢 Ver Modo Simulado", callback_data: "switch_mode:DEMO" },
                    { text: "🔄 Actualizar Saldo", callback_data: "switch_mode:REAL" },
                  ],
                  [
                    { text: "📊 Abrir Dashboard Web", url: buildWebAuthUrl("/dashboard", userProfile?.email) },
                  ],
                ],
              };

              await sendTelegramReply(chatId, msg, replyMarkup);
              return NextResponse.json({ ok: true });
            }
          } catch (e) {
            console.error("Error leyendo wallet real para /saldo:", e);
          }
        }

        // Si está en modo REAL pero no tiene wallet vinculada
        const noWalletMsg = `🔵 <b>Tu Cartera en MODO REAL (Hyperliquid):</b>
👤 <b>Inversor:</b> ${userProfile.name}

⚠️ <b>Aún no has conectado tu dirección pública de Hyperliquid.</b>
Para consultar tu saldo real de USDC y tus posiciones en tiempo real, conecta tu billetera en la plataforma web:

👉 <a href="${buildWebAuthUrl("/settings", userProfile?.email)}">Conectar Billetera en Ajustes</a>

💡 <i>Tienes seleccionado el entorno 🔵 REAL. Escribe /modo si deseas volver al Entorno Simulado (Paper).</i>`;

        await sendTelegramReply(chatId, noWalletMsg);
        return NextResponse.json({ ok: true });
      }

      // ── CASO B: ENTORNO SIMULADO (PAPER TRADING) ──
      const balance = userProfile.cash_balance || 10000.0;
      const realizedPnl = userProfile.realized_pnl || 0.0;
      const pnlIcon = realizedPnl >= 0 ? "🟢" : "🔴";

      const msg = `🟢 <b>Tu Cartera en MODO SIMULADO (Paper Trading):</b>
👤 <b>Inversor:</b> ${userProfile.name}

• <b>Saldo Virtual Actual:</b> <b>$${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</b>
• <b>Capital Inicial:</b> $${(userProfile.initial_balance || 10000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
• <b>PnL Neto Realizado:</b> ${pnlIcon} <b>${realizedPnl >= 0 ? "+" : ""}$${realizedPnl.toFixed(2)} USD</b>
• <b>Traders en Cesta:</b> <b>${tradersCount} asignados</b>
• <b>Modo de Ejecución:</b> ${execMode}
• <b>Estado:</b> 🟢 <b>Sincronizado 24/7 con la Web</b>

💡 <i>Entorno activo: 🟢 SIMULADO. Toca el botón abajo para ver tu saldo real:</i>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: "🔵 Ver Modo Real (Hyperliquid)", callback_data: "switch_mode:REAL" },
          ],
          [
            { text: "📊 Abrir Dashboard Web", url: buildWebAuthUrl("/dashboard", userProfile?.email) },
          ],
        ],
      };

      await sendTelegramReply(chatId, msg, replyMarkup);
      return NextResponse.json({ ok: true });
    }

    // 5. Comando /posiciones o /positions
    if (command === "/posiciones" || command === "/positions") {
      if (!userProfile) {
        const msg = `📈 <b>Tus Posiciones:</b>

🆔 <b>Tu Chat ID:</b> <code>${chatId}</code>
⚠️ <i>Vincula este Chat ID en <a href="${buildWebAuthUrl("/settings")}">Ajustes</a> de la web para ver tus posiciones.</i>`;
        await sendTelegramReply(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      // ── CASO A: ENTORNO REAL (CONSULTA ON-CHAIN DE SU WALLET) ──
      if (isRealMode) {
        if (!userProfile.wallet_address) {
          const msg = `🔵 <b>Posiciones en MODO REAL:</b>

⚠️ <b>No has conectado tu dirección pública de Hyperliquid.</b>
Para ver las posiciones abiertas en tu cuenta real, vincúlala en:
👉 <a href="${buildWebAuthUrl("/settings", userProfile?.email)}">Ajustes & Billetera Real</a>

💡 <i>Escribe /modo para cambiar al Modo Simulado.</i>`;
          await sendTelegramReply(chatId, msg);
          return NextResponse.json({ ok: true });
        }

        try {
          const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: userProfile.wallet_address }),
          });

          if (stateRes.ok) {
            const state = await stateRes.json();
            const rawPositions = state.assetPositions || [];
            const activePos = rawPositions
              .filter((p: any) => p.position && Math.abs(parseFloat(p.position.szi || "0")) > 0)
              .map((p: any) => {
                const pos = p.position;
                const szi = parseFloat(pos.szi || "0");
                return {
                  coin: pos.coin,
                  side: szi > 0 ? "LONG" : "SHORT",
                  size: Math.abs(szi),
                  entryPx: parseFloat(pos.entryPx || "0"),
                  markPx: parseFloat(pos.markPx || "0"),
                  unrealizedPnl: parseFloat(pos.unrealizedPnl || "0"),
                  leverage: parseFloat(pos.leverage?.value || "1"),
                  marginUsed: parseFloat(pos.marginUsed || "0"),
                };
              });

            if (activePos.length === 0) {
              const msg = `🔵 <b>Tus Posiciones REALES en Hyperliquid:</b> <code>0 activas</code>
<code>${userProfile.wallet_address.slice(0, 10)}...${userProfile.wallet_address.slice(-6)}</code>

Actualmente tu billetera no tiene ninguna posición abierta en Hyperliquid DEX. Tu capital está 100% disponible en USDC.

💡 <i>Entorno activo: 🔵 REAL. Escribe /modo para cambiar a Simulado.</i>
👉 <i>Ver en Hyperliquid: <a href="https://app.hyperliquid.xyz/portfolio">Abrir Portfolio</a></i>`;
              await sendTelegramReply(chatId, msg);
              return NextResponse.json({ ok: true });
            }

            let realPnlTotal = 0;
            let realMarginTotal = 0;

            let msg = `🔵 <b>Tus Posiciones REALES Abiertas en Hyperliquid (${activePos.length}):</b>
<code>${userProfile.wallet_address.slice(0, 10)}...${userProfile.wallet_address.slice(-6)}</code>\n\n`;

            activePos.forEach((p: any) => {
              realPnlTotal += p.unrealizedPnl;
              realMarginTotal += p.marginUsed;
              const icon = p.unrealizedPnl >= 0 ? "🟢" : "🔴";
              const pnlStr = `${p.unrealizedPnl >= 0 ? "+" : ""}${formatUSD(p.unrealizedPnl)}`;

              msg += `${icon} <b>${p.coin} ${p.side} ${p.leverage.toFixed(0)}x (On-Chain)</b>
• <b>Margen Usado:</b> <b>${formatUSD(p.marginUsed)} USD</b> | Tamaño: ${p.size.toFixed(4)} ${p.coin}
• <b>Entrada:</b> $${p.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2 })} | <b>Actual:</b> $${p.markPx.toLocaleString("en-US", { minimumFractionDigits: 2 })}
• <b>PnL No Realizado:</b> <b>${pnlStr} USD</b>\n\n`;
            });

            const totalIcon = realPnlTotal >= 0 ? "🟢" : "🔴";
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${totalIcon} <b>TOTAL PNL FLOTANTE REAL:</b> <b>${realPnlTotal >= 0 ? "+" : ""}${formatUSD(realPnlTotal)} USD</b>\n💰 <b>Margen Total en Uso:</b> ${formatUSD(realMarginTotal)} USD\n\n💡 <i>Toca un botón abajo para cerrar cualquier posición a mercado al instante:</i>`;

            const closeButtons: any[] = [];
            activePos.forEach((p: any) => {
              closeButtons.push([
                { text: `❌ Cerrar ${p.coin} a Mercado`, callback_data: `close_pos:${p.coin}` }
              ]);
            });

            if (activePos.length > 1) {
              closeButtons.push([
                { text: `🚨 Cerrar TODAS (${activePos.length}) a Mercado`, callback_data: `close_pos:ALL` }
              ]);
            }

            closeButtons.push([
              { text: "📊 Ver en Dashboard", url: buildWebAuthUrl("/dashboard", userProfile?.email) }
            ]);

            const replyMarkup = { inline_keyboard: closeButtons };
            await sendTelegramReply(chatId, msg, replyMarkup);
            return NextResponse.json({ ok: true });
          }
        } catch (e) {
          console.error("Error leyendo posiciones reales:", e);
        }
      }

      // ── CASO B: ENTORNO SIMULADO (RÉPLICA VIRTUAL PROPORCIONAL DE LA CESTA) ──
      const userTraders: any[] = userProfile.traders || [];
      const userTotalBalance = userProfile.cash_balance || 10000.0;

      if (userTraders.length === 0) {
        const msg = `📈 <b>Tus Posiciones Copiadas (Simulado):</b> <code>0 activas</code>

💰 <b>Tu Capital Virtual:</b> $${userTotalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD (100% en Liquidez)
👥 <b>Traders en Cesta:</b> 0 asignados.

💡 <i>Tú decides a quién copiar: entra en la web y añade traders desde el Hall de la Fama.</i>

👉 <i>Explorar Traders: <a href="${buildWebAuthUrl("/traders", userProfile?.email)}">Ir al Hall de la Fama</a></i>`;
        await sendTelegramReply(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      const myCopiedPositions: any[] = [];

      for (const t of userTraders) {
        try {
          const userCapital = userTotalBalance * (t.allocation_pct / 100);
          const maxLev = t.max_leverage || 10;
          const stopLossPct = t.stop_loss_pct || 5.0;
          const riskMultiplier = t.risk_multiplier || 1.0;
          const coinFilterMode = t.coin_filter_mode || "ALL";
          const allowedCoins = (t.allowed_coins || []).map((c: string) => c.toUpperCase());
          const blockedCoins = (t.blocked_coins || []).map((c: string) => c.toUpperCase());

          const stateRes = await fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: t.address }),
          });

          if (stateRes.ok) {
            const state = await stateRes.json();
            const traderAccountValue = parseFloat(state.marginSummary?.accountValue || "100000");
            const assetPositions = state.assetPositions || [];

            for (const ap of assetPositions) {
              const pos = ap.position;
              if (!pos) continue;

              const szi = parseFloat(pos.szi || "0");
              const entryPx = parseFloat(pos.entryPx || "0");
              const upnl = parseFloat(pos.unrealizedPnl || "0");
              const coin = (pos.coin || "").toUpperCase();

              if (szi === 0 || entryPx === 0) continue;

              if (coinFilterMode === "ALLOWLIST" && allowedCoins.length > 0 && !allowedCoins.includes(coin)) continue;
              if (coinFilterMode === "BLOCKLIST" && blockedCoins.length > 0 && blockedCoins.includes(coin)) continue;

              const ratio = (userCapital / Math.max(traderAccountValue, 1000)) * riskMultiplier;
              const userSz = Math.abs(szi) * ratio;
              const userUpnl = upnl * (userCapital / Math.max(traderAccountValue, 1000)) * riskMultiplier;
              const usdValue = userSz * entryPx;
              const myLeverage = Math.min(pos.leverage?.value || 10, maxLev);
              const myMarginUSD = usdValue / myLeverage;
              const myPnlPct = myMarginUSD > 0 ? (userUpnl / myMarginUSD) * 100 : 0;

              const slMultiplier = (stopLossPct / 100) / myLeverage;
              const myStopLossPrice = szi > 0 ? entryPx * (1 - slMultiplier) : entryPx * (1 + slMultiplier);

              myCopiedPositions.push({
                traderName: t.alias ? `${t.alias} (${t.name})` : t.name,
                coin,
                side: szi > 0 ? "LONG" : "SHORT",
                myLeverage,
                myMarginUSD,
                usdValue,
                userSz,
                entryPx,
                myStopLossPrice,
                userUpnl,
                myPnlPct,
                isProfit: userUpnl >= 0,
              });
            }
          }
        } catch (e) {
          console.error("Error consultando trader para telegram:", e);
        }
      }

      if (myCopiedPositions.length === 0) {
        const msg = `📈 <b>Tus Posiciones Copiadas (Simulado):</b> <code>0 activas</code>

💰 <b>Capital Virtual:</b> $${userTotalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
🛡️ <b>Traders Activos en Espera (${userTraders.length}):</b>
${userTraders.map((t) => `• <b>${t.alias || t.name}:</b> ${t.allocation_pct}% ($${((userTotalBalance * t.allocation_pct) / 100).toFixed(0)}) | Máx ${t.max_leverage}x`).join("\n")}

💡 <i>El bot replicará las nuevas órdenes automáticamente cuando los líderes operen.</i>
💡 <i>Entorno activo: 🟢 SIMULADO. Escribe /modo para cambiar a Real.</i>
👉 <i>Ver panel web: <a href="${buildWebAuthUrl("/dashboard", userProfile?.email)}">Ir al Dashboard</a></i>`;
        await sendTelegramReply(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      let totalFloatingPnl = 0;
      let totalMarginInvested = 0;

      let msg = `🟢 <b>Posiciones en MODO SIMULADO (Réplica Virtual — ${myCopiedPositions.length}):</b>

ℹ️ <i>Calculadas proporcionalmente a tu capital virtual asignado ($${userTotalBalance.toFixed(0)} USD).</i>\n\n`;
      myCopiedPositions.forEach((p) => {
        totalFloatingPnl += p.userUpnl;
        totalMarginInvested += p.myMarginUSD;
        const icon = p.isProfit ? "🟢" : "🔴";
        const marginStr = formatUSD(p.myMarginUSD);
        const qtyStr = formatQty(p.userSz);
        const pnlStr = `${p.isProfit ? "+" : ""}${formatUSD(p.userUpnl)}`;

        msg += `${icon} <b>${p.coin} ${p.side} ${p.myLeverage}x (Simulado)</b>
• <b>Trader:</b> ${p.traderName}
• <b>Margen Simulado:</b> <b>${marginStr} USD</b> | Tamaño: ${qtyStr} ${p.coin}
• <b>Entrada:</b> $${p.entryPx.toFixed(2)} | <b>Stop-Loss:</b> $${p.myStopLossPrice.toFixed(2)}
• <b>PnL Flotante:</b> <b>${pnlStr} USD (${p.isProfit ? "+" : ""}${p.myPnlPct.toFixed(2)}%)</b>\n\n`;
      });

      const totalIcon = totalFloatingPnl >= 0 ? "🟢" : "🔴";
      const liquidezLibre = userTotalBalance - totalMarginInvested;

      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${totalIcon} <b>TOTAL FLOTANTE VIRTUAL:</b> <b>${totalFloatingPnl >= 0 ? "+" : ""}${formatUSD(totalFloatingPnl)} USD</b>
💰 <b>Margen Simulado en Uso:</b> ${formatUSD(totalMarginInvested)} USD
💵 <b>Liquidez Libre Virtual:</b> $${liquidezLibre.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
🏦 <b>Valor Total Estimado:</b> <b>$${(userTotalBalance + totalFloatingPnl).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</b>

💡 <i>Entorno activo: 🟢 SIMULADO. Escribe /modo para cambiar a Real.</i>
👉 <i>Ver panel web completo: <a href="${buildWebAuthUrl("/dashboard", userProfile?.email)}">Ir al Dashboard</a></i>`;

      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }


    // 5. Comando /cerrar o /close
    if (command === "/cerrar" || command === "/close") {
      if (!userProfile) {
        await sendTelegramReply(chatId, "⚠️ Vincula tu cuenta en Ajustes antes de operar.");
        return NextResponse.json({ ok: true });
      }

      const coinArg = (args || "").trim().toUpperCase();

      if (coinArg) {
        const cmdId = `CMD_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, "trading_commands", cmdId), {
          action: "CLOSE",
          coin: coinArg,
          chat_id: chatId,
          user_email: userProfile.email,
          status: "PENDING",
          created_at: new Date().toISOString(),
        });

        const closeMsg = `⏳ <b>ORDEN DE CIERRE ENVIADA A HYPERLIQUID:</b>\n\n• <b>Moneda:</b> <b>${coinArg}</b>\n• <b>Tipo:</b> Liquidación a Mercado On-Chain\n• <b>Estado:</b> ⚡ Procesando en Hyperliquid L1...\n\n<i>En unos segundos recibirás la confirmación con el margen liberado.</i>`;
        await sendTelegramReply(chatId, closeMsg);
        return NextResponse.json({ ok: true });
      }

      // Si no especificó moneda, dar instrucciones claras
      const hintMsg = `❌ <b>Cerrar Posiciones On-Chain:</b>\n\nPuedes cerrar cualquier posición escribiendo:\n• <code>/cerrar HYPE</code> → Cierra tu posición de HYPE\n• <code>/cerrar ETH</code> → Cierra tu posición de ETH\n• <code>/cerrar todo</code> → Cierra TODAS tus posiciones a mercado\n\n💡 <i>O escribe <b>/posiciones</b> para ver los botones de cierre con 1 solo toque.</i>`;
      await sendTelegramReply(chatId, hintMsg);
      return NextResponse.json({ ok: true });
    }

    // 4. Comando /cesta o /traders
    if (command === "/cesta" || command === "/traders") {
      const activeTraders = isRealMode ? (userProfile?.real_traders || []) : (userProfile?.traders || []);
      const envLabel = isRealMode ? "🔵 REAL (Mainnet)" : "🟢 SIMULADA (Paper)";

      if (!userProfile || activeTraders.length === 0) {
        const msg = `👥 <b>Tu Cesta de Traders (${envLabel}):</b>

Actualmente tienes <b>0 traders configurados</b> en tu entorno <b>${envLabel}</b>.
Accede al Hall de la Fama para vincular a los mejores líderes:
👉 <a href="${buildWebAuthUrl("/traders", userProfile?.email)}">Abrir Hall de la Fama</a>

💡 <i>Usa /modo para cambiar al otro entorno.</i>`;
        await sendTelegramReply(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      let msg = `👥 <b>Tu Cesta de Copy Trading ${envLabel} (${activeTraders.length}):</b>\n\n`;

      activeTraders.forEach((t: any, idx: number) => {
        const filterStr = t.coin_filter_mode === "ALLOWLIST" ? `Solo ${t.allowed_coins?.join(", ")}` : t.coin_filter_mode === "BLOCKLIST" ? `Bloqueadas: ${t.blocked_coins?.join(", ")}` : "Todas las monedas";
        const displayName = t.alias ? `🏷️ <b>${t.alias}</b> (<i>${t.name}</i>)` : `<b>${t.name}</b>`;
        msg += `${idx + 1}. ${displayName}
• Asignación: <b>${t.allocation_pct}%</b>
• Apalancamiento Máx: <b>${t.max_leverage}x</b> | Stop Loss: <b>${t.stop_loss_pct}%</b>
• Monedas: <i>${filterStr}</i>\n\n`;
      });

      msg += `💡 <i>Entorno activo: ${envLabel}. Escribe /modo para cambiar.</i>
👉 <i>Gestionar en la web: <a href="${buildWebAuthUrl("/traders", userProfile?.email)}">Ir al Gestor de Cesta</a></i>`;

      await sendTelegramReply(chatId, msg);
      return NextResponse.json({ ok: true });
    }

    // 5. Comando /descubrir o /top
    if (command === "/descubrir" || command === "/top") {
      try {
        const discRes = await fetch(`${APP_URL}/api/discover-traders`);
        const discData = discRes.ok ? await discRes.json() : { traders: [] };
        const validTraders = (discData.traders || []).slice(0, 5);

        let msg = `🏆 <b>👑 Hall de la Fama — Top 5 Mejores Traders:</b>\n\n`;
        validTraders.forEach((t: any, idx: number) => {
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔹";
          msg += `${medal} <b>${t.name}</b> (★ <b>${t.score}</b>)
• <b>Win Rate:</b> 🟢 ${t.winRate} | <b>Max Drawdown:</b> 🛡️ ${t.drawdown}
• <b>Profit Factor:</b> ${t.profitFactor}x | <b>Sortino:</b> ${t.sortinoRatio || "N/A"}
• <b>Saldo Real:</b> $${(t.accountValue || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
👉 <i>Para auditar: /analizar ${t.address}</i>\n\n`;
        });

        msg += `💡 <i>Puedes añadir cualquiera de ellos a tu cesta en: <a href="${buildWebAuthUrl("/traders", userProfile?.email)}">tu panel web</a>.</i>`;
        await sendTelegramReply(chatId, msg);
      } catch (err: any) {
        await sendTelegramReply(chatId, `❌ Error consultando el Hall de la Fama: ${err.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    // 6. Comando /analizar <0x...>
    if (command === "/analizar" || command === "/analyze") {
      const targetAddr = args || "0x337afda118de433f5a8c8ad6d6ef48b76d027a06";
      if (!targetAddr.startsWith("0x") || targetAddr.length !== 42) {
        await sendTelegramReply(
          chatId,
          "❌ Debes indicar una dirección válida de 42 caracteres. Ejemplo:\n<code>/analizar 0x337afda118de433f5a8c8ad6d6ef48b76d027a06</code>\n\n💡 O escribe <b>/descubrir</b> para ver los mejores."
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
        const closedTrades = Array.isArray(fills) ? fills.filter((f: any) => parseFloat(f.closedPnl || "0") !== 0) : [];
        const wins = closedTrades.filter((f: any) => parseFloat(f.closedPnl) > 0).length;
        const winRate = closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(1) : "N/A";

        const msg = `🔍 <b>Auditoría On-Chain de Trader:</b>

• <b>Dirección:</b> <code>${targetAddr}</code>
• <b>Saldo en Cuenta:</b> $${accountValue.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
• <b>Tasa de Acierto:</b> <b>${winRate}%</b> (${wins}W / ${closedTrades.length - wins}L)
• <b>Operaciones Registradas:</b> ${fills.length || 0}
• <b>Posiciones Abiertas:</b> ${userState?.assetPositions?.length || 0}

👉 <i>Ver auditoría completa y gráfica: <a href="${buildWebAuthUrl("/analytics", userProfile?.email)}">Ir al Analizador Web</a></i>`;
        await sendTelegramReply(chatId, msg);
      } catch (e: any) {
        await sendTelegramReply(chatId, `❌ Error consultando Hyperliquid: ${e.message}`);
      }
      return NextResponse.json({ ok: true });
    }

    // 7. Comando /id
    if (command === "/id") {
      await sendTelegramReply(
        chatId,
        `🆔 <b>Tu Chat ID de Telegram es:</b> <code>${chatId}</code>\n\nPega este número en <a href="${buildWebAuthUrl("/settings", userProfile?.email)}">Ajustes</a> de tu plataforma web para sincronizar tus alertas y carteras al instante.`
      );
      return NextResponse.json({ ok: true });
    }

    // Default
    await sendTelegramReply(
      chatId,
      `❓ No reconozco ese comando.\n\nEscribe:\n• 📈 <b>/posiciones</b> - Ver posiciones activas de tu cesta\n• 💰 <b>/saldo</b> - Ver tu saldo y margen\n• 👥 <b>/cesta</b> - Ver tus traders\n• 🔥 <b>/descubrir</b> - Ver Hall de la Fama\n• <b>/ayuda</b> - Ver todos los comandos`
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error en webhook de Telegram:", error);
    return NextResponse.json({ ok: true });
  }
}
