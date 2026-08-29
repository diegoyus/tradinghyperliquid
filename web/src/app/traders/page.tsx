"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Sliders, Shield, Star, CheckCircle2, AlertCircle, ShieldAlert, ChevronDown, ChevronUp, Zap, Gauge } from "lucide-react";
import { getStoredProfile, updateTradersConfig, updateGlobalRisk } from "@/lib/storage";
import { TraderConfig, UserProfile } from "@/lib/types";

const SUGGESTED_TRADERS = [
  {
    name: "El Francotirador",
    score: "9.8/10",
    winRate: "96.9%",
    drawdown: "-0.02%",
    assets: "XRP, BTC, CL",
    address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06",
    desc: "Ultra-consistente. Scalping quirúrgico en momentos de alta probabilidad.",
  },
  {
    name: "Sticky (Scalping)",
    score: "9.3/10",
    winRate: "90.2%",
    drawdown: "-3.74%",
    assets: "BTC, ETH, ZEC",
    address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe",
    desc: "Alta frecuencia en BTC/ETH con momentum en altcoins volátiles.",
  },
  {
    name: "Macro / Acciones",
    score: "8.9/10",
    winRate: "86.4%",
    drawdown: "-0.05%",
    assets: "BTC, TSLA, SPCX",
    address: "0xb6db1b4dc6244f86e482d834739d949d799e4da5",
    desc: "Operador de macro y rupturas en cripto y activos sintéticos.",
  },
  {
    name: "Especialista SOL",
    score: "8.5/10",
    winRate: "88.0%",
    drawdown: "-0.38%",
    assets: "SOL, ETH, SKHX",
    address: "0xab7fb756330e3983e676f44c03dabda9120aa273",
    desc: "Tendencial en Solana y ecosistema con movimientos amplios.",
  },
];

