"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Sliders, Shield, Star, CheckCircle2, AlertCircle } from "lucide-react";
import { getStoredProfile, updateTradersConfig } from "@/lib/storage";
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

  useEffect(() => {
    setProfile(getStoredProfile());
  }, []);

  if (!profile) return null;

  const totalAlloc = profile.traders.reduce((acc, t) => acc + (t.allocation_pct || 0), 0);

  const handleAllocationChange = (index: number, newAlloc: number) => {
    const updated = [...profile.traders];
    updated[index].allocation_pct = newAlloc;
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
    };
    const updated = [...profile.traders, newTrader];
    const newProfile = updateTradersConfig(updated);
    setProfile({ ...newProfile });
    flashSaved();
  };

  const flashSaved = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Cesta de Traders</h1>
          <p className="text-sm text-gray-400 mt-1">
            Personaliza qué traders copia tu cuenta y qué porcentaje (%) de tu capital virtual asignas a cada uno.
          </p>
        </div>
        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" /> Cambios guardados
          </div>
        )}
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

      {/* Current User Basket */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Tu Cesta Activa ({profile.traders.length} traders)</h2>

        {profile.traders.length === 0 ? (
          <div className="p-8 rounded-2xl bg-surface border border-surface-border text-center text-gray-500 text-sm">
            No tienes ningún trader en tu cesta. Añade uno de los recomendados a continuación.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.traders.map((t, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-surface border border-surface-border hover:border-gray-700 transition-all space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{t.name}</h3>
                      {t.score && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-emerald-400 border border-primary/30">
                          ★ {t.score}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{t.address.slice(0, 10)}...{t.address.slice(-6)}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveTrader(idx)}
                    className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Eliminar de mi cesta"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Asignación de Cartera:</span>
                    <span className="font-bold text-emerald-400 font-mono">{t.allocation_pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={t.allocation_pct}
                    onChange={(e) => handleAllocationChange(idx, Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>
              </div>
            ))}
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
