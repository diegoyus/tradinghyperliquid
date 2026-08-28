"use client";

import { useState } from "react";
import { Search, Award, TrendingUp, ShieldAlert, Activity, ArrowUpRight, ArrowDownRight, Plus, CheckCircle2, RefreshCw } from "lucide-react";
import { getStoredProfile, updateTradersConfig } from "@/lib/storage";

const QUICK_TRADERS = [
  { name: "El Francotirador", addr: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06" },
  { name: "Sticky (Scalping)", addr: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe" },
  { name: "Macro / Acciones", addr: "0xb6db1b4dc6244f86e482d834739d949d799e4da5" },
  { name: "Especialista SOL", addr: "0xab7fb756330e3983e676f44c03dabda9120aa273" },
];

export default function AnalyticsPage() {
  const [address, setAddress] = useState("0x337afda118de433f5a8c8ad6d6ef48b76d027a06");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const handleAnalyze = async (targetAddr?: string) => {
    const queryAddr = targetAddr || address;
    if (!queryAddr || !queryAddr.startsWith("0x") || queryAddr.length !== 42) {
      setError("Introduce una dirección válida de 42 caracteres que empiece por 0x");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/analyze-trader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: queryAddr }),
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "No se pudo analizar la billetera.");
      }
    } catch (e: any) {
      setError(`Error de conexión: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBasket = () => {
    if (!data) return;
    const profile = getStoredProfile();
    const exists = profile.traders.some((t) => t.address.toLowerCase() === data.address.toLowerCase());
    if (exists) {
      alert("Este trader ya está en tu cesta.");
      return;
    }

    const newTrader = {
      name: `Trader ${data.address.slice(0, 6)}`,
      score: `${data.score}/10`,
      address: data.address.toLowerCase(),
      allocation_pct: 25.0,
      risk_multiplier: 1.0,
      max_leverage: 10,
    };

    updateTradersConfig([...profile.traders, newTrader]);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Analizador de Carteras y Traders</h1>
        <p className="text-sm text-gray-400 mt-1">
          Inspecciona en tiempo real el rendimiento, posiciones abiertas y estilo de cualquier dirección en Hyperliquid DEX.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              required
              placeholder="Pega la dirección de la billetera (0x...)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-surface-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="py-3 px-6 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? "Analizando en directo..." : "Ejecutar Análisis"}
          </button>
        </form>

        {/* Quick Click Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs text-gray-400 font-semibold">Análisis Rápido:</span>
          {QUICK_TRADERS.map((qt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setAddress(qt.addr);
                handleAnalyze(qt.addr);
              }}
              className="px-3 py-1 rounded-lg bg-background/80 hover:bg-gray-800 border border-surface-border text-xs text-gray-300 hover:text-white transition-colors"
            >
              {qt.name}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Analysis Results Display */}
      {data && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Summary Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-surface to-background border border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-white font-mono">{data.address.slice(0, 10)}...{data.address.slice(-8)}</span>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-primary/20 text-emerald-400 border border-primary/40 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Puntuación: {data.score} / 10
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Analizadas {data.totalFills} operaciones históricas ejecutadas en Hyperliquid Mainnet.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAddToBasket}
                className="px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                {addedSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {addedSuccess ? "¡Añadido a tu Cesta!" : "+ Añadir a mi Cesta"}
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Saldo en Cuenta</div>
              <div className="text-2xl font-extrabold text-white mt-2">
                ${data.accountValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Margen usado: ${data.totalMarginUsed.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Tasa de Acierto</div>
              <div className="text-2xl font-extrabold text-emerald-400 mt-2">
                {data.winRate}%
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                ✅ {data.winningTradesCount} Ganados | ❌ {data.losingTradesCount} Perdidos
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Max Drawdown</div>
              <div className={`text-2xl font-extrabold mt-2 ${parseFloat(data.maxDrawdownPct) < 5 ? "text-emerald-400" : "text-yellow-400"}`}>
                -{data.maxDrawdownPct}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Control de riesgo estimado</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Profit Factor</div>
              <div className="text-2xl font-extrabold text-blue-400 mt-2">
                {data.profitFactor}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Ratio Beneficio / Pérdida</div>
            </div>
          </div>

          {/* Open Positions & Favorite Assets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Open Positions Table */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-surface border border-surface-border">
              <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
                <span>Posiciones Abiertas en este Momento ({data.openPositions.length})</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </h2>

              {data.openPositions.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-xs">
                  Este trader no tiene posiciones abiertas en este momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-surface-border text-gray-400">
                        <th className="pb-2.5">Activo</th>
                        <th className="pb-2.5">Lado</th>
                        <th className="pb-2.5">Tamaño</th>
                        <th className="pb-2.5">Precio Entrada</th>
                        <th className="pb-2.5 text-right">PnL No Realizado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {data.openPositions.map((pos: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                          <td className="py-2.5 font-bold text-white">{pos.coin}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${pos.side === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              {pos.side} {pos.leverage}x
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-300">{pos.size} {pos.coin}</td>
                          <td className="py-2.5 font-mono text-white">${pos.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className={`py-2.5 text-right font-mono font-bold ${pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Favorite Assets */}
            <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
              <h2 className="text-base font-bold text-white">Activos Más Operados</h2>
              <div className="space-y-3">
                {data.topAssets.map((asset: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border">
                    <span className="font-bold text-white text-xs">{asset.coin}</span>
                    <span className="text-xs text-gray-400 font-mono">{asset.count} operaciones</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Trades Table */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border">
            <h2 className="text-base font-bold text-white mb-4">Últimas Operaciones Ejecutadas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-gray-400">
                    <th className="pb-2.5">Fecha</th>
                    <th className="pb-2.5">Activo</th>
                    <th className="pb-2.5">Acción</th>
                    <th className="pb-2.5">Precio</th>
                    <th className="pb-2.5">Cantidad</th>
                    <th className="pb-2.5 text-right">PnL Cerrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {data.recentTrades.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-2.5 text-gray-400">{t.time}</td>
                      <td className="py-2.5 font-bold text-white">{t.coin}</td>
                      <td className="py-2.5 text-gray-300">{t.dir} ({t.side})</td>
                      <td className="py-2.5 font-mono text-white">${t.px.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 text-gray-400">{t.sz}</td>
                      <td className={`py-2.5 text-right font-mono font-bold ${t.closedPnl > 0 ? "text-emerald-400" : t.closedPnl < 0 ? "text-red-400" : "text-gray-500"}`}>
                        {t.closedPnl !== 0 ? `${t.closedPnl > 0 ? "+" : ""}$${t.closedPnl.toFixed(2)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
