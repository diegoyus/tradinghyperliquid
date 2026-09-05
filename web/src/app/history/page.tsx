"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  History,
  Download,
  RefreshCw,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Layers,
  Zap,
  SlidersHorizontal,
  ExternalLink,
  Copy,
  ChevronRight,
  Shield,
  HelpCircle,
  Calendar,
  Hourglass,
  Activity,
  Info
} from "lucide-react";
import { getStoredProfile, isAuthenticated } from "@/lib/storage";
import { fetchFullTradeHistory } from "@/lib/tradeHistory";
import { UserProfile, UnifiedTrade } from "@/lib/types";
import { isMemecoin } from "@/lib/memecoins";

export default function HistoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trades, setTrades] = useState<UnifiedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros de estado
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "LATEST_OPEN" | "CLOSED">("ALL");
  const [pnlFilter, setPnlFilter] = useState<"ALL" | "WIN" | "LOSS">("ALL");
  const [coinFilter, setCoinFilter] = useState<string>("ALL");
  const [traderFilter, setTraderFilter] = useState<string>("ALL");
  const [sideFilter, setSideFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "PNL_HIGH" | "PNL_LOW" | "SIZE_HIGH">("NEWEST");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const loadData = async (userProf?: UserProfile) => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      window.location.href = "/auth?redirect=/history";
      return;
    }
    const p = userProf || getStoredProfile();
    setProfile(p);
    try {
      const history = await fetchFullTradeHistory(p);
      setTrades(history);
    } catch (e) {
      console.error("Error loading trade history:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleModeChange = (e: any) => {
      const cur = getStoredProfile();
      const updated = { ...cur, trading_mode: e.detail as "DEMO" | "REAL" };
      setProfile(updated);
      loadData(updated);
    };

    window.addEventListener("trading-mode-changed", handleModeChange);
    return () => window.removeEventListener("trading-mode-changed", handleModeChange);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Monedas y Traders únicos presentes en el historial
  const availableCoins = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.coin) set.add(t.coin.toUpperCase());
    });
    return Array.from(set).sort();
  }, [trades]);

  const availableTraders = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.traderName) set.add(t.traderName);
    });
    return Array.from(set).sort();
  }, [trades]);

  // Filtrado y Ordenación
  const filteredTrades = useMemo(() => {
    const list = trades.filter((t) => {
      // 1. Buscador texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCoin = t.coin.toLowerCase().includes(q);
        const matchTrader = t.traderName.toLowerCase().includes(q);
        const matchAddr = t.traderAddr.toLowerCase().includes(q);
        if (!matchCoin && !matchTrader && !matchAddr) return false;
      }

      // 2. Filtro Estado (Abierta / Cerrada / Última Abierta)
      if (statusFilter === "OPEN" && t.status !== "OPEN") return false;
      if (statusFilter === "CLOSED" && t.status !== "CLOSED") return false;
      if (statusFilter === "LATEST_OPEN" && t.status !== "OPEN") return false;

      // 3. Filtro PnL (Ganadoras / Perdedoras)
      if (pnlFilter === "WIN" && t.pnl <= 0) return false;
      if (pnlFilter === "LOSS" && t.pnl >= 0) return false;

      // 4. Filtro Moneda
      if (coinFilter === "NO_MEMES" && isMemecoin(t.coin)) return false;
      if (coinFilter === "ONLY_MEMES" && !isMemecoin(t.coin)) return false;
      if (coinFilter !== "ALL" && coinFilter !== "NO_MEMES" && coinFilter !== "ONLY_MEMES" && t.coin.toUpperCase() !== coinFilter) return false;

      // 5. Filtro Trader
      if (traderFilter !== "ALL" && t.traderName !== traderFilter) return false;

      // 6. Filtro Dirección (Long / Short)
      if (sideFilter !== "ALL" && t.side !== sideFilter) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "NEWEST") return b.timestamp - a.timestamp;
      if (sortBy === "OLDEST") return a.timestamp - b.timestamp;
      if (sortBy === "PNL_HIGH") return b.pnl - a.pnl;
      if (sortBy === "PNL_LOW") return a.pnl - b.pnl;
      if (sortBy === "SIZE_HIGH") return b.usdValue - a.usdValue;
      return 0;
    });

    if (statusFilter === "LATEST_OPEN") {
      return list.slice(0, 1);
    }
    return list;
  }, [trades, searchQuery, statusFilter, pnlFilter, coinFilter, traderFilter, sideFilter, sortBy]);

  // Métricas agregadas sobre los resultados filtrados
  const kpis = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let realizedPnl = 0;
    let unrealizedPnl = 0;
    let maxWin = 0;
    let maxLoss = 0;
    let openCount = 0;
    let closedCount = 0;

    filteredTrades.forEach((t) => {
      if (t.status === "OPEN") {
        unrealizedPnl += t.pnl;
        openCount++;
      } else {
        realizedPnl += t.pnl;
        closedCount++;
        if (t.pnl > 0) wins++;
        else if (t.pnl < 0) losses++;
      }

      if (t.pnl > maxWin) maxWin = t.pnl;
      if (t.pnl < maxLoss) maxLoss = t.pnl;
    });

    const totalClosed = wins + losses;
    const winRate = totalClosed > 0 ? ((wins / totalClosed) * 100).toFixed(1) : "0.0";

    return {
      totalCount: filteredTrades.length,
      openCount,
      closedCount,
      wins,
      losses,
      winRate,
      realizedPnl,
      unrealizedPnl,
      maxWin,
      maxLoss,
    };
  }, [filteredTrades]);

  // Paginación
  const totalPages = Math.ceil(filteredTrades.length / ITEMS_PER_PAGE) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrades.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTrades, currentPage]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setPnlFilter("ALL");
    setCoinFilter("ALL");
    setTraderFilter("ALL");
    setSideFilter("ALL");
    setSortBy("NEWEST");
    setCurrentPage(1);
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (!filteredTrades.length) return;
    const headers = "ID,Estado,Trader,Activo,Direccion,Apalancamiento,Precio_Entrada,Precio_Salida,Apertura,Cierre,Duracion,Tamano_Tokens,Tamano_USD,PnL_USD,PnL_Pct\n";
    const rows = filteredTrades
      .map(
        (t) =>
          `"${t.id}","${t.status}","${t.traderName}","${t.coin}","${t.side}","${t.leverage}x","${t.entryPx}","${t.exitPx || t.markPx || t.entryPx}","${t.openTimeStr || t.timeStr}","${t.closeTimeStr || ''}","${t.durationStr || ''}","${t.size}","${t.usdValue.toFixed(2)}","${t.pnl.toFixed(2)}","${t.pnlPct.toFixed(2)}%"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historial_operaciones_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn pb-16">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Historial de Operaciones</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  profile?.trading_mode === "REAL"
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}>
                  {profile?.trading_mode === "REAL" ? "🔵 Modo Real (On-Chain)" : "🟢 Modo Simulado (Paper)"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {profile?.trading_mode === "REAL"
                  ? "Registro forense de los fills ejecutados on-chain en tu billetera en Hyperliquid Mainnet."
                  : "Auditoría en tiempo real con fecha y hora exacta de apertura, cierre, duración y estado visual de cada orden simulada."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="py-2.5 px-4 rounded-xl bg-surface border border-surface-border text-gray-300 hover:text-white font-bold text-xs hover:bg-surface-border/50 transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-primary" : ""}`} />
            <span>{refreshing ? "Actualizando..." : "Actualizar Fills"}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards (Filtrados) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Trades */}
        <div className="p-4 rounded-2xl bg-surface border border-surface-border space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">Operaciones</span>
          <div className="text-xl font-extrabold text-white font-mono">{kpis.totalCount}</div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-emerald-400 font-bold">{kpis.openCount} vivas</span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{kpis.closedCount} cerradas</span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="p-4 rounded-2xl bg-surface border border-surface-border space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">Win Rate</span>
          <div className="text-xl font-extrabold text-emerald-400 font-mono">
            {kpis.closedCount > 0 ? `${kpis.winRate}%` : "—"}
          </div>
          <span className="text-[10px] text-gray-500">
            {kpis.closedCount > 0 ? `${kpis.wins}G / ${kpis.losses}P` : "Sin cierres aún"}
          </span>
        </div>

        {/* Realized PnL */}
        <div className="p-4 rounded-2xl bg-surface border border-surface-border space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">PnL Realizado</span>
          <div
            className={`text-xl font-extrabold font-mono ${
              kpis.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {kpis.realizedPnl >= 0 ? "+" : ""}${kpis.realizedPnl.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-500">Cerrado en caja</span>
        </div>

        {/* Unrealized / Flotante */}
        <div className="p-4 rounded-2xl bg-surface border border-surface-border space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-400 block tracking-wider">PnL Flotante</span>
          <div
            className={`text-xl font-extrabold font-mono ${
              kpis.unrealizedPnl >= 0 ? "text-purple-300" : "text-red-400"
            }`}
          >
            {kpis.unrealizedPnl >= 0 ? "+" : ""}${kpis.unrealizedPnl.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-500">Posiciones abiertas</span>
        </div>

        {/* Mejor Trade */}
        <div className="p-4 rounded-2xl bg-surface border border-emerald-500/20 bg-emerald-500/5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-emerald-400 block tracking-wider">Mejor Trade</span>
          <div className="text-xl font-extrabold text-emerald-400 font-mono">
            +${kpis.maxWin.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-500">Mayor beneficio</span>
        </div>

        {/* Peor Trade */}
        <div className="p-4 rounded-2xl bg-surface border border-red-500/20 bg-red-500/5 space-y-1">
          <span className="text-[10px] font-bold uppercase text-red-400 block tracking-wider">Peor Trade</span>
          <div className="text-xl font-extrabold text-red-400 font-mono">
            ${kpis.maxLoss.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-500">Mayor caída</span>
        </div>
      </div>

      {/* Banner Informativo Contable para Modo Real */}
      {profile?.trading_mode === "REAL" && (
        <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-3 shadow-inner">
          <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-white text-xs">
                💡 ¿Por qué ves {trades.length} ejecuciones aquí si solo tienes 2 posiciones abiertas?
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">
                Fills On-Chain vs Posición Neta
              </span>
            </div>
            <p className="text-[11px] text-gray-300">
              En Hyperliquid cada moneda tiene <b>1 única posición abierta</b>. Estas filas son los <b>fills (órdenes de entrada)</b> que acumularon tus trades vivos:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                • <b>HYPE:</b> 3 compras (2.07 + 2.04 + 2.00) = <b>1 sola posición acumulada de 6.11 HYPE</b>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                • <b>ETH:</b> 2 ventas (0.0595 + 0.0595) = <b>1 sola posición acumulada de 0.119 ETH</b>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 italic pt-0.5">
              Actualmente <b>no tienes ninguna posición cerrada</b>. Cuando cierres HYPE o ETH (desde Telegram con <code>/cerrar</code> o cuando el líder cierre), se registrará aquí su liquidación final.
            </p>
          </div>
        </div>
      )}

      {/* 3. Panel de Filtros Multicriterio */}
      <div className="p-5 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por activo (BTC, ETH...), trader o dirección..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surface-border text-white text-xs placeholder-gray-500 focus:outline-none focus:border-primary font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Ordenación */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1 font-semibold">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Ordenar por:
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="NEWEST">Más Recientes Primero</option>
              <option value="OLDEST">Más Antiguos Primero</option>
              <option value="PNL_HIGH">Mayor PnL Ganador</option>
              <option value="PNL_LOW">Mayor Pérdida</option>
              <option value="SIZE_HIGH">Mayor Tamaño ($)</option>
            </select>
          </div>
        </div>

        {/* Filtros Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-surface-border/50">
          {/* Filtro Estado */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 block">Estado</label>
            <select
              value={statusFilter}
              onChange={(e: any) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="LATEST_OPEN">⭐ Solo la Última Posición Abierta</option>
              <option value="OPEN">🟢 Todas las Abiertas (En Vivo)</option>
              <option value="CLOSED">🏁 Solo Cerradas</option>
            </select>
          </div>

          {/* Filtro PnL */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 block">Resultado (PnL)</label>
            <select
              value={pnlFilter}
              onChange={(e: any) => {
                setPnlFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">Todas las Operaciones</option>
              <option value="WIN">🟢 Solo Ganadoras (PnL &gt; 0)</option>
              <option value="LOSS">🔴 Solo Perdedoras (PnL &lt; 0)</option>
            </select>
          </div>

          {/* Filtro Moneda */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 block">Criptomoneda</label>
            <select
              value={coinFilter}
              onChange={(e: any) => {
                setCoinFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">Todas las Monedas</option>
              <option value="NO_MEMES">🚫 Sin Memecoins (Solo Bluechips)</option>
              <option value="ONLY_MEMES">🐕 Solo Memecoins</option>
              {availableCoins.map((coin) => (
                <option key={coin} value={coin}>
                  {coin}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Trader */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 block">Trader Copiado</label>
            <select
              value={traderFilter}
              onChange={(e: any) => {
                setTraderFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">Todos los Traders</option>
              {availableTraders.map((trader) => (
                <option key={trader} value={trader}>
                  {trader}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Dirección */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-400 block">Dirección</label>
            <select
              value={sideFilter}
              onChange={(e: any) => {
                setSideFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-white text-xs font-medium focus:outline-none focus:border-primary"
            >
              <option value="ALL">Todas (Long y Short)</option>
              <option value="LONG">🟢 Solo LONG</option>
              <option value="SHORT">🔴 Solo SHORT</option>
            </select>
          </div>
        </div>

        {/* Reset Filters button if applied */}
        {(searchQuery || statusFilter !== "ALL" || pnlFilter !== "ALL" || coinFilter !== "ALL" || traderFilter !== "ALL" || sideFilter !== "ALL") && (
          <div className="flex items-center justify-between pt-2 border-t border-surface-border/50 text-xs">
            <span className="text-gray-400">
              Mostrando <strong>{filteredTrades.length}</strong> de <strong>{trades.length}</strong> operaciones totales.
            </span>
            <button
              onClick={handleResetFilters}
              className="text-primary hover:underline font-bold text-xs"
            >
              Restablecer todos los filtros ✕
            </button>
          </div>
        )}
      </div>

      {/* 4. Tabla de Operaciones */}
      <div className="rounded-2xl bg-surface border border-surface-border overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="text-sm font-bold text-white">Sincronizando fills y posiciones con Hyperliquid...</p>
            <p className="text-xs text-gray-400">Obteniendo fechas exactas de apertura, cierre y liquidaciones en tiempo real.</p>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="py-20 px-4 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-border/50 flex items-center justify-center text-gray-400 mx-auto">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No se encontraron operaciones</h3>
              <p className="text-xs text-gray-400 mt-1">
                {profile?.traders && profile.traders.length === 0
                  ? "Aún no tienes traders vinculados a tu cesta. Visita la sección de Traders para comenzar a copiar."
                  : "No hay trades que coincidan con los filtros seleccionados. Prueba a restablecer los filtros."}
              </p>
            </div>
            {profile?.traders && profile.traders.length === 0 ? (
              <Link
                href="/traders"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-black font-extrabold text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
              >
                <span>Explorar Hall de la Fama</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-surface border border-surface-border text-white text-xs font-bold hover:bg-surface-border/50"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-border bg-background/80 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4">Horarios (Apertura / Cierre)</th>
                  <th className="py-3.5 px-4">Trader Copiado</th>
                  <th className="py-3.5 px-4">Activo</th>
                  <th className="py-3.5 px-4">Dirección</th>
                  <th className="py-3.5 px-4 text-right">Precios (Entrada / Salida)</th>
                  <th className="py-3.5 px-4 text-right">Tamaño ($ USD)</th>
                  <th className="py-3.5 px-4 text-right">PnL Simulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40 font-mono">
                {paginatedTrades.map((trade) => {
                  const isLong = trade.side === "LONG";
                  const isOpen = trade.status === "OPEN";
                  const isWin = trade.pnl > 0;
                  const isLoss = trade.pnl < 0;

                  return (
                    <tr
                      key={trade.id}
                      className={`transition-colors ${
                        isOpen
                          ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                          : "hover:bg-background/40"
                      }`}
                    >
                      {/* 1. Estado Visual con Badge Destacado */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span>EN VIVO • ABIERTA</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-gray-800/90 text-gray-300 border border-gray-700/80">
                            <span>🏁 CERRADA</span>
                          </span>
                        )}
                      </td>

                      {/* 2. Horarios Exactos (Apertura, Cierre y Duración) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-emerald-400 font-bold text-[10px] px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                              IN
                            </span>
                            <span className="text-gray-200 font-mono text-[11px] font-medium">
                              {trade.openTimeStr || trade.timeStr}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <span className={`font-bold text-[10px] px-1 py-0.2 rounded border ${
                              isOpen
                                ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                : "text-gray-400 bg-gray-800 border-gray-700"
                            }`}>
                              OUT
                            </span>
                            <span className={`font-mono text-[11px] font-medium ${isOpen ? "text-emerald-400 animate-pulse" : "text-gray-400"}`}>
                              {isOpen ? "En mercado 🟢" : trade.closeTimeStr || trade.timeStr}
                            </span>
                            {trade.durationStr && (
                              <span className="text-[10px] text-gray-500 ml-1 font-mono">
                                ({trade.durationStr})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Trader Copiado */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs">{trade.traderName}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {trade.traderAddr.slice(0, 6)}...{trade.traderAddr.slice(-4)}
                          </span>
                        </div>
                      </td>

                      {/* 4. Activo / Moneda */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-extrabold text-white text-xs px-2.5 py-1 rounded-lg bg-background border border-surface-border shadow-inner">
                          {trade.coin}
                        </span>
                      </td>

                      {/* 5. Dirección (Long/Short) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                            isLong
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {isLong ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span>{trade.side}</span>
                          <span className="opacity-70 text-[9px]">({trade.leverage}x)</span>
                        </span>
                      </td>

                      {/* 6. Precios (Entrada / Salida o Mark) */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-mono">
                        <div className="space-y-0.5">
                          <div className="text-white text-xs font-bold">
                            ${trade.entryPx >= 1 ? trade.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : trade.entryPx.toFixed(4)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {isOpen ? (
                              <span className="text-purple-300">Mark: ${trade.markPx ? trade.markPx.toFixed(2) : trade.entryPx.toFixed(2)}</span>
                            ) : (
                              <span>Exit: ${trade.exitPx ? trade.exitPx.toFixed(2) : trade.entryPx.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 7. Tamaño USD y Tokens */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-sans">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-white text-xs font-mono">
                            ${trade.usdValue > 0 && trade.usdValue < 0.01 ? trade.usdValue.toFixed(4) : trade.usdValue.toFixed(2)} USD
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {trade.size > 0 && trade.size < 0.001 ? trade.size.toFixed(4) : trade.size.toFixed(2)} {trade.coin}
                          </span>
                        </div>
                      </td>

                      {/* 8. PnL Simulado */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-bold font-mono">
                        <div className="flex flex-col items-end">
                          <span
                            className={`text-xs ${
                              isWin
                                ? "text-emerald-400"
                                : isLoss
                                ? "text-red-400"
                                : "text-gray-400"
                            }`}
                          >
                            {trade.pnl > 0 ? "+" : ""}${Math.abs(trade.pnl) > 0 && Math.abs(trade.pnl) < 0.01 ? trade.pnl.toFixed(4) : trade.pnl.toFixed(2)}
                          </span>
                          {trade.pnlPct !== 0 && (
                            <span
                              className={`text-[10px] ${
                                isWin
                                  ? "text-emerald-500/80"
                                  : isLoss
                                  ? "text-red-500/80"
                                  : "text-gray-500"
                              }`}
                            >
                              ({trade.pnlPct > 0 ? "+" : ""}{trade.pnlPct.toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Footer / Paginación */}
        {filteredTrades.length > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-surface-border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-gray-400">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong> (Mostrando {paginatedTrades.length} de {filteredTrades.length} trades)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface transition-colors"
              >
                Anterior
              </button>

              <div className="flex gap-1 font-mono">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all ${
                        currentPage === pageNum
                          ? "bg-primary text-black"
                          : "border border-surface-border text-gray-400 hover:text-white hover:bg-surface"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
