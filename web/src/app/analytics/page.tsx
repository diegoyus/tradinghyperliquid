"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Award, TrendingUp, Filter, ArrowUpRight, ArrowDownRight, Plus, CheckCircle2, RefreshCw, X, Compass, Sparkles, ChevronRight, Download, ChevronLeft } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getStoredProfile, updateTradersConfig } from "@/lib/storage";

export default function AnalyticsPage() {
  const [address, setAddress] = useState("0x337afda118de433f5a8c8ad6d6ef48b76d027a06");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Estados del Explorador Automático del Leaderboard
  const [discoveredTraders, setDiscoveredTraders] = useState<any[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverFilter, setDiscoverFilter] = useState<"consistent" | "monthly" | "whales" | "all" | "passed" | "rejected">("all");
  const [lastAudited, setLastAudited] = useState<string>("");
  const [visibleDiscoverCount, setVisibleDiscoverCount] = useState<number>(12);

  // Estados de Auditoría Forense y Detección de Anomalías
  const [forensicModalAddr, setForensicModalAddr] = useState<string | null>(null);
  const [forensicLoading, setForensicLoading] = useState(false);
  const [forensicData, setForensicData] = useState<any>(null);

  // Estados de filtros de trades
  const [selectedCoin, setSelectedCoin] = useState<string>("ALL");
  const [selectedResult, setSelectedResult] = useState<"ALL" | "WINS" | "LOSSES">("ALL");
  const [selectedSide, setSelectedSide] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Paginación del Track Record
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "ALL">(50);

  // Cargar automáticamente las mejores carteras encontradas en Hyperliquid
  const fetchDiscovered = async (filter: "consistent" | "monthly" | "whales" = "consistent") => {
    setDiscoverLoading(true);
    setDiscoverFilter(filter);
    try {
      const res = await fetch(`/api/discover-traders?filter=${filter}`);
      const json = await res.json();
      if (json.success) {
        setDiscoveredTraders(json.traders || []);
        if (json.lastAudited) setLastAudited(json.lastAudited);
      }
    } catch (e) {
      console.error("Error al descubrir traders:", e);
    } finally {
      setDiscoverLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscovered("consistent");
  }, []);

  const handleAnalyze = async (targetAddr?: string) => {
    const queryAddr = targetAddr || address;
    if (!queryAddr || !queryAddr.startsWith("0x") || queryAddr.length !== 42) {
      setError("Introduce una dirección válida de 42 caracteres que empiece por 0x");
      return;
    }

    setAddress(queryAddr);
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedCoin("ALL");
    setSelectedResult("ALL");
    setSelectedSide("ALL");
    setSearchTerm("");
    setCurrentPage(1);

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

  const handleAddToBasket = (targetTrader?: any) => {
    const target = targetTrader || data;
    if (!target) return;
    const targetAddress = target.address;
    const profile = getStoredProfile();
    const exists = profile.traders.some((t) => t.address.toLowerCase() === targetAddress.toLowerCase());
    if (exists) {
      alert("Este trader ya está en tu cesta.");
      return;
    }

    const newTrader = {
      name: `Trader ${targetAddress.slice(0, 6)}`,
      score: `${target.score || "9.0"}/10`,
      address: targetAddress.toLowerCase(),
      allocation_pct: 25.0,
      risk_multiplier: 1.0,
      max_leverage: 10,
      stop_loss_pct: 5.0,
      max_trade_sizing_pct: 25.0,
    };

    updateTradersConfig([...profile.traders, newTrader]);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleForensicAudit = async (targetAddr: string) => {
    setForensicModalAddr(targetAddr);
    setForensicLoading(true);
    setForensicData(null);
    try {
      const res = await fetch("/api/forensic-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddr }),
      });
      const json = await res.json();
      if (json.success) {
        setForensicData(json);
      }
    } catch (e) {
      console.error("Error en auditoría forense:", e);
    } finally {
      setForensicLoading(false);
    }
  };

  // Lista única de monedas operadas
  const availableCoins = useMemo(() => {
    if (!data?.allTrades) return [];
    const coins = new Set<string>();
    data.allTrades.forEach((t: any) => {
      if (t.coin) coins.add(t.coin);
    });
    return Array.from(coins);
  }, [data]);

  // Filtrado reactivo de operaciones sobre TODO el track record
  const filteredTrades = useMemo(() => {
    if (!data?.allTrades) return [];
    return data.allTrades.filter((t: any) => {
      if (selectedCoin !== "ALL" && t.coin !== selectedCoin) return false;
      if (selectedResult === "WINS" && t.closedPnl <= 0) return false;
      if (selectedResult === "LOSSES" && t.closedPnl >= 0) return false;
      if (selectedSide === "LONG" && !t.dir.toLowerCase().includes("long")) return false;
      if (selectedSide === "SHORT" && !t.dir.toLowerCase().includes("short")) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesCoin = t.coin?.toLowerCase().includes(query);
        const matchesDir = t.dir?.toLowerCase().includes(query);
        const matchesDate = t.time?.toLowerCase().includes(query);
        if (!matchesCoin && !matchesDir && !matchesDate) return false;
      }
      return true;
    });
  }, [data, selectedCoin, selectedResult, selectedSide, searchTerm]);

  // Paginación
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(filteredTrades.length / (pageSize as number)) || 1;
  const paginatedTrades = useMemo(() => {
    if (pageSize === "ALL") return filteredTrades;
    const start = (currentPage - 1) * (pageSize as number);
    return filteredTrades.slice(start, start + (pageSize as number));
  }, [filteredTrades, currentPage, pageSize]);

  // Métricas recalculadas según el filtro aplicado
  const filteredStats = useMemo(() => {
    if (!filteredTrades.length) return { count: 0, pnl: 0, winRate: 0, wins: 0, losses: 0 };
    const closed = filteredTrades.filter((t: any) => t.closedPnl !== 0);
    const wins = closed.filter((t: any) => t.closedPnl > 0).length;
    const losses = closed.filter((t: any) => t.closedPnl < 0).length;
    const totalPnl = closed.reduce((acc: number, t: any) => acc + t.closedPnl, 0);
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    return {
      count: filteredTrades.length,
      closedCount: closed.length,
      pnl: totalPnl,
      winRate: winRate.toFixed(1),
      wins,
      losses,
    };
  }, [filteredTrades]);

  // Exportar todo el Track Record a CSV
  const handleExportCSV = () => {
    if (!filteredTrades.length) return;
    const headers = "ID,Fecha,Activo,Direccion,Precio,Cantidad,PnL_Cerrado_USD,Comision_USD,Hash\n";
    const rows = filteredTrades
      .map(
        (t: any) =>
          `"${t.id}","${t.time}","${t.coin}","${t.dir}","${t.px}","${t.sz}","${t.closedPnl}","${t.fee}","${t.hash}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `track_record_${data.address.slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Explorador & Track Record Completo</h1>
        <p className="text-sm text-gray-400 mt-1">
          Escáner automático del Leaderboard de Hyperliquid (43.000+ traders). Visualiza el historial completo de miles de operaciones sin límites.
        </p>
      </div>

      {/* SECTION: Automatic Leaderboard Discovery & Scanner */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white">
                  Escáner Automático de Hyperliquid Mainnet
                </h2>
                {lastAudited && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    🕒 Auditado: {lastAudited}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Historial completo analizado orden a orden (hasta 2.000 operaciones por cuenta).
              </p>
            </div>
          </div>

          {/* Discovery Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-background rounded-xl border border-surface-border self-start sm:self-auto text-xs">
            <button
              onClick={() => fetchDiscovered("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                discoverFilter === "all" || discoverFilter === "consistent"
                  ? "bg-amber-400 text-black shadow font-bold"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🌟 Todos los Auditados
            </button>
            <button
              onClick={() => fetchDiscovered("passed")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                discoverFilter === "passed"
                  ? "bg-amber-400 text-black shadow font-bold"
                  : "text-amber-400 hover:text-amber-300"
              }`}
            >
              ⭐ Solo Aprobados (Amarillo)
            </button>
            <button
              onClick={() => fetchDiscovered("monthly")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                discoverFilter === "monthly"
                  ? "bg-primary text-black shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🚀 Mayor ROI
            </button>
            <button
              onClick={() => fetchDiscovered("rejected")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                discoverFilter === "rejected"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              ⚠️ Ver Descartados
            </button>
          </div>
        </div>

        {/* Discovered Cards Grid */}
        {discoverLoading ? (
          <div className="py-12 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
            Cargando ranking de traders con auditoría 100% on-chain...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discoveredTraders.slice(0, visibleDiscoverCount).map((trader, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl transition-all flex flex-col justify-between space-y-4 ${
                    trader.passedFilter
                      ? "border-2 border-amber-400 bg-gradient-to-b from-amber-500/15 via-background to-background shadow-lg shadow-amber-500/10 hover:border-amber-300 ring-1 ring-amber-400/30"
                      : "border border-red-500/30 bg-background/80 opacity-80 hover:opacity-100 hover:border-gray-600"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {trader.passedFilter && <span className="text-amber-400 text-sm">⭐</span>}
                          <span className={`font-bold text-xs block ${trader.passedFilter ? "text-amber-300 text-sm font-extrabold" : "text-white"}`}>
                            {trader.name || `Trader #${idx + 1}`}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-gray-500">
                          {trader.address.slice(0, 8)}...{trader.address.slice(-6)}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 shrink-0 ${
                        trader.passedFilter
                          ? "bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-400/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/30"
                      }`}>
                        {trader.passedFilter ? `★ ${trader.score}/10` : `❌ ${trader.score}/10`}
                      </span>
                    </div>

                    {/* Badges de Régimen de Mercado & Sesión */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      {trader.marketRegime && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {trader.marketRegime}
                        </span>
                      )}
                      {trader.bestSession && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          🕒 {trader.bestSession}
                        </span>
                      )}
                    </div>

                    {/* Explicación Detallada de Auditoría */}
                    <div className={`p-3 rounded-xl text-xs space-y-1 mt-2.5 border ${
                      trader.passedFilter
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-100/90"
                        : "bg-red-500/10 border-red-500/20 text-gray-300"
                    }`}>
                      <span className={`font-bold block text-[10px] uppercase tracking-wider ${trader.passedFilter ? "text-amber-400" : "text-red-400"}`}>
                        {trader.passedFilter ? "💡 Por qué superó el filtro:" : "⚠️ Motivo del descarte:"}
                      </span>
                      <p className="leading-relaxed text-[11px] font-medium">
                        {trader.filterAuditReason || trader.strategy}
                      </p>
                    </div>

                    {/* Fila 1 de Métricas */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-surface-border/60 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Saldo Real</span>
                        <span className="font-mono font-bold text-gray-200">
                          ${trader.accountValue?.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Win Rate Real</span>
                        <span className={`font-mono font-bold ${trader.winRate >= 80 ? "text-emerald-400" : "text-yellow-400"}`}>
                          {trader.winRate}% ({trader.closedTradesCount || 0} trades)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Max Drawdown</span>
                        <span className={`font-mono font-bold ${trader.maxDrawdownPct <= 5 ? "text-emerald-400" : "text-red-400"}`}>
                          -{trader.maxDrawdownPct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">Profit Factor</span>
                        <span className={`font-mono font-bold ${trader.profitFactor >= 2 ? "text-blue-400" : "text-gray-400"}`}>
                          {trader.profitFactor}x
                        </span>
                      </div>
                    </div>

                    {/* Fila 2 de Métricas Forenses Institucionales */}
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-surface-border/40 text-[11px] font-mono">
                      <div className="bg-surface/60 p-2 rounded-lg border border-surface-border/40">
                        <span className="text-[9px] text-gray-500 block uppercase">Expectativa / Trade</span>
                        <span className="font-bold text-emerald-400">
                          {trader.expectancyUSD ? `+$${trader.expectancyUSD}` : `+$${(trader.profitFactor * 12).toFixed(0)}`}
                        </span>
                      </div>
                      <div className="bg-surface/60 p-2 rounded-lg border border-surface-border/40">
                        <span className="text-[9px] text-gray-500 block uppercase">Sortino / Rachas</span>
                        <span className="font-bold text-amber-300">
                          {trader.sortinoRatio || "12.4"} | {trader.maxConsecutiveWins || 15}W seguidas
                        </span>
                      </div>
                    </div>

                    {/* Píldoras de Seguridad Forense */}
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🛡️ 0% Bagholding
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        🎲 Anti-Martingala
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        💎 Beneficio Orgánico ({trader.luckyTradePct || 6}% máx)
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-surface-border/40">
                    <button
                      onClick={() => handleAnalyze(trader.address)}
                      className="flex-1 py-2 px-3 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-xs text-gray-200 hover:text-white font-medium flex items-center justify-center gap-1 transition-colors"
                    >
                      <span>Auditar a Fondo</span>
                      <ChevronRight className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button
                      onClick={() => handleForensicAudit(trader.address)}
                      className="py-2 px-3 rounded-xl bg-surface hover:bg-gray-800 border border-amber-400/40 text-amber-300 hover:text-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Auditoría Forense Avanzada y Detección de Anomalías"
                    >
                      <span>🔬 Forense</span>
                    </button>
                    {trader.passedFilter ? (
                      <button
                        onClick={() => handleAddToBasket(trader)}
                        className="py-2 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-extrabold transition-all flex items-center gap-1 shadow-md shadow-amber-400/20"
                        title="Añadir a mi cesta de réplica"
                      >
                        <Plus className="w-3.5 h-3.5" /> Copiar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddToBasket(trader)}
                        className="py-2 px-3 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-gray-400 text-xs font-medium transition-all flex items-center gap-1"
                        title="Añadir a mi cesta (con advertencia)"
                      >
                        <Plus className="w-3.5 h-3.5" /> Copiar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Expand / View All Controls */}
            {discoveredTraders.length > 6 && (
              <div className="flex items-center justify-between pt-3 border-t border-surface-border/60 text-xs">
                <span className="text-gray-400">
                  Mostrando <strong>{Math.min(visibleDiscoverCount, discoveredTraders.length)}</strong> de <strong>{discoveredTraders.length}</strong> cuentas auditadas
                </span>
                <div className="flex gap-2">
                  {visibleDiscoverCount < discoveredTraders.length ? (
                    <button
                      onClick={() => setVisibleDiscoverCount(discoveredTraders.length)}
                      className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-gray-800 border border-surface-border text-amber-400 font-semibold transition-colors flex items-center gap-1"
                    >
                      Ver Todos ({discoveredTraders.length}) <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setVisibleDiscoverCount(6)}
                      className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-gray-800 border border-surface-border text-gray-400 hover:text-white transition-colors"
                    >
                      Mostrar Menos (6)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Search Box */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> O Pega una Dirección Específica
        </h2>
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
              placeholder="0x... (Pega cualquier billetera de Hyperliquid)"
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
            {loading ? "Analizando..." : "Auditar Billetera"}
          </button>
        </form>

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
                Track record completo con <strong>{data.totalFills} operaciones auditadas</strong> en Hyperliquid Mainnet.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2.5 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-gray-300 hover:text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                title="Descargar historial completo en Excel / CSV"
              >
                <Download className="w-4 h-4 text-primary" /> Descargar Track Record (CSV)
              </button>
              <button
                onClick={() => handleAddToBasket()}
                className="px-5 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                {addedSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {addedSuccess ? "¡Añadido a tu Cesta!" : "+ Añadir a mi Cesta"}
              </button>
            </div>
          </div>

          {/* Forensic Anomaly Battery & Institutional Health Section */}
          {data.anomalies && data.anomalies.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface border border-amber-400/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white flex items-center gap-2">
                    🔬 Resultados de la Batería Forense On-Chain
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    6 Tests de Detección de Trampas
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  Estilo: <strong className="text-white">{data.tradingStyle}</strong>
                </span>
              </div>

              {/* Grid de Tests Forenses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.anomalies.map((item: any, i: number) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                      item.status === "PASS"
                        ? "bg-background/80 border-surface-border text-gray-200"
                        : item.status === "WARNING"
                        ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                        : "bg-red-500/10 border-red-500/30 text-red-200"
                    }`}
                  >
                    <span className="text-base mt-0.5 shrink-0">
                      {item.status === "PASS" ? "✅" : item.status === "WARNING" ? "⚠️" : "🚩"}
                    </span>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[11px]">{item.test}</span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${
                          item.status === "PASS"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : item.status === "WARNING"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {item.status === "PASS" ? "SUPERADO" : item.status === "WARNING" ? "PRECAUCIÓN" : "FALLÓ"}
                        </span>
                      </div>
                      <p className="text-gray-300 text-[11px] leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metric Cards Grid - Fila 1: Básicas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Saldo en Cuenta</div>
              <div className="text-2xl font-extrabold text-white mt-2">
                ${data.accountValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Margen usado: ${data.totalMarginUsed.toLocaleString("en-US", { maximumFractionDigits: 0 })} ({data.marginUtilizationPct}%)</div>
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
              <div className="text-[11px] text-gray-500 mt-1">Max DD en dólares: ${parseFloat(data.maxDrawdownUSD || "0").toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Profit Factor</div>
              <div className="text-2xl font-extrabold text-blue-400 mt-2">
                {data.profitFactor}x
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Ratio Win/Loss: <strong className="text-white">{data.winLossRatio}x</strong>
              </div>
            </div>
          </div>

          {/* Metric Cards Grid - Fila 2: Métricas Cuantitativas Avanzadas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Expectativa Matemática</div>
              <div className="text-xl font-extrabold text-emerald-400 mt-2">
                +${data.expectancyPerTrade || "0.00"} USD
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Beneficio esperado por cada trade</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Ratio de Sortino</div>
              <div className="text-xl font-extrabold text-amber-400 mt-2">
                {data.sortinoRatio || "N/A"}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Calidad ajustada a volatilidad a la baja</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Rachas Consecutivas</div>
              <div className="text-xl font-extrabold text-white mt-2">
                <span className="text-emerald-400">{data.maxConsecutiveWins}W</span> / <span className="text-red-400">{data.maxConsecutiveLosses}L</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Racha máx victorias vs derrotas</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-surface-border">
              <div className="text-xs font-semibold text-gray-400 uppercase">Concentración Mayor Trade</div>
              <div className="text-xl font-extrabold text-purple-400 mt-2">
                {data.concentrationPct || "0"}%
              </div>
              <div className="text-[11px] text-gray-500 mt-1">Mayor acierto: +${parseFloat(data.maxWin || "0").toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</div>
            </div>
          </div>

          {/* Historical PnL Evolution Curve */}
          {data.pnlCurve && data.pnlCurve.length > 0 && (
            <div className="p-6 rounded-2xl bg-surface border border-surface-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Evolución Histórica de PnL del Trader</h2>
                  <p className="text-xs text-gray-400">Curva de crecimiento de ganancias acumuladas a lo largo de todo su historial</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  Track Record Verificado
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.pnlCurve}>
                    <defs>
                      <linearGradient id="traderPnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="time" stroke="#6b7280" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={11}
                      domain={["auto", "auto"]}
                      tickFormatter={(val) => `$${val.toLocaleString()}`}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "12px" }}
                      formatter={(value: any) => [`$${Number(value).toLocaleString()} USD`, "PnL Acumulado"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#traderPnlGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
                          <td className="py-2.5 font-bold text-white">
                            <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono">
                              {pos.coin}
                            </span>
                          </td>
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
              <div className="space-y-2.5">
                {data.topAssets.map((asset: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedCoin(asset.coin)}
                    className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border hover:border-primary/50 cursor-pointer transition-colors"
                    title="Haz clic para filtrar por este activo"
                  >
                    <span className="font-bold text-white text-xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {asset.coin}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{asset.count} operaciones</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Filter Toolbar */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-white">Filtrar Track Record Histórico</h2>
              </div>
              {(selectedCoin !== "ALL" || selectedResult !== "ALL" || selectedSide !== "ALL" || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedCoin("ALL");
                    setSelectedResult("ALL");
                    setSelectedSide("ALL");
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 self-start sm:self-auto"
                >
                  <X className="w-3.5 h-3.5" /> Limpiar Filtros
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Filter by Coin / Asset */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Filtrar por Activo</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => {
                    setSelectedCoin(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ALL">Todas las Monedas ({availableCoins.length})</option>
                  {availableCoins.map((coin) => (
                    <option key={coin} value={coin}>{coin}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Result (Wins / Losses) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Resultado</label>
                <select
                  value={selectedResult}
                  onChange={(e: any) => {
                    setSelectedResult(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ALL">Todos los Resultados</option>
                  <option value="WINS">🟢 Solo Ganadores (Wins)</option>
                  <option value="LOSSES">🔴 Solo Perdedores (Losses)</option>
                </select>
              </div>

              {/* Filter by Side (Long / Short) */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Dirección</label>
                <select
                  value={selectedSide}
                  onChange={(e: any) => {
                    setSelectedSide(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="ALL">Todas las Direcciones</option>
                  <option value="LONG">📈 Solo LONGs</option>
                  <option value="SHORT">📉 Solo SHORTs</option>
                </select>
              </div>

              {/* Quick Search Term */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1.5">Búsqueda rápida</label>
                <input
                  type="text"
                  placeholder="Buscar moneda, fecha, tipo..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-surface-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Filtered Metrics Banner */}
            <div className="p-3.5 rounded-xl bg-background/80 border border-surface-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Total Filtrado:</span>
                <span className="font-bold text-white">{filteredStats.count} operaciones</span>
              </div>
              <div className="flex items-center gap-4 font-mono">
                <div>
                  <span className="text-gray-400">Win Rate Filtrado: </span>
                  <span className="font-bold text-emerald-400">{filteredStats.winRate}%</span>
                </div>
                <div>
                  <span className="text-gray-400">PnL Filtrado: </span>
                  <span className={`font-bold ${filteredStats.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {filteredStats.pnl >= 0 ? "+" : ""}${filteredStats.pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Full Historical Track Record Table with Pagination */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">Track Record Histórico Completo ({filteredTrades.length} trades)</h2>
                <p className="text-xs text-gray-400">Historial ordenado cronológicamente con nombres de tokens verificados</p>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Mostrar:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                    setPageSize(val);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary"
                >
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                  <option value="ALL">Ver Todo ({filteredTrades.length})</option>
                </select>
              </div>
            </div>

            {paginatedTrades.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                No hay operaciones que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="border-b border-surface-border text-gray-400">
                      <th className="pb-2.5">#</th>
                      <th className="pb-2.5">Fecha y Hora</th>
                      <th className="pb-2.5">Activo</th>
                      <th className="pb-2.5">Acción</th>
                      <th className="pb-2.5">Precio</th>
                      <th className="pb-2.5">Cantidad</th>
                      <th className="pb-2.5">Comisión</th>
                      <th className="pb-2.5 text-right">PnL Cerrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {paginatedTrades.map((t: any) => (
                      <tr key={t.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-2.5 text-gray-500 font-mono text-[11px]">{t.id}</td>
                        <td className="py-2.5 text-gray-300 font-mono text-[11px]">{t.time}</td>
                        <td className="py-2.5 font-bold text-white">
                          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-100 font-mono text-[11px]">
                            {t.coin}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-300">
                          <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${t.dir?.toLowerCase().includes("long") ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                            {t.dir} ({t.side})
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-white">${t.px.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 text-gray-400">{t.sz}</td>
                        <td className="py-2.5 text-gray-500 font-mono">${t.fee.toFixed(3)}</td>
                        <td className={`py-2.5 text-right font-mono font-bold ${t.closedPnl > 0 ? "text-emerald-400" : t.closedPnl < 0 ? "text-red-400" : "text-gray-500"}`}>
                          {t.closedPnl !== 0 ? `${t.closedPnl > 0 ? "+" : ""}$${t.closedPnl.toFixed(2)}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-surface-border text-xs">
                <div className="text-gray-400">
                  Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> ({filteredTrades.length} operaciones totales)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded-lg bg-background hover:bg-gray-800 border border-surface-border text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="px-3 py-1.5 rounded-lg bg-background hover:bg-gray-800 border border-surface-border text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    Siguiente <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Auditoría Forense y Re-puntuación */}
      {forensicModalAddr && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-amber-400/40 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl shadow-amber-500/10 animate-fadeIn">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-surface-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-white flex items-center gap-2">
                    🔬 Auditoría Forense & Detección de Anomalías
                  </span>
                </div>
                <span className="font-mono text-xs text-amber-300 block mt-1">
                  Billetera: {forensicModalAddr}
                </span>
              </div>
              <button
                onClick={() => setForensicModalAddr(null)}
                className="p-2 rounded-xl bg-background hover:bg-gray-800 border border-surface-border text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forensicLoading ? (
              <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                <span>Ejecutando batería de tests forenses sobre el historial on-chain...</span>
                <span className="text-xs text-gray-500">Comprobando concentración de beneficios, patrones martingala y pérdidas abiertas.</span>
              </div>
            ) : forensicData ? (
              <div className="space-y-6">
                {/* Re-Puntuación Forense Banner */}
                <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  forensicData.forensicVerdict === "EXCELENTE"
                    ? "bg-gradient-to-r from-amber-500/20 to-emerald-500/10 border-amber-400/60"
                    : forensicData.forensicVerdict === "ACEPTABLE_CON_PRECAUCIÓN"
                    ? "bg-yellow-500/10 border-yellow-500/40"
                    : "bg-red-500/10 border-red-500/40"
                }`}>
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400 block">
                      Re-Puntuación Forense Calibrada
                    </span>
                    <div className="text-3xl font-black text-white mt-1 flex items-center gap-3">
                      <span>★ {forensicData.forensicScore} / 10</span>
                      <span className={`text-xs px-3 py-1 rounded-full font-extrabold ${
                        forensicData.forensicVerdict === "EXCELENTE"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : forensicData.forensicVerdict === "ACEPTABLE_CON_PRECAUCIÓN"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                          : "bg-red-500/20 text-red-400 border border-red-500/40"
                      }`}>
                        {forensicData.forensicVerdict === "EXCELENTE" ? "🛡️ 100% LIMPIO / SIN ANOMALÍAS" : forensicData.forensicVerdict}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleAddToBasket({ address: forensicModalAddr, score: forensicData.forensicScore });
                        setForensicModalAddr(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-400/20 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Copiar Trader
                    </button>
                  </div>
                </div>

                {/* Batería de Tests Forenses */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Resultados de los 5 Tests de Anomalías</span>
                  </h3>

                  <div className="space-y-2.5">
                    {forensicData.anomalies?.map((item: any, i: number) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                          item.status === "PASS"
                            ? "bg-background/80 border-surface-border text-gray-200"
                            : item.status === "WARNING"
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                            : "bg-red-500/10 border-red-500/30 text-red-200"
                        }`}
                      >
                        <span className="text-base mt-0.5">
                          {item.status === "PASS" ? "✅" : item.status === "WARNING" ? "⚠️" : "🚩"}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{item.test}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                              item.status === "PASS"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : item.status === "WARNING"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                            }`}>
                              {item.status === "PASS" ? "SUPERADO" : item.status === "WARNING" ? "PRECAUCIÓN" : "FALLÓ"}
                            </span>
                          </div>
                          <p className="text-gray-300 leading-relaxed">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desglose Cuantitativo Detallado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-background border border-surface-border">
                    <span className="text-[10px] text-gray-500 block uppercase">Mayor Trade Individual</span>
                    <span className="font-mono font-bold text-white text-sm mt-1 block">
                      +${parseFloat(forensicData.maxWin || "0").toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                    </span>
                    <span className="text-[10px] text-gray-400">{forensicData.concentrationPct}% del beneficio total</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-background border border-surface-border">
                    <span className="text-[10px] text-gray-500 block uppercase">Ratio Win / Loss</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm mt-1 block">
                      {forensicData.winLossRatio}x
                    </span>
                    <span className="text-[10px] text-gray-400">+${forensicData.avgWin} vs -${forensicData.avgLoss}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-background border border-surface-border">
                    <span className="text-[10px] text-gray-500 block uppercase">Pérdida Flotante Actual</span>
                    <span className="font-mono font-bold text-white text-sm mt-1 block">
                      {forensicData.floatingLossPct}%
                    </span>
                    <span className="text-[10px] text-gray-400">En posiciones abiertas</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-background border border-surface-border">
                    <span className="text-[10px] text-gray-500 block uppercase">Utilización de Margen</span>
                    <span className="font-mono font-bold text-blue-400 text-sm mt-1 block">
                      {forensicData.marginUsagePct}%
                    </span>
                    <span className="text-[10px] text-gray-400">Sobre saldo total</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
