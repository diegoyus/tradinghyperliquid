"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Send, CheckCircle2, AlertTriangle, RefreshCw, Zap, ShieldCheck, HelpCircle, Bell, GraduationCap, Sparkles, Wallet, Link2, Link2Off, ExternalLink, Key, Copy, ShieldAlert, BookOpen, Smartphone, QrCode } from "lucide-react";
import { getStoredProfile, saveStoredProfile, DEFAULT_GLOBAL_RISK, resetProfile, updateTradingMode, generateNewAgentWallet, verifyAgentOnChain, removeAgentWallet, isAuthenticated } from "@/lib/storage";
import { getUserProfileFromCloud, saveUserProfileToCloud } from "@/lib/cloudSync";
import { UserProfile } from "@/lib/types";

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => getStoredProfile());
  const [chatId, setChatId] = useState("");
  const [executionMode, setExecutionMode] = useState<"AUTO" | "TELEGRAM_APPROVAL">("AUTO");
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Wallet real
  const [walletAddress, setWalletAddress] = useState("");
  const [walletSaveSuccess, setWalletSaveSuccess] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [validatingWallet, setValidatingWallet] = useState(false);

  // Agent Wallet para trading real
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [agentCheckResult, setAgentCheckResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedSyncLink, setCopiedSyncLink] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      window.location.href = "/auth?redirect=/settings";
      return;
    }
    const p = getStoredProfile();
    setProfile(p);
    setChatId(p.telegram_chat_id || "");
    setExecutionMode(p.global_risk?.execution_mode || "AUTO");
    setWalletAddress(p.wallet_address || "");

    // Sincronizar en vivo con Firestore
    const syncEmail = p.email || "diegoyusdiez@gmail.com";
    getUserProfileFromCloud(syncEmail).then((cloudProf) => {
      if (cloudProf) {
        setProfile(cloudProf);
        if (cloudProf.wallet_address) setWalletAddress(cloudProf.wallet_address);
        if (cloudProf.telegram_chat_id) setChatId(cloudProf.telegram_chat_id);
        if (cloudProf.global_risk?.execution_mode) setExecutionMode(cloudProf.global_risk.execution_mode);
      }
    });

    const handleModeChange = (e: any) => {
      const cur = getStoredProfile();
      setProfile({ ...cur, trading_mode: e.detail });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("trading-mode-changed", handleModeChange);
    }

    if (p.telegram_chat_id) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: p.telegram_chat_id, profile: p }),
      }).catch(() => {});
    }

    // Comprobar automáticamente estado de Agent Wallet si existe
    if (p.wallet_address && p.agent_wallet && !p.agent_wallet.is_approved_on_chain) {
      verifyAgentOnChain(p.wallet_address, p.agent_wallet.agent_address).then((isApproved) => {
        if (isApproved) {
          const fresh = getStoredProfile();
          setProfile({ ...fresh });
        }
      });
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("trading-mode-changed", handleModeChange);
      }
    };
  }, []);

  // Validar y guardar dirección wallet
  const handleSaveWallet = async () => {
    const addr = walletAddress.trim();
    setWalletError("");

    if (!addr) {
      // Desconectar wallet
      const current = getStoredProfile();
      const updated: UserProfile = { ...current, wallet_address: "", trading_mode: "DEMO" };
      saveStoredProfile(updated);
      setProfile({ ...updated });
      setWalletSaveSuccess(true);
      setTimeout(() => setWalletSaveSuccess(false), 2500);
      return;
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setWalletError("Dirección inválida. Debe empezar por 0x y tener 42 caracteres (dirección Ethereum/Hyperliquid).");
      return;
    }

    setValidatingWallet(true);
    try {
      // Verificar que la wallet existe en Hyperliquid (tiene datos)
      const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: addr }),
      });
      const data = await res.json();
      if (!data || !data.marginSummary) {
        setWalletError("No se encontraron datos para esta dirección en Hyperliquid. Comprueba que es correcta.");
        return;
      }

      const current = getStoredProfile();
      const updated: UserProfile = {
        ...current,
        wallet_address: addr,
        trading_mode: "REAL",
      };
      saveStoredProfile(updated);
      setProfile({ ...updated });
      setWalletSaveSuccess(true);
      setTimeout(() => setWalletSaveSuccess(false), 3000);
    } catch (e: any) {
      setWalletError(`Error al verificar la wallet: ${e.message}`);
    } finally {
      setValidatingWallet(false);
    }
  };

  const handleDisconnectWallet = () => {
    if (!confirm("¿Desconectar tu billetera real? El dashboard volverá a modo PAPER (simulado).")) return;
    const current = getStoredProfile();
    const updated: UserProfile = { ...current, wallet_address: "", trading_mode: "DEMO" };
    saveStoredProfile(updated);
    setProfile({ ...updated });
    setWalletAddress("");
  };

  // Handlers para Agent Wallet
  const handleGenerateAgent = () => {
    const agent = generateNewAgentWallet("HyperCopy Trading Agent");
    const p = getStoredProfile();
    setProfile({ ...p });
    setAgentCheckResult(null);
  };

  const handleCheckAgentApproval = async () => {
    if (!profile?.wallet_address) {
      setAgentCheckResult({ success: false, msg: "Debes conectar primero tu dirección principal de Hyperliquid arriba." });
      return;
    }
    if (!profile?.agent_wallet?.agent_address) {
      setAgentCheckResult({ success: false, msg: "Genera primero un agente de trading." });
      return;
    }
    setCheckingAgent(true);
    setAgentCheckResult(null);
    try {
      const isApproved = await verifyAgentOnChain(profile.wallet_address, profile.agent_wallet.agent_address);
      const p = getStoredProfile();
      setProfile({ ...p });
      if (isApproved) {
        setAgentCheckResult({ success: true, msg: "✅ ¡Agente verificado y autorizado on-chain en Hyperliquid DEX! Tu cuenta real está lista para operar." });
      } else {
        setAgentCheckResult({ success: false, msg: "Aún no aparece autorizado on-chain. Ve a app.hyperliquid.xyz/API, pega la dirección del agente y pulsa 'Approve Agent'." });
      }
    } catch (err: any) {
      setAgentCheckResult({ success: false, msg: `Error comprobando en Hyperliquid: ${err.message}` });
    } finally {
      setCheckingAgent(false);
    }
  };

  const handleRemoveAgent = () => {
    if (window.confirm("¿Deseas desvincular este agente de trading?")) {
      const p = removeAgentWallet();
      setProfile({ ...p });
      setAgentCheckResult(null);
    }
  };

  const [syncingKey, setSyncingKey] = useState(false);
  const [syncKeyMsg, setSyncKeyMsg] = useState<{ success: boolean; msg: string } | null>(null);
  const [manualKeyInput, setManualKeyInput] = useState("");
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);

  const handleSyncAgentKey = async () => {
    setSyncingKey(true);
    setSyncKeyMsg(null);
    try {
      let keyToSync = profile?.agent_wallet?.agent_private_key || manualKeyInput.trim();
      if (!keyToSync && typeof window !== "undefined") {
        const localRaw = localStorage.getItem("hyperliquid_copy_user_profile_v2");
        if (localRaw) {
          try {
            const lp = JSON.parse(localRaw);
            if (lp?.agent_wallet?.agent_private_key) keyToSync = lp.agent_wallet.agent_private_key;
          } catch {}
        }
      }

      if (!keyToSync) {
        setShowManualKeyInput(true);
        setSyncKeyMsg({
          success: false,
          msg: "No se encontró la clave en este navegador. Introduce la clave privada abajo para sincronizarla.",
        });
        return;
      }

      const updatedProfile: UserProfile = {
        ...profile,
        agent_wallet: {
          ...profile.agent_wallet!,
          agent_private_key: keyToSync,
        }
      };

      saveStoredProfile(updatedProfile);
      const ok = await saveUserProfileToCloud(updatedProfile);
      if (ok) {
        setProfile({ ...updatedProfile });
        setSyncKeyMsg({
          success: true,
          msg: "¡Clave de ejecución cifrada con éxito (AES-256) y conectada al motor 24/7 en la nube!",
        });
      } else {
        setSyncKeyMsg({
          success: false,
          msg: "Error guardando en Firestore. Revisa tu conexión a internet.",
        });
      }
    } catch (e: any) {
      setSyncKeyMsg({ success: false, msg: `Error: ${e.message}` });
    } finally {
      setSyncingKey(false);
    }
  };

  const handleCopyAgent = () => {
    if (profile?.agent_wallet?.agent_address) {
      navigator.clipboard.writeText(profile.agent_wallet.agent_address);
      setCopiedAgent(true);
      setTimeout(() => setCopiedAgent(false), 2000);
    }
  };

  const handleSelectExecutionMode = (mode: "AUTO" | "TELEGRAM_APPROVAL") => {
    setExecutionMode(mode);
    const current = getStoredProfile();
    const updated: UserProfile = {
      ...current,
      global_risk: {
        ...(current.global_risk || DEFAULT_GLOBAL_RISK),
        execution_mode: mode,
      },
    };
    saveStoredProfile(updated);
    setProfile({ ...updated });

    if (current.telegram_chat_id) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: current.telegram_chat_id, profile: updated }),
      }).catch(() => {});
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const current = getStoredProfile();
    const updated: UserProfile = {
      ...current,
      telegram_chat_id: chatId.trim(),
      global_risk: {
        ...(current.global_risk || DEFAULT_GLOBAL_RISK),
        execution_mode: executionMode,
      },
    };
    saveStoredProfile(updated);
    setProfile({ ...updated });

    if (chatId.trim()) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim(), profile: updated }),
      }).catch(() => {});
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleTestTelegram = async () => {
    if (!chatId.trim()) {
      setTestResult({ success: false, msg: "Introduce primero tu Chat ID de Telegram." });
      return;
    }
    setTestingTelegram(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim(), executionMode }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, msg: "¡Mensaje de prueba entregado con éxito a tu Telegram!" });
      } else {
        setTestResult({
          success: false,
          msg: `Error: ${data.error}. Recuerda iniciar el chat con el bot antes de recibir mensajes.`,
        });
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: `Error de conexión: ${e.message}` });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleResetPortfolio = () => {
    if (confirm("¿Estás seguro de que deseas reiniciar tu saldo a $10,000 USD y borrar el historial simulado?")) {
      const fresh = resetProfile();
      setProfile({ ...fresh });
      alert("Cartera reiniciada a $10,000 USD.");
    }
  };

  const isReal = profile.trading_mode === "REAL";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-surface-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Ajustes & Alertas de Telegram</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configura tu entorno de operación (Simulado vs Real), billetera y alertas de Telegram.
        </p>
      </div>

      {/* SELECTOR DE ENTORNO: SIMULADO (VERDE) VS REAL (AZUL) */}
      <div className={`p-6 rounded-2xl border-2 space-y-5 transition-all ${
        isReal
          ? "bg-blue-950/20 border-blue-500/40 shadow-xl shadow-blue-950/30"
          : "bg-surface border-emerald-500/30 shadow-xl shadow-emerald-950/20"
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Entorno de Operación Activo</span>
              {isReal ? (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-black border border-blue-500/40 animate-pulse">
                  🔵 REAL (HYPERLIQUID)
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-black border border-emerald-500/30">
                  🟢 SIMULADO (PAPER TRADING)
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Cambia la paleta de colores y el origen de datos tanto en la web como en Telegram.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Opción 1: Simulado */}
          <div
            onClick={() => {
              const u = updateTradingMode("DEMO");
              setProfile({ ...u });
            }}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              !isReal
                ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                : "border-surface-border bg-background/50 hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🟢</span>
                <span className="font-extrabold text-white text-sm">Entorno Simulado</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Verde • Paper
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
              Opera con <strong>$10,000 USD virtuales</strong>. Ideal para probar traders y estrategias sin riesgo de capital. Paleta en tonos esmeralda.
            </p>
          </div>

          {/* Opción 2: Real */}
          <div
            onClick={() => {
              const u = updateTradingMode("REAL");
              setProfile({ ...u });
            }}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              isReal
                ? "border-blue-500 bg-blue-600/15 shadow-lg shadow-blue-500/15"
                : "border-surface-border bg-background/50 hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔵</span>
                <span className="font-extrabold text-white text-sm">Entorno Real</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Azul • Mainnet
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
              Consulta en tiempo real tu <strong>saldo de Hyperliquid</strong> y tus posiciones on-chain. Paleta de colores en azul real.
            </p>
          </div>
        </div>
      </div>

      {/* BANNER DESTACADO SI ESTÁ EN MODO REAL Y NO TIENE AGENTE */}
      {isReal && !profile.agent_wallet && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-blue-950/40 to-cyan-950/40 border-2 border-blue-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-blue-950/30 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <span>Paso Requerido: Generar tu Agente de Trading</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/30 text-blue-200 border border-blue-400/40 font-bold">
                  1 Clic
                </span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Para que el bot pueda abrir y cerrar órdenes reales sin tocar tus fondos, genera tu Agent Wallet aquí abajo o pulsa el botón directo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGenerateAgent}
            className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30 shrink-0 self-start sm:self-auto"
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Generar Agente Ahora (1 Clic)</span>
          </button>
        </div>
      )}

      {/* 0. CONEXIÓN BILLETERA REAL */}
      <div className={`p-6 rounded-2xl border-2 space-y-5 transition-all ${
        profile.wallet_address
          ? "bg-surface border-primary/40 shadow-lg shadow-primary/5"
          : "bg-surface border-surface-border"
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              profile.wallet_address
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                : "bg-surface border border-surface-border text-gray-400"
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Billetera Real de Hyperliquid
                {profile.wallet_address ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 animate-pulse">
                    🟢 CONECTADA
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-gray-400 font-bold border border-surface-border">
                    PAPER MODE
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                {profile.wallet_address
                  ? "Tu saldo y posiciones reales se muestran en el dashboard."
                  : "Introduce tu dirección pública (0x...) para ver tu saldo real de Hyperliquid."}
              </p>
            </div>
          </div>
          {walletSaveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> {profile.wallet_address ? "¡Billetera conectada!" : "Desconectada"}
            </span>
          )}
        </div>

        {/* Info box */}
        <div className="p-4 rounded-xl bg-background/60 border border-surface-border text-xs text-gray-300 space-y-2">
          <div className="font-bold text-white flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            ¿Qué significa conectar tu billetera?
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-400">
            <li>Solo leeremos tu <strong>saldo real de USDC</strong> y <strong>posiciones abiertas</strong> desde Hyperliquid.</li>
            <li>No se ejecuta ninguna orden ni transacción. Solo lectura. <strong className="text-emerald-400">100% seguro.</strong></li>
            <li>Tu dirección pública es como tu número de cuenta — no es una clave privada.</li>
            <li>El dashboard pasará de mostrar datos simulados a tus <strong className="text-white">datos reales</strong>.</li>
          </ul>
          <a
            href="https://app.hyperliquid.xyz/portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold mt-1"
          >
            <ExternalLink className="w-3 h-3" /> Ver mi cartera en Hyperliquid
          </a>
        </div>

        {/* Banner de Guía de Fondeo */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💰</span>
            <div>
              <h4 className="text-xs font-bold text-amber-300">
                ¿Necesitas fondear tu cuenta con USDC y gas en Arbitrum?
              </h4>
              <p className="text-[11px] text-gray-300 mt-0.5">
                Consulta nuestra nueva Guía con requisitos mínimos, redes y pasos para cambiar Bitcoin o retirar de Binance/Bybit.
              </p>
            </div>
          </div>
          <Link
            href="/guide?tab=FONDEO"
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shrink-0 transition-all shadow-sm"
          >
            <span>Ver Guía de Fondeo</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Input + acciones */}
        {profile.wallet_address ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-background/60 border border-emerald-500/30">
              <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono text-xs text-emerald-300 truncate flex-1">{profile.wallet_address}</span>
              <a
                href={`https://app.hyperliquid.xyz/portfolio`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-primary transition-colors"
                title="Ver en Hyperliquid"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <button
              type="button"
              onClick={handleDisconnectWallet}
              className="flex items-center gap-2 py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-xs transition-all"
            >
              <Link2Off className="w-3.5 h-3.5" />
              Desconectar billetera (volver a PAPER)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                Tu dirección pública de Hyperliquid
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => { setWalletAddress(e.target.value); setWalletError(""); }}
                  placeholder="0x1234abcd... (42 caracteres)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-surface-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveWallet}
                  disabled={validatingWallet}
                  className="py-2.5 px-6 rounded-xl bg-emerald-500 text-black font-extrabold text-xs hover:bg-emerald-400 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {validatingWallet ? "Verificando..." : "Conectar Billetera"}
                </button>
              </div>
            </div>
            {walletError && (
              <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{walletError}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 0.1. AUTORIZACIÓN DE AGENT WALLET PARA TRADING EN REAL */}
      <div className={`p-6 rounded-2xl border-2 space-y-5 transition-all ${
        profile.agent_wallet?.is_approved_on_chain
          ? "bg-blue-950/20 border-blue-500/50 shadow-xl shadow-blue-950/20"
          : profile.agent_wallet
          ? "bg-surface border-amber-500/40"
          : "bg-surface border-surface-border"
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              profile.agent_wallet?.is_approved_on_chain
                ? "bg-blue-500/20 border border-blue-500/40 text-blue-400"
                : profile.agent_wallet
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                : "bg-surface border border-surface-border text-gray-400"
            }`}>
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Agente de Trading Delegado (Hyperliquid Agent Wallet)</span>
                {profile.agent_wallet?.is_approved_on_chain ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-black border border-blue-500/40 animate-pulse">
                    🟢 AUTORIZADO ON-CHAIN
                  </span>
                ) : profile.agent_wallet ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                    ⏳ PENDIENTE DE APROBACIÓN
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-surface text-gray-400 font-bold border border-surface-border">
                    NO CONFIGURADO
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                Permite al bot ejecutar órdenes de compra y venta en Hyperliquid DEX sin poder retirar jamás tus fondos.
              </p>
            </div>
          </div>
        </div>

        {/* Garantía de Seguridad de Hyperliquid */}
        <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-gray-300 space-y-2">
          <div className="font-extrabold text-blue-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            ¿Por qué este método es 100% seguro contra robos o hacks?
          </div>
          <p className="text-gray-400 leading-relaxed">
            Una <strong>Agent Wallet</strong> es una billetera secundaria aprobada criptográficamente por ti en el contrato de Hyperliquid.
            El protocolo de Hyperliquid restringe por diseño las funciones del agente: <strong>solo puede abrir y cerrar órdenes de trading</strong>.
            Cualquier intento de transferir, retirar o mover USDC fuera de tu billetera principal es <strong>rechazado a nivel de blockchain</strong>.
          </p>
        </div>

        {/* Contenido según si ya tiene agente generado */}
        {profile.agent_wallet ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-3 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                  Dirección Pública de tu Agente:
                </span>
                <span className="text-[11px] text-gray-500">
                  Creado el {new Date(profile.agent_wallet.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 p-2.5 rounded-lg bg-black/50 border border-surface-border text-xs font-mono text-blue-300 truncate">
                  {profile.agent_wallet.agent_address}
                </code>
                <button
                  type="button"
                  onClick={handleCopyAgent}
                  className="px-3 py-2.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-gray-300 font-bold flex items-center gap-1.5 transition-all"
                  title="Copiar dirección del agente"
                >
                  {copiedAgent ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Instrucciones de Aprobación On-Chain si no está aprobado */}
              {!profile.agent_wallet.is_approved_on_chain && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-2.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Paso para Autorizar en Hyperliquid (Única vez):
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-gray-300">
                    <li>Copia la dirección del agente de arriba.</li>
                    <li>
                      Abre la sección oficial de API de Hyperliquid:{" "}
                      <a
                        href="https://app.hyperliquid.xyz/API"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-bold inline-flex items-center gap-0.5"
                      >
                        app.hyperliquid.xyz/API <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Conecta la billetera que tienes vinculada arriba ({profile.wallet_address ? `0x...${profile.wallet_address.slice(-6)}` : "tu billetera"}).</li>
                    <li>En <strong>"Authorize API Agent"</strong>, pega la dirección del agente y pulsa <strong>"Approve Agent"</strong>.</li>
                    <li>Vuelve aquí y pulsa el botón <strong>"Comprobar Aprobación On-Chain"</strong> abajo.</li>
                  </ol>
                </div>
              )}

              {/* Feedback resultado de comprobación */}
              {agentCheckResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  agentCheckResult.success
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                }`}>
                  {agentCheckResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  )}
                  <span>{agentCheckResult.msg}</span>
                </div>
              )}

              {/* Estado de la Bóveda de Ejecución 24/7 */}
              <div className="p-4 rounded-xl bg-surface/80 border border-surface-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    Bóveda Criptográfica de Ejecución Automática 24/7:
                  </span>
                  {profile.agent_wallet.encrypted_key_payload ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Conectada y Cifrada (AES-256-GCM)
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Clave Pendiente de Sincronizar
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Para que el motor en la nube ejecute órdenes reales en Hyperliquid cuando no tengas la web abierta, la clave privada de tu Agent Wallet delegada debe estar registrada en la bóveda de la nube cifrada con grado militar (AES-256-GCM).
                </p>

                {syncKeyMsg && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    syncKeyMsg.success
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                  }`}>
                    {syncKeyMsg.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    )}
                    <span>{syncKeyMsg.msg}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncAgentKey}
                    disabled={syncingKey}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{syncingKey ? "Cifrando y Sincronizando..." : "🔐 Sincronizar Clave de Ejecución con la Nube (1 Clic)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualKeyInput(!showManualKeyInput)}
                    className="py-2.5 px-3 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-xs text-gray-300 font-bold transition-all"
                  >
                    {showManualKeyInput ? "Ocultar Entrada Manual" : "Pegar Clave Privada Manualmente"}
                  </button>
                </div>

                {showManualKeyInput && (
                  <div className="p-3 rounded-xl bg-black/40 border border-surface-border space-y-2 pt-2">
                    <label className="text-[11px] text-gray-300 font-semibold block">
                      Introduce la Clave Privada de tu Agent Wallet (0x...):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={manualKeyInput}
                        onChange={(e) => setManualKeyInput(e.target.value)}
                        placeholder="0x..."
                        className="flex-1 p-2 rounded-lg bg-black/60 border border-surface-border text-xs font-mono text-white focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleSyncAgentKey}
                        className="py-2 px-3 rounded-lg bg-primary hover:bg-primary-hover text-black font-extrabold text-xs transition-all"
                      >
                        Guardar Cifrada
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCheckAgentApproval}
                  disabled={checkingAgent}
                  className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingAgent ? "animate-spin" : ""}`} />
                  <span>{checkingAgent ? "Verificando en blockchain..." : "Comprobar Aprobación On-Chain"}</span>
                </button>

                <a
                  href="https://app.hyperliquid.xyz/API"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-4 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-xs text-gray-300 font-bold flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Hyperliquid API</span>
                </a>

                <Link
                  href="/guide"
                  className="py-2 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 font-bold flex items-center gap-1.5 transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ver Guía con Capturas</span>
                </Link>

                <button
                  type="button"
                  onClick={handleRemoveAgent}
                  className="py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs text-red-400 font-bold transition-all ml-auto"
                >
                  Desvincular Agente
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Para activar el copy trading en real, genera una Agent Wallet dedicada. Podrás aprobarla con 1 clic en Hyperliquid DEX para delegarle exclusivamente la apertura y cierre de réplicas sin permisos de retiro.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateAgent}
                className="py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Zap className="w-4 h-4" />
                <span>Generar Nuevo Agente de Trading Seguro (1 Clic)</span>
              </button>

              <Link
                href="/guide"
                className="py-3 px-5 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-gray-300 hover:text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-primary" />
                <span>¿Cómo funciona? Ver Guía Paso a Paso</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. MODO DE EJECUCIÓN: AUTOMÁTICO VS APROBACIÓN POR TELEGRAM */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Modo de Ejecución y Validación de Órdenes</h2>
                <p className="text-xs text-gray-400">¿Deseas que el bot opere al instante o que te pida confirmación previa?</p>
              </div>
            </div>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" /> Guardado
              </span>
            )}

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Modo 1: 100% Automático */}
            <div
              onClick={() => handleSelectExecutionMode("AUTO")}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                executionMode === "AUTO"
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-surface-border bg-background/50 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className={`w-5 h-5 ${executionMode === "AUTO" ? "text-primary" : "text-gray-400"}`} />
                  <span className="font-extrabold text-white text-sm">100% Automático</span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  Instantáneo ⚡
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
                Las órdenes se replican <strong>de inmediato en milisegundos</strong> en cuanto el trader opera en Hyperliquid, sin que tengas que intervenir.
              </p>
            </div>

            {/* Modo 2: Aprobación por Telegram */}
            <div
              onClick={() => handleSelectExecutionMode("TELEGRAM_APPROVAL")}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                executionMode === "TELEGRAM_APPROVAL"
                  ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                  : "border-surface-border bg-background/50 hover:border-gray-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-5 h-5 ${executionMode === "TELEGRAM_APPROVAL" ? "text-emerald-400" : "text-gray-400"}`} />
                  <span className="font-extrabold text-white text-sm">Aprobación por Telegram</span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Validación Previa 📱
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
                El bot te enviará un mensaje a Telegram con botones <strong className="text-emerald-400">[✅ Aprobar]</strong> y <strong className="text-red-400">[❌ Descartar]</strong>. La orden solo se abrirá si tú la validas primero.
              </p>
            </div>
          </div>
        </div>

        {/* 2. CONFIGURACIÓN DE TELEGRAM ALERTS */}
        <div data-tour="settings-telegram-section" className="p-6 rounded-2xl bg-surface border border-surface-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tu Conexión con Telegram</h2>
              <p className="text-xs text-gray-400">Introduce tu Chat ID para recibir alertas de ejecución o solicitudes de aprobación.</p>
            </div>
          </div>

          {/* Guía rápida para obtener Chat ID */}
          <div className="p-4 rounded-xl bg-background/60 border border-surface-border text-xs text-gray-300 space-y-2">
            <div className="font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              ¿Cómo obtener tu Telegram Chat ID en 30 segundos?
            </div>
            <ol className="list-decimal list-inside space-y-1 text-gray-400">
              <li>Abre Telegram y busca <strong>@userinfobot</strong> o nuestro bot de alertas.</li>
              <li>Pulsa <strong>/start</strong> para ver tu número de <strong>Id</strong> (ej. <code className="text-emerald-400 font-mono">123456789</code>).</li>
              <li>Pega tu número de ID en la casilla inferior y pulsa "Guardar Ajustes".</li>
            </ol>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">Tu Telegram Chat ID</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Ejemplo: 987654321"
                className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-surface-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary font-mono"
              />
              <button
                type="submit"
                className="py-2.5 px-6 rounded-xl bg-primary text-black font-extrabold text-xs hover:bg-primary-hover shadow-md shadow-primary/20 transition-all"
              >
                Guardar Ajustes
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="py-2.5 px-4 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-300 font-bold text-xs hover:bg-blue-600/30 transition-all flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {testingTelegram ? "Enviando mensaje..." : "1. Enviar Alerta Básica de Prueba"}
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!chatId.trim()) {
                  setTestResult({ success: false, msg: "Introduce primero tu Telegram Chat ID." });
                  return;
                }
                setTestingTelegram(true);
                try {
                  const res = await fetch("/api/telegram/notify-trade-approval", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chatId: chatId.trim(),
                      trade: {
                        id: `test_${Date.now()}`,
                        traderName: "Trader 0xa533 (Simulación)",
                        coin: "HYPE",
                        side: "LONG",
                        leverage: 5,
                        entryPx: 82.35,
                        usdValue: 250.0,
                        size: 3.035,
                        stopLossPx: 78.24,
                      },
                    }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setTestResult({ success: true, msg: "¡Solicitud de validación enviada a Telegram con botones [✅ Aprobar] y [❌ Rechazar]!" });
                  } else {
                    setTestResult({ success: false, msg: `Error: ${data.error}` });
                  }
                } catch (e: any) {
                  setTestResult({ success: false, msg: e.message });
                } finally {
                  setTestingTelegram(false);
                }
              }}
              disabled={testingTelegram}
              className="py-2.5 px-4 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs hover:bg-emerald-600/30 transition-all flex items-center gap-2"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Probar Notificación de Validación [Aprobar/Rechazar]</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </div>
      </form>

      {/* Guía y Tour de la Plataforma */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-amber-400" /> Guía y Tour de la Plataforma
        </h2>
        <p className="text-xs text-gray-400">
          ¿Deseas volver a repasar la guía interactiva paso a paso para aprender a configurar y copiar traders?
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.removeItem("hyperliquid_tour_completed");
              window.dispatchEvent(new CustomEvent("start-interactive-tour"));
            }
          }}
          className="py-2.5 px-4 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 hover:bg-amber-400/25 font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Volver a Iniciar Tour Interactivo
        </button>
      </div>

      {/* Sincronización Multi-Dispositivo & Móvil (Nube Firestore) */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/30 via-surface to-cyan-950/30 border-2 border-blue-500/40 space-y-4 shadow-xl shadow-blue-950/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Sincronizar con tu Móvil (Cloud Sync)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                  🟢 NUBE CONECTADA
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Lleva tu cuenta real, saldo de $98.88 USD, agente y traders a tu teléfono al instante.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-lg shadow-blue-600/30"
          >
            <QrCode className="w-4 h-4" />
            <span>📱 Escanear Código QR para tu Móvil</span>
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Tu cuenta está respaldada en la base de datos central en la nube. Puedes escanear el código QR con la cámara de tu móvil para iniciar sesión en 1 segundo con todos tus datos listos.
        </p>
      </div>

      {/* Modal QR Code */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="max-w-sm w-full p-6 rounded-3xl bg-surface border border-surface-border shadow-2xl space-y-5 text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Sincroniza con tu Teléfono</h3>
              <p className="text-xs text-gray-400 mt-1">
                Apunta con la cámara de tu móvil a este código para abrir tu sesión real automáticamente:
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-lg mx-auto">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=5&data=${encodeURIComponent(
                  `https://web-swart-phi-g84f3eyklo.vercel.app/sync?email=${profile?.email || "diegoyusdiez@gmail.com"}`
                )}`}
                alt="QR Sincronización Móvil"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `https://web-swart-phi-g84f3eyklo.vercel.app/sync?email=${profile?.email || "diegoyusdiez@gmail.com"}`
                  );
                  setCopiedSyncLink(true);
                  setTimeout(() => setCopiedSyncLink(false), 2000);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-border hover:bg-surface-border/80 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSyncLink ? "¡Enlace Copiado!" : "Copiar Enlace Directo para el Móvil"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone / Reset Portfolio */}
      <div className="p-6 rounded-2xl bg-surface border border-red-500/20 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" /> Zona de Reinicio de Cartera
        </h2>
        <p className="text-xs text-gray-400">
          Si deseas reiniciar todas tus estadísticas y restablecer tu saldo inicial a <strong>$10,000 USD limpios</strong>.
        </p>
        <button
          onClick={handleResetPortfolio}
          className="py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-xs transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reiniciar mi Cartera a $10,000 USD
        </button>
      </div>
    </div>
  );
}