export default function TradersPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [customName, setCustomName] = useState("");
  const [customAlloc, setCustomAlloc] = useState(25);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [expandedTrader, setExpandedTrader] = useState<number | null>(null);

  useEffect(() => {
    setProfile(getStoredProfile());
  }, []);

  if (!profile) return null;

  const totalAlloc = profile.traders.reduce((acc, t) => acc + (t.allocation_pct || 0), 0);

  const flashSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleUpdateTraderField = (index: number, field: keyof TraderConfig, value: any) => {
    const updated = [...profile.traders];
    updated[index] = { ...updated[index], [field]: value };
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleApplyPreset = (index: number, preset: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE") => {
    const updated = [...profile.traders];
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
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleRemoveTrader = (index: number) => {
    const updated = profile.traders.filter((_, i) => i !== index);
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddress.startsWith("0x") || customAddress.length !== 42) {
      alert("Introduce una dirección válida de 42 caracteres que empiece por 0x");
      return;
    }
    const newTrader: TraderConfig = {
      name: customName || `Trader ${customAddress.slice(0, 6)}`,
      score: "Custom",
      address: customAddress.toLowerCase(),
      allocation_pct: Number(customAlloc),
      risk_multiplier: 1.0,
      max_leverage: 10,
      stop_loss_pct: 5.0,
      max_trade_sizing_pct: 25.0,
    };
    const updated = [...profile.traders, newTrader];
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    setCustomAddress("");
    setCustomName("");
    flashSaved();
  };

  const handleAddSuggested = (item: typeof SUGGESTED_TRADERS[0]) => {
    const exists = profile.traders.some((t) => t.address.toLowerCase() === item.address.toLowerCase());
    if (exists) {
      alert("Este trader ya está en tu cesta.");
      return;
    }
    const newTrader: TraderConfig = {
      name: item.name,
      score: item.score,
      address: item.address.toLowerCase(),
      allocation_pct: 25.0,
      risk_multiplier: 1.0,
      max_leverage: 10,
      stop_loss_pct: 5.0,
      max_trade_sizing_pct: 25.0,
    };
    const updated = [...profile.traders, newTrader];
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  const handleUpdateGlobalCircuitBreaker = (pct: number) => {
    const updated = { ...profile.global_risk, circuit_breaker_pct: pct };
    const newProfile = updateGlobalRisk(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Cesta de Traders & Gestión de Riesgo</h1>
          <p className="text-sm text-gray-400 mt-1">
            Personaliza el apalancamiento máximo, Stop-Loss independiente, multiplicador y porcentajes (%) de cada trader.
          </p>
        </div>
        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" /> Ajustes guardados
          </div>
        )}
      </div>

      {/* Global Safety & Circuit Breaker Guard Card */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Circuit Breaker Global (Parada de Emergencia)
              </h2>
              <p className="text-xs text-gray-400">
                Si la pérdida total acumulada de la cartera alcanza este límite, el bot detiene inmediatamente la réplica de todas las cuentas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-background px-4 py-2 rounded-xl border border-surface-border">
            <span className="text-xs text-gray-400 font-semibold">Límite de Caída:</span>
            <span className="text-base font-bold text-red-400 font-mono">-{profile.global_risk.circuit_breaker_pct}%</span>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Sensibilidad del Circuit Breaker:</span>
            <span className="text-gray-300">Pausar si cae más de un <strong>{profile.global_risk.circuit_breaker_pct}%</strong></span>
          </div>
          <input
            type="range"
            min="5"
            max="30"
            step="1"
            value={profile.global_risk.circuit_breaker_pct}
            onChange={(e) => handleUpdateGlobalCircuitBreaker(Number(e.target.value))}
            className="w-full accent-red-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Allocation Status Bar */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Distribución Total de Cartera
          </span>
          <span className={`text-sm font-bold font-mono ${totalAlloc === 100 ? "text-emerald-400" : totalAlloc > 100 ? "text-red-400" : "text-yellow-400"}`}>
            {totalAlloc}% / 100%
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-background overflow-hidden flex">
          {profile.traders.map((t, idx) => {
            const colors = ["bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-indigo-500", "bg-purple-500"];
            const color = colors[idx % colors.length];
            return (
              <div
                key={idx}
                style={{ width: `${t.allocation_pct}%` }}
                className={`${color} h-full transition-all duration-300`}
                title={`${t.name}: ${t.allocation_pct}%`}
              />
            );
          })}
        </div>
        {totalAlloc > 100 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> La suma supera el 100%. Te recomendamos ajustar los porcentajes.
          </div>
        )}
      </div>

      {/* Current User Basket with Advanced Risk Sliders */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Tu Cesta Activa & Ajustes Individuales ({profile.traders.length} traders)</h2>

        {profile.traders.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-surface-border text-center text-gray-500 text-sm">
            No tienes ningún trader en tu cesta. Añade uno de los recomendados a continuación.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {profile.traders.map((t, idx) => {
              const isExpanded = expandedTrader === idx;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-surface border border-surface-border hover:border-gray-700 transition-all space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">{t.name}</h3>
                        {t.score && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-emerald-400 border border-primary/30">
                            ★ {t.score}
                          </span>
                        )}
                        <span className="text-xs font-mono text-gray-400 bg-background px-2 py-0.5 rounded border border-surface-border">
                          {t.allocation_pct}% asignado
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{t.address}</div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setExpandedTrader(isExpanded ? null : idx)}
                        className="px-3 py-1.5 rounded-lg bg-background hover:bg-gray-800 border border-surface-border text-xs text-gray-300 flex items-center gap-1.5 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        <span>{isExpanded ? "Ocultar Ajustes de Riesgo" : "Ajustes de Riesgo"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleRemoveTrader(idx)}
                        className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        title="Eliminar trader"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Main Allocation Slider */}
                  <div className="space-y-1.5 pt-1 border-t border-surface-border/60">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Porcentaje de Cartera Asignada:</span>
                      <span className="font-bold text-emerald-400 font-mono text-sm">{t.allocation_pct}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={t.allocation_pct}
                      onChange={(e) => handleUpdateTraderField(idx, "allocation_pct", Number(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>

                  {/* Expandable Advanced Risk Controls Panel */}
                  {isExpanded && (
                    <div className="p-5 rounded-xl bg-background/80 border border-surface-border space-y-5 animate-fadeIn">
                      {/* Presets Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-border">
                        <span className="text-xs text-gray-400 font-bold flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-yellow-400" /> Perfiles Rápidos:
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(idx, "CONSERVATIVE")}
                            className="px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-semibold transition-colors"
                          >
                            🛡️ Conservador (3x)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(idx, "BALANCED")}
                            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold transition-colors"
                          >
                            ⚖️ Equilibrado (10x)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(idx, "AGGRESSIVE")}
                            className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[11px] font-semibold transition-colors"
                          >
                            🚀 Agresivo (20x)
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Multiplicador de Riesgo */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Multiplicador:</span>
                            <span className="font-bold text-white font-mono">{t.risk_multiplier}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2.0"
                            step="0.1"
                            value={t.risk_multiplier}
                            onChange={(e) => handleUpdateTraderField(idx, "risk_multiplier", Number(e.target.value))}
                            className="w-full accent-primary cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 block">1.0x = tamaño proporcional exacto</span>
                        </div>

                        {/* 2. Tope Máximo de Apalancamiento */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Apalancamiento Máx:</span>
                            <span className="font-bold text-yellow-400 font-mono">{t.max_leverage}x</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="50"
                            step="1"
                            value={t.max_leverage}
                            onChange={(e) => handleUpdateTraderField(idx, "max_leverage", Number(e.target.value))}
                            className="w-full accent-yellow-400 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 block">Tope máximo si el líder usa más</span>
                        </div>

                        {/* 3. Stop-Loss Independiente por Posición */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Stop-Loss Posición:</span>
                            <span className="font-bold text-red-400 font-mono">-{t.stop_loss_pct}%</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="20"
                            step="1"
                            value={t.stop_loss_pct}
                            onChange={(e) => handleUpdateTraderField(idx, "stop_loss_pct", Number(e.target.value))}
                            className="w-full accent-red-500 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 block">Cerrar si la posición cae este %</span>
                        </div>

                        {/* 4. Límite de Capital por Trade */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Tope por Trade:</span>
                            <span className="font-bold text-blue-400 font-mono">{t.max_trade_sizing_pct}%</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="50"
                            step="5"
                            value={t.max_trade_sizing_pct}
                            onChange={(e) => handleUpdateTraderField(idx, "max_trade_sizing_pct", Number(e.target.value))}
                            className="w-full accent-blue-400 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-500 block">Máximo % asignado por orden</span>
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

      {/* Suggested Top Traders */}
      <div className="space-y-4 pt-6 border-t border-surface-border">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /> Traders de Élite Recomendados
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUGGESTED_TRADERS.map((item, idx) => {
            const alreadyInBasket = profile.traders.some((t) => t.address.toLowerCase() === item.address.toLowerCase());
            return (
              <div key={idx} className="p-5 rounded-2xl bg-surface/60 border border-surface-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{item.name}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/30">
                      ★ {item.score}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddSuggested(item)}
                    disabled={alreadyInBasket}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      alreadyInBasket
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "bg-primary text-black hover:bg-primary-hover shadow-md shadow-primary/20"
                    }`}
                  >
                    {alreadyInBasket ? "Ya en tu cesta" : "+ Añadir"}
                  </button>
                </div>
                <p className="text-xs text-gray-400">{item.desc}</p>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-border text-center text-xs">
                  <div>
                    <div className="text-gray-500 text-[10px]">Win Rate</div>
                    <div className="font-bold text-emerald-400">{item.winRate}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px]">Max Drawdown</div>
                    <div className="font-bold text-gray-200">{item.drawdown}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px]">Activos</div>
                    <div className="font-bold text-gray-300 truncate">{item.assets}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Custom 0x Address */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Añadir Cualquier Trader por Dirección
        </h2>
        <form onSubmit={handleAddCustom} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            placeholder="0x... (Dirección de Hyperliquid)"
            value={customAddress}
            onChange={(e) => setCustomAddress(e.target.value)}
            className="sm:col-span-2 px-4 py-2.5 rounded-lg bg-background border border-surface-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-primary font-mono"
          />
          <input
            type="text"
            placeholder="Alias (ej. Mi Trader Favorito)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-background border border-surface-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="py-2.5 px-4 rounded-lg bg-primary text-black font-bold text-xs hover:bg-primary-hover transition-all"
          >
            Añadir a mi Cesta
          </button>
        </form>
      </div>
    </div>
  );
}
