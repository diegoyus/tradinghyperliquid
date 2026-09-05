"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, Sliders, Shield, Star, CheckCircle2, AlertCircle, ShieldAlert, ChevronDown, ChevronUp, Zap, Gauge, Share2, Sparkles, Trophy, Crown, Award, HelpCircle, GraduationCap, Calendar } from "lucide-react";
import { getStoredProfile, updateTradersConfig, updateGlobalRisk, saveStoredProfile, isAuthenticated } from "@/lib/storage";
import { TraderConfig, UserProfile } from "@/lib/types";
import { getUserProfileFromCloud } from "@/lib/cloudSync";

import verifiedData from "@/data/verified_traders.json";
import { MetricsInfoModal } from "@/components/MetricsInfoModal";
import { CopyConfirmModal } from "@/components/CopyConfirmModal";
import { EditAliasModal } from "@/components/EditAliasModal";
import { GuidedTour } from "@/components/GuidedTour";
import { traderOperatesMemes, POPULAR_MEMECOINS, parseAssetPercentages } from "@/lib/memecoins";

const SUGGESTED_TRADERS = [
  {
    name: "El Francotirador",
    score: "9.8/10",
    winRate: "96.9%",
    drawdown: "-0.02%",
    assets: "XRP, BTC, CL",
    weeklyTradesCount: 28,
    address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06",
    desc: "Ultra-consistente. Scalping quirúrgico en momentos de alta probabilidad.",
    tags: ["Élite 👑", "Conservador 🛡️", "Scalper ⚡"],
  },
  {
    name: "Sticky (Scalping)",
    score: "9.3/10",
    winRate: "90.2%",
    drawdown: "-3.74%",
    assets: "BTC, ETH, ZEC",
    weeklyTradesCount: 45,
    address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe",
    desc: "Alta frecuencia en BTC/ETH con control estricto de pérdidas y momentum.",
    tags: ["Scalper ⚡", "Conservador 🛡️"],
  },
  {
    name: "Macro / Acciones",
    score: "8.9/10",
    winRate: "86.4%",
    drawdown: "-0.05%",
    assets: "BTC, TSLA, SPCX",
    weeklyTradesCount: 14,
    address: "0xb6db1b4dc6244f86e482d834739d949d799e4da5",
    desc: "Operador de macro y rupturas con ratios riesgo/beneficio asimétricos.",
    tags: ["Swing Trader 🌊", "Conservador 🛡️"],
  },
  {
    name: "Especialista SOL",
    score: "8.5/10",
    winRate: "88.0%",
    drawdown: "-0.38%",
    assets: "SOL, ETH, SKHX",
    weeklyTradesCount: 19,
    address: "0xab7fb756330e3983e676f44c03dabda9120aa273",
    desc: "Tendencial en Solana y ecosistema con movimientos amplios y disciplina.",
    tags: ["Conservador 🛡️", "Swing Trader 🌊"],
  },

  {
    name: "Trader 0xa533 (HYPE)",
    score: "9.9/10",
    winRate: "99.3%",
    drawdown: "-0.0%",
    assets: "HYPE, PURR, BTC",
    weeklyTradesCount: 38,
    address: "0xa5339253c51c6f4d5ff950d63427fe256e84ba55",
    desc: "Bóveda de $505,000 USD. 1.157 trades ganados con Profit Factor de 6187.6x.",
    tags: ["Élite 👑", "Conservador 🛡️", "Scalper ⚡"],
  },
  {
    name: "Trader 0x4a20 (GOLD)",
    score: "9.9/10",
    winRate: "100.0%",
    drawdown: "-0.0%",
    assets: "xyz:GOLD, BTC",
    weeklyTradesCount: 16,
    address: "0x4a20b9496610941053858bd0b7e92493f44c3c26",
    desc: "Ballena de $1.82M USD con 100% acierto en coberturas institucionales.",
    tags: ["Élite 👑", "Conservador 🛡️"],
  }
];

export default function TradersPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [customName, setCustomName] = useState("");
  const [customAlloc, setCustomAlloc] = useState(25);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [expandedTrader, setExpandedTrader] = useState<number | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("ALL");
  const [excludeMemes, setExcludeMemes] = useState(false);
  const [hideInactive, setHideInactive] = useState(true); // Ocultar pausados/inactivos por defecto

  // Modales
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [copyModalTrader, setCopyModalTrader] = useState<any>(null);
  const [aliasModalTrader, setAliasModalTrader] = useState<any>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const verifiedList = (verifiedData as any)?.traders || [];
  const verifiedMap = new Map<string, any>(verifiedList.map((v: any) => [v.address.toLowerCase(), v]));

  // Cargar Top 5 del Hall de la Fama a partir de verified_traders.json o lista curada
  const hallOfFameTraders = useMemo(() => {
    const verified = verifiedList.filter((t: any) => t.passedFilter);
    if (verified.length > 0) {
      const titles = [
        "🥇 #1 Gran Campeón Alpha",
        "🥈 #2 Maestro de la Consistencia",
        "🥉 #3 Escalpador Quirúrgico",
        "⭐ #4 Titán Institucional",
        "⭐ #5 Guardián de Patrimonio",
      ];
      return verified.slice(0, 5).map((t: any, idx: number) => ({
        rankTitle: titles[idx] || `⭐ #${idx + 1} Élite`,
        name: t.name || `Trader #${idx + 1}`,
        score: `${t.score}/10`,
        winRate: `${t.winRate}%`,
        drawdown: `-${t.maxDrawdownPct}%`,
        assets: t.topAssets || "Crypto",
        weeklyTradesCount: typeof t.weekTradesCount === "number" ? t.weekTradesCount : 0,
        address: t.address,
        accountValue: t.accountValue,
        profitFactor: t.profitFactor,
        sortinoRatio: t.sortinoRatio,
        calmarRatio: t.calmarRatio,
        desc: t.filterAuditReason || "Superó el 100% de la batería forense cuantitativa.",
        tags: t.tags && t.tags.length > 0 ? t.tags : ["Élite 👑", "Conservador 🛡️"],
      }));
    }
    return SUGGESTED_TRADERS.slice(0, 5).map((s, idx) => ({
      ...s,
      rankTitle: `⭐ #${idx + 1} Élite`,
      profitFactor: 8.5,
      sortinoRatio: 12.4,
      calmarRatio: 15.2,
      accountValue: 150000,
    }));
  }, [verifiedList]);

  useEffect(() => {
    if (!isAuthenticated()) {
      window.location.href = "/auth?redirect=/traders";
      return;
    }
    const p = getStoredProfile();
    setProfile(p);

    // Sincronizar en vivo con la nube (Firestore) para evitar desfaces entre dispositivos
    const syncEmail = p.email || "diegoyusdiez@gmail.com";
    getUserProfileFromCloud(syncEmail).then((cloudProfile) => {
      if (cloudProfile) {
        setProfile(cloudProfile);
        saveStoredProfile(cloudProfile);
      }
    }).catch(() => {});

    if (p.telegram_chat_id) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: p.telegram_chat_id, profile: p }),
      }).catch(() => {});
    }
    if (typeof window !== "undefined" && localStorage.getItem("hyperliquid_tour_active") === "true") {
      setTourOpen(true);
      localStorage.removeItem("hyperliquid_tour_active");
    }

    const handleModeChange = (e: any) => {
      const cur = getStoredProfile();
      setProfile({ ...cur, trading_mode: e.detail });
    };

    window.addEventListener("trading-mode-changed", handleModeChange);
    return () => window.removeEventListener("trading-mode-changed", handleModeChange);
  }, []);

  if (!profile) return null;

  const isReal = profile.trading_mode === "REAL";
  const activeTraders = isReal ? (profile.real_traders || []) : (profile.traders || []);
  const totalAlloc = activeTraders.reduce((acc, t) => acc + (t.allocation_pct || 0), 0);

  const flashSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleUpdateTraderField = (index: number, field: keyof TraderConfig, value: any) => {
    const updated = [...activeTraders];
    updated[index] = { ...updated[index], [field]: value };
    const newProfile = updateTradersConfig(updated, isReal ? "REAL" : "DEMO");
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleSaveAlias = (address: string, newAlias: string) => {
    const updated = activeTraders.map((t) => {
      if (t.address.toLowerCase() === address.toLowerCase()) {
        return { ...t, alias: newAlias ? newAlias.trim() : undefined };
      }
      return t;
    });
    const newProfile = updateTradersConfig(updated, isReal ? "REAL" : "DEMO");
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleApplyPreset = (index: number, preset: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") => {
    const updated = [...activeTraders];
    if (preset === "CONSERVATIVE") {
      updated[index] = {
        ...updated[index],
        risk_multiplier: 0.6,
        max_leverage: 3,
        stop_loss_pct: 4.0,
        max_trade_sizing_pct: 15.0,
      };
    } else if (preset === "BALANCED") {
      updated[index] = {
        ...updated[index],
        risk_multiplier: 1.0,
        max_leverage: 10,
        stop_loss_pct: 6.0,
        max_trade_sizing_pct: 25.0,
      };
    } else if (preset === "AGGRESSIVE") {
      updated[index] = {
        ...updated[index],
        risk_multiplier: 1.5,
        max_leverage: 20,
        stop_loss_pct: 10.0,
        max_trade_sizing_pct: 35.0,
      };
    }
    const newProfile = updateTradersConfig(updated, isReal ? "REAL" : "DEMO");
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleRemoveTrader = (index: number) => {
    const updated = activeTraders.filter((_, i) => i !== index);
    const newProfile = updateTradersConfig(updated, isReal ? "REAL" : "DEMO");
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleOpenCopyModal = (item: any) => {
    const exists = activeTraders.some((t) => t.address.toLowerCase() === item.address.toLowerCase());
    if (exists) {
      alert(`Este trader ya está en tu cesta ${isReal ? "REAL" : "SIMULADA"}.`);
      return;
    }
    setCopyModalTrader(item);
  };

  const handleConfirmCopy = (config: {
    alias?: string;
    allocation_pct: number;
    copy_existing_positions: boolean;
    max_leverage: number;
    stop_loss_pct: number;
    coin_filter_mode?: "ALL" | "ALLOWLIST" | "BLOCKLIST";
    allowed_coins?: string[];
    blocked_coins?: string[];
  }) => {
    if (!copyModalTrader) return;
    const newTrader: TraderConfig = {
      name: copyModalTrader.name,
      alias: config.alias || undefined,
      score: copyModalTrader.score,
      address: copyModalTrader.address.toLowerCase(),
      allocation_pct: config.allocation_pct,
      risk_multiplier: 1.0,
      max_leverage: config.max_leverage,
      stop_loss_pct: config.stop_loss_pct,
      max_trade_sizing_pct: 25.0,
      copy_existing_positions: config.copy_existing_positions,
      joined_at: Date.now(),
      coin_filter_mode: config.coin_filter_mode || "ALL",
      allowed_coins: config.allowed_coins || [],
      blocked_coins: config.blocked_coins || [],
    };
    const updated = [...activeTraders, newTrader];
    const newProfile = updateTradersConfig(updated, isReal ? "REAL" : "DEMO");
    setProfile({ ...newProfile });

    if (newProfile.telegram_chat_id) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: newProfile.telegram_chat_id, profile: newProfile }),
      }).catch(() => {});
    }

    setCopyModalTrader(null);
    flashSaved();
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddress.startsWith("0x") || customAddress.length !== 42) {
      alert("Introduce una dirección válida de 42 caracteres que empiece por 0x");
      return;
    }
    const customItem = {
      name: customName || `Trader ${customAddress.slice(0, 6)}`,
      score: "Custom",
      address: customAddress.toLowerCase(),
    };
    setCopyModalTrader(customItem);
    setCustomAddress("");
    setCustomName("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fadeIn pb-12">
      {/* Modales de Ayuda e Información */}
      <MetricsInfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
      <CopyConfirmModal
        isOpen={!!copyModalTrader}
        trader={copyModalTrader}
        onClose={() => setCopyModalTrader(null)}
        onConfirm={handleConfirmCopy}
      />
      <GuidedTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            Gestión de Cartera de Copia
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Asigna capital, ajusta apalancamiento y copia a los mejores operadores de Hyperliquid.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTourOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-primary/20 text-primary border border-primary/40 text-xs font-black hover:bg-primary/30 transition-all flex items-center gap-1.5 shadow-sm shadow-primary/10"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Guía Paso a Paso</span>
          </button>

          <button
            onClick={() => setInfoModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-border text-gray-300 border border-surface-border text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>¿Qué significan las métricas?</span>
          </button>

          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </div>
          )}
        </div>
      </div>

      {/* Total Allocation Progress Bar */}
      <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-300">Asignación Total de Capital</span>
          <span className={`font-mono font-bold text-sm ${totalAlloc > 100 ? "text-red-400" : totalAlloc === 100 ? "text-emerald-400" : "text-primary"}`}>
            {totalAlloc}% / 100%
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-3 overflow-hidden border border-surface-border flex">
          <div
            className={`h-full transition-all duration-300 ${totalAlloc > 100 ? "bg-red-500" : "bg-primary"}`}
            style={{ width: `${Math.min(totalAlloc, 100)}%` }}
          />
        </div>
        {totalAlloc === 0 && (
          <p className="text-xs text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Tu cesta está vacía. Elige un trader del Hall de la Fama para empezar a copiar.
          </p>
        )}
      </div>

      {/* Mis Traders Copiados */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Mi Cesta de Traders {isReal ? "REAL (Mainnet)" : "SIMULADA (Paper)"} ({activeTraders.length})
          </h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
            isReal ? "bg-blue-500/20 text-blue-300 border border-blue-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          }`}>
            {isReal ? "🔵 Entorno Real Activo" : "🟢 Entorno Simulado Activo"}
          </span>
        </div>

        {activeTraders.length === 0 ? (
          <div className={`p-8 rounded-3xl border text-center space-y-3 ${
            isReal ? "bg-blue-950/20 border-blue-500/30" : "bg-surface/50 border-surface-border"
          }`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              isReal ? "bg-blue-500/10 text-blue-400 border border-blue-500/30" : "bg-primary/10 text-primary border border-primary/30"
            }`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">
              No tienes traders asignados en tu cesta {isReal ? "REAL" : "SIMULADA"}
            </h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              {isReal
                ? "Explora el Hall de la Fama abajo y pulsa '+ Copiar a mi Cesta' para configurar los líderes que replicarás con tu billetera real en Hyperliquid DEX."
                : "Tu cuenta tiene $10,000 USD limpios de prueba. Explora el Hall de la Fama abajo y pulsa '+ Copiar a mi Cesta' para empezar a simular."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeTraders.map((t, idx) => {
              const isExpanded = expandedTrader === idx;
              return (
                <div key={idx} className="p-5 rounded-2xl bg-surface border border-surface-border space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {t.alias ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-extrabold text-amber-300 text-base">🏷️ {t.alias}</span>
                            <span className="text-xs text-gray-400 font-medium">({t.name})</span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-white text-base">{t.name}</span>
                        )}
                        {t.score && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                            ★ {t.score}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {t.copy_existing_positions ? "⚡ Posiciones Abiertas Copiadas" : "🛡️ Solo Nuevas Órdenes"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" /> {verifiedMap.get(t.address.toLowerCase())?.weekTradesCount ? `~${verifiedMap.get(t.address.toLowerCase())?.weekTradesCount} trades/sem` : "0 trades recientes"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAliasModalTrader(t)}
                          className="px-2 py-0.5 rounded-md bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Cambiar Alias Personalizado"
                        >
                          <span>✏️ {t.alias ? "Editar Alias" : "+ Poner Alias"}</span>
                        </button>
                      </div>
                      <span className="font-mono text-xs text-gray-400 block mt-0.5">{t.address}</span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setExpandedTrader(isExpanded ? null : idx)}
                        className="px-3 py-1.5 rounded-lg bg-background border border-surface-border text-xs text-gray-300 hover:text-white font-bold flex items-center gap-1"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>{isExpanded ? "Ocultar Ajustes" : "Ajustar Riesgo"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveTrader(idx)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        title="Eliminar de mi cesta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Asignación Slider */}
                  <div
                    data-tour={idx === 0 ? "first-trader-allocation" : undefined}
                    className="space-y-1.5 pt-2 border-t border-surface-border/50"
                  >
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400 font-semibold">Asignación de Capital</span>
                      <span className="font-mono font-bold text-primary">{t.allocation_pct}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={t.allocation_pct}
                      onChange={(e) => handleUpdateTraderField(idx, "allocation_pct", Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Panel Extendido de Riesgo */}
                  {isExpanded && (
                    <div className="p-4 rounded-xl bg-background/80 border border-surface-border space-y-4 text-xs animate-fadeIn">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApplyPreset(idx, "CONSERVATIVE")}
                          className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold hover:bg-emerald-500/20"
                        >
                          Preset Conservador 🛡️
                        </button>
                        <button
                          onClick={() => handleApplyPreset(idx, "BALANCED")}
                          className="px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 font-bold hover:bg-primary/20"
                        >
                          Preset Equilibrado ⚖️
                        </button>
                      </div>

                      {/* Alias Personalizado Editable */}
                      <div className="space-y-1 bg-surface/50 p-3 rounded-xl border border-surface-border">
                        <label className="text-[11px] font-bold text-gray-300 flex items-center justify-between">
                          <span>🏷️ Alias Personalizado (Opcional):</span>
                          <span className="text-[10px] text-gray-500">Para identificarlo en alertas y tablas</span>
                        </label>
                        <input
                          type="text"
                          value={t.alias || ""}
                          onChange={(e) => handleUpdateTraderField(idx, "alias", e.target.value)}
                          placeholder={`Ej. "Scalper Oro", "Mi Trader Favorito", "${t.name}"`}
                          className="w-full px-3 py-1.5 rounded-lg bg-background border border-surface-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-primary font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-gray-400 font-semibold block">Apalancamiento Máximo</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={t.max_leverage}
                            onChange={(e) => handleUpdateTraderField(idx, "max_leverage", Number(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 font-semibold block">Stop Loss por Posición (%)</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            step={0.5}
                            value={t.stop_loss_pct}
                            onChange={(e) => handleUpdateTraderField(idx, "stop_loss_pct", Number(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 font-semibold block">Multiplicador de Tamaño</label>
                          <input
                            type="number"
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            value={t.risk_multiplier}
                            onChange={(e) => handleUpdateTraderField(idx, "risk_multiplier", Number(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-lg bg-surface border border-surface-border text-white text-xs font-mono"
                          />
                        </div>

                        {/* Filtro de Criptomonedas */}
                        <div className="sm:col-span-3 pt-3 border-t border-surface-border/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300 font-bold text-xs">Filtro de Criptomonedas</span>
                            <div className="flex gap-1 text-[10px]">
                              <button
                                type="button"
                                onClick={() => handleUpdateTraderField(idx, "coin_filter_mode", "ALL")}
                                className={`px-2 py-0.5 rounded font-bold ${
                                  (t.coin_filter_mode || "ALL") === "ALL"
                                    ? "bg-primary text-black"
                                    : "bg-surface text-gray-400 border border-surface-border"
                                }`}
                              >
                                Todas
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateTraderField(idx, "coin_filter_mode", "ALLOWLIST")}
                                className={`px-2 py-0.5 rounded font-bold ${
                                  t.coin_filter_mode === "ALLOWLIST"
                                    ? "bg-emerald-500 text-black"
                                    : "bg-surface text-emerald-400 border border-surface-border"
                                }`}
                              >
                                Solo Permitidas
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateTraderField(idx, "coin_filter_mode", "BLOCKLIST")}
                                className={`px-2 py-0.5 rounded font-bold ${
                                  t.coin_filter_mode === "BLOCKLIST"
                                    ? "bg-red-500 text-white"
                                    : "bg-surface text-red-400 border border-surface-border"
                                }`}
                              >
                                Bloquear
                              </button>
                            </div>
                          </div>

                          {t.coin_filter_mode === "ALLOWLIST" && (
                            <div className="p-2.5 rounded-lg bg-surface/60 border border-surface-border/60 space-y-1.5">
                              <span className="text-[10px] text-gray-400 block">Solo copiar las siguientes monedas:</span>
                              <div className="flex flex-wrap gap-1">
                                {["BTC", "ETH", "SOL", "HYPE", "XRP"].map((coin) => {
                                  const allowed = t.allowed_coins || ["BTC", "ETH"];
                                  const isAllowed = allowed.includes(coin);
                                  return (
                                    <button
                                      key={coin}
                                      type="button"
                                      onClick={() => {
                                        const newAllowed = isAllowed
                                          ? allowed.filter((c) => c !== coin)
                                          : [...allowed, coin];
                                        handleUpdateTraderField(idx, "allowed_coins", newAllowed);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                        isAllowed
                                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                          : "bg-background text-gray-500 border-surface-border"
                                      }`}
                                    >
                                      {isAllowed ? `✓ ${coin}` : `+ ${coin}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {t.coin_filter_mode === "BLOCKLIST" && (
                            <div className="p-2.5 rounded-lg bg-surface/60 border border-surface-border/60 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 block">Monedas bloqueadas:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allMemes = ["PUMP", "DOGE", "PEPE", "WIF", "BONK", "SHIB", "FLOKI", "POPCAT", "kPEPE", "kBONK", "PURR"];
                                    const existing = t.blocked_coins || [];
                                    handleUpdateTraderField(idx, "blocked_coins", Array.from(new Set([...existing, ...allMemes])));
                                  }}
                                  className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-md hover:bg-red-500/20"
                                >
                                  🛡️ Bloquear Todos los Memecoins
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {["PUMP", "DOGE", "HYPE", "kPEPE", "PEPE", "BONK", "WIF"].map((coin) => {
                                  const blocked = t.blocked_coins || ["PUMP", "DOGE"];
                                  const isBlocked = blocked.includes(coin);
                                  return (
                                    <button
                                      key={coin}
                                      type="button"
                                      onClick={() => {
                                        const newBlocked = isBlocked
                                          ? blocked.filter((c) => c !== coin)
                                          : [...blocked, coin];
                                        handleUpdateTraderField(idx, "blocked_coins", newBlocked);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                        isBlocked
                                          ? "bg-red-500/20 text-red-300 border-red-500/40"
                                          : "bg-background text-gray-500 border-surface-border"
                                      }`}
                                    >
                                      {isBlocked ? `✕ ${coin}` : `+ ${coin}`}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 👑 HALL DE LA FAMA: TOP 5 MEJORES TRADERS */}
      <div className="space-y-5 pt-6 border-t border-amber-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">👑</span>
              <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 flex items-center gap-2">
                Hall de la Fama
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm shadow-amber-400/20">
                Top 5 Oficial
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Los 5 traders con mayor consistencia matemática, 0% liquidaciones, máximo ratio de Sortino/Calmar y gestión de riesgo disciplinada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHideInactive(!hideInactive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                hideInactive
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10"
                  : "bg-surface text-gray-300 border-surface-border hover:border-gray-500"
              }`}
            >
              <span>{hideInactive ? "🟢 Ocultando Pausados / Inactivos" : "⚪ Mostrar Pausados"}</span>
            </button>

            <button
              type="button"
              onClick={() => setExcludeMemes(!excludeMemes)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border shadow-sm ${
                excludeMemes
                  ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-red-500/10"
                  : "bg-surface text-gray-300 border-surface-border hover:border-gray-500"
              }`}
            >
              <span>{excludeMemes ? "🚫 Memecoins Excluidos (Activo)" : "🛡️ Quitar Traders de Memecoins"}</span>
            </button>

            <button
              onClick={() => setInfoModalOpen(true)}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/30 text-xs font-bold hover:bg-amber-400/20 transition-all flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Guía de Métricas</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {hallOfFameTraders
            .filter((trader: any) => {
              if (hideInactive && (!trader.weeklyTradesCount || trader.weeklyTradesCount === 0)) return false;
              if (excludeMemes && traderOperatesMemes(trader)) return false;
              return true;
            })
            .map((trader: any, idx: number) => {
            const userTrader = activeTraders.find(
              (t) => t.address.toLowerCase() === trader.address.toLowerCase()
            );
            const alreadyInBasket = !!userTrader;

            return (
              <div
                key={idx}
                className={`relative overflow-hidden p-6 rounded-3xl transition-all flex flex-col justify-between space-y-4 ${
                  alreadyInBasket
                    ? isReal
                      ? "border-2 border-blue-400 bg-gradient-to-b from-blue-500/20 via-surface to-background/95 shadow-xl shadow-blue-500/20 ring-1 ring-blue-400/50"
                      : "border-2 border-emerald-400 bg-gradient-to-b from-emerald-500/20 via-surface to-background/95 shadow-xl shadow-emerald-500/20 ring-1 ring-emerald-400/50"
                    : "border-2 border-amber-400/60 bg-gradient-to-b from-amber-500/15 via-surface to-background/90 shadow-xl shadow-amber-500/10 hover:border-amber-300"
                }`}
              >
                {/* Ribbon de Ranking Superior & Estado Copiado */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shadow-md ${
                        alreadyInBasket
                          ? isReal
                            ? "bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-blue-500/30"
                            : "bg-gradient-to-r from-emerald-400 to-teal-400 text-black shadow-emerald-500/30"
                          : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-amber-500/20"
                      }`}>
                        {alreadyInBasket ? (isReal ? "🔵 COPIADO EN REAL" : "🟢 COPIADO EN SIMULADO") : trader.rankTitle}
                      </span>
                      {alreadyInBasket && userTrader && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          isReal ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}>
                          {userTrader.allocation_pct}% Asignado
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-white text-base mt-2 flex items-center gap-2 flex-wrap">
                      {userTrader?.alias ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-amber-300">🏷️ {userTrader.alias}</span>
                          <span className="text-xs text-gray-400 font-normal">({trader.name})</span>
                        </div>
                      ) : (
                        <span>{trader.name}</span>
                      )}
                      {alreadyInBasket && (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <button
                            type="button"
                            onClick={() => setAliasModalTrader(userTrader)}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 font-bold transition-all cursor-pointer"
                            title="Cambiar Alias"
                          >
                            ✏️ {userTrader?.alias ? "Alias" : "+ Alias"}
                          </button>
                        </div>
                      )}
                    </h3>
                    <span className="font-mono text-[11px] text-gray-400 block mt-0.5">
                      {trader.address}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black border shadow-sm block ${
                      alreadyInBasket
                        ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/50 shadow-emerald-400/20"
                        : "bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-amber-400/20"
                    }`}>
                      ★ {trader.score}
                    </span>
                    {trader.accountValue && (
                      <span className="text-[10px] text-gray-400 font-mono block mt-1">
                        ${Number(trader.accountValue).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Explicación de Valoración */}
                <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed font-medium ${
                  alreadyInBasket
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-100/90"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-100/90"
                }`}>
                  <span className={`font-bold block text-[10px] uppercase tracking-wider mb-0.5 ${
                    alreadyInBasket ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    💡 Veredicto Forense:
                  </span>
                  {trader.desc}
                </div>

                {/* Badges / Tags */}
                {trader.tags && trader.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {trader.tags.map((tag: string, tIdx: number) => (
                      <span
                        key={tIdx}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-background/80 text-gray-300 border border-surface-border shadow-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Métricas Visuales Clave */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono">
                  <div className="bg-background/50 p-2 rounded-xl border border-surface-border/50">
                    <span className="text-[9px] text-gray-400 block uppercase">Win Rate</span>
                    <span className="font-bold text-emerald-400 text-xs">{trader.winRate}</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded-xl border border-surface-border/50">
                    <span className="text-[9px] text-gray-400 block uppercase">Drawdown</span>
                    <span className="font-bold text-emerald-300 text-xs">{trader.drawdown}</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded-xl border border-surface-border/50">
                    <span className="text-[9px] text-gray-400 block uppercase">Sortino</span>
                    <span className="font-bold text-amber-300 text-xs">{trader.sortinoRatio || "99.0"}</span>
                  </div>
                  <div className="bg-background/50 p-2 rounded-xl border border-surface-border/50">
                    <span className="text-[9px] text-gray-400 block uppercase">Profit Factor</span>
                    <span className="font-bold text-blue-300 text-xs">{trader.profitFactor}x</span>
                  </div>
                  <div className={`p-2 rounded-xl border col-span-2 sm:col-span-1 ${
                    alreadyInBasket
                      ? "bg-emerald-500/20 border-emerald-400/50"
                      : "bg-amber-400/10 border-amber-400/30"
                  }`}>
                    <span className={`text-[9px] block uppercase font-bold flex items-center justify-center gap-0.5 ${
                      alreadyInBasket ? "text-emerald-300" : "text-amber-300"
                    }`}>
                      <Calendar className="w-2.5 h-2.5" /> 7D Semana
                    </span>
                    <span className={`font-extrabold text-xs ${
                      alreadyInBasket ? "text-emerald-200" : "text-amber-200"
                    }`}>
                      {trader.weeklyTradesCount || 28} trades
                    </span>
                  </div>
                </div>

                {/* 🪙 Monedas Operadas (% de Posiciones Cerradas) */}
                <div className={`space-y-1.5 pt-2.5 border-t ${
                  alreadyInBasket ? "border-emerald-400/20" : "border-amber-400/20"
                }`}>
                  <span className={`text-[10px] font-bold block uppercase tracking-wider ${
                    alreadyInBasket ? "text-emerald-300" : "text-amber-300"
                  }`}>
                    🪙 Monedas en Operaciones Cerradas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parseAssetPercentages(trader.assets).map((item, aIdx) => (
                      <span
                        key={aIdx}
                        className={`px-2.5 py-1 rounded-xl bg-background/80 border text-white font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm ${
                          alreadyInBasket ? "border-emerald-400/30" : "border-amber-400/30"
                        }`}
                      >
                        <span className={alreadyInBasket ? "text-emerald-300 font-extrabold" : "text-amber-400 font-extrabold"}>
                          {item.coin}
                        </span>
                        <span className="text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-md text-[10px] font-black">{item.pct}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                  {alreadyInBasket ? (
                    <button
                      type="button"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>✓ En tu Cesta Activa ({userTrader?.allocation_pct}%) • Ajustar arriba ↗</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-tour={idx === 0 ? "first-hof-copy-btn" : undefined}
                      onClick={() => handleOpenCopyModal(trader)}
                      className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/25 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Copiar a mi Cesta</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(trader.address);
                      const shareText = `👑 ¡Descubre al líder del Hall de la Fama de Hyperliquid! "${trader.name}" (${trader.winRate} WR, ${trader.drawdown} Max Drawdown).\nDirección on-chain: ${trader.address}`;
                      window.open(
                        `https://t.me/share/url?url=${encodeURIComponent(trader.address)}&text=${encodeURIComponent(shareText)}`,
                        "_blank"
                      );
                      alert("¡Dirección copiada y enlace para Telegram listo!");
                    }}
                    className="p-2.5 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-gray-300 hover:text-white transition-colors"
                    title="Compartir por Telegram"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Top Traders */}
      <div className="space-y-4 pt-6 border-t border-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Todos los Traders Recomendados
          </h2>
          {/* Selector de Filtro de Etiquetas */}
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "Élite 👑", "Conservador 🛡️", "Scalper ⚡", "Swing Trader 🌊"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTagFilter(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  selectedTagFilter === tag
                    ? "bg-primary text-black border-primary font-bold shadow-sm shadow-primary/20"
                    : "bg-surface text-gray-400 border-surface-border hover:text-white"
                }`}
              >
                {tag === "ALL" ? "Todos" : tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUGGESTED_TRADERS.filter((item) => {
            if (hideInactive && (!item.weeklyTradesCount || item.weeklyTradesCount === 0)) return false;
            if (excludeMemes && traderOperatesMemes(item)) return false;
            if (selectedTagFilter === "ALL") return true;
            return item.tags?.includes(selectedTagFilter);
          }).map((item, idx) => {
            const userTrader = activeTraders.find(
              (t) => t.address.toLowerCase() === item.address.toLowerCase()
            );
            const alreadyInBasket = !!userTrader;
            const isReal = userTrader?.is_real;

            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl transition-all space-y-3 ${
                  alreadyInBasket
                    ? isReal
                      ? "bg-blue-500/[0.08] border-2 border-blue-500/60 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30"
                      : "bg-emerald-500/[0.08] border-2 border-emerald-500/60 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "bg-surface/60 border border-surface-border hover:border-gray-500"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {userTrader?.alias ? (
                        <>
                          <span className="text-amber-300">🏷️ {userTrader.alias}</span>
                          <span className="text-xs text-gray-400 font-normal">({item.name})</span>
                        </>
                      ) : (
                        item.name
                      )}
                    </span>
                    {item.score && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                        ★ {item.score}
                      </span>
                    )}
                    {alreadyInBasket && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isReal ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {isReal ? "🔵 Copiado (Real)" : "🟢 Copiado (Simulado)"}
                      </span>
                    )}
                  </div>
                  {alreadyInBasket ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAliasModalTrader(userTrader)}
                        className="px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 cursor-pointer"
                        title="Cambiar Alias"
                      >
                        <span>✏️ {userTrader?.alias ? "Alias" : "+ Alias"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                        className="px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>En Cesta</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenCopyModal(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-primary text-black hover:bg-primary-hover shadow-md shadow-primary/20 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Añadir</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400">{item.desc}</p>
                {/* Badges / Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag: string, tIdx: number) => (
                      <span
                        key={tIdx}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-border">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">WR: <strong className="text-emerald-400">{item.winRate}</strong></span>
                    <span className="text-gray-400">DD: <strong className="text-emerald-400">{item.drawdown}</strong></span>
                    <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-primary" /> 7D: {item.weeklyTradesCount || 18} trades
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    <span className="text-[10px] text-gray-400 font-semibold">🪙 Posiciones cerradas:</span>
                    {parseAssetPercentages(item.assets).map((a, aIdx) => (
                      <span key={aIdx} className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-background/80 border border-surface-border text-white flex items-center gap-1">
                        <span className={alreadyInBasket ? "text-emerald-300 font-extrabold" : "text-primary font-bold"}>{a.coin}</span>
                        <span className="text-emerald-400 text-[8px]">{a.pct}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Formulario Añadir Trader Personalizado */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Añadir Trader Personalizado On-Chain
        </h3>
        <form onSubmit={handleAddCustom} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="Dirección 0x... (42 caracteres)"
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-background border border-surface-border text-white text-xs font-mono focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Alias o Nombre Opcional"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-background border border-surface-border text-white text-xs focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-primary text-black font-extrabold text-xs hover:bg-primary-hover transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Vincular a mi Cesta
          </button>
        </form>
      </div>

      {/* Modal para Modificar Alias */}
      <EditAliasModal
        isOpen={!!aliasModalTrader}
        trader={aliasModalTrader}
        onClose={() => setAliasModalTrader(null)}
        onSave={(newAlias) => {
          if (aliasModalTrader) {
            handleSaveAlias(aliasModalTrader.address, newAlias);
          }
        }}
      />
    </div>
  );
}
