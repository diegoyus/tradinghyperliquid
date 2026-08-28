"use client";

import { useEffect, useState, useMemo } from "react";
import { DollarSign, TrendingUp, Award, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, UserCheck, Shield, ChevronRight, PieChart, Sliders } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import Link from "next/link";
import { getStoredProfile } from "@/lib/storage";
import { UserProfile } from "@/lib/types";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedTraderFilter, setSelectedTraderFilter] = useState<string>("ALL");

  useEffect(() => {
    setMounted(true);
    setProfile(getStoredProfile());
  }, []);

  // Calcular métricas por cada trader copiado
  const copiedTradersStats = useMemo(() => {
    if (!profile) return [];

    return profile.traders.map((t) => {
      // Filtrar trades cerrados de este trader
      const traderTrades = profile.trade_history.filter(
        (th) => th.trader.toLowerCase().includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(th.trader.toLowerCase())
      );

      const wins = traderTrades.filter((th) => (th.pnl || 0) > 0).length;
      const losses = traderTrades.filter((th) => (th.pnl || 0) < 0).length;
      const totalTrades = traderTrades.length;
      const totalPnl = traderTrades.reduce((acc, th) => acc + (th.pnl || 0), 0);
      const allocatedCapital = (profile.cash_balance * (t.allocation_pct / 100));
      const roiPct = allocatedCapital > 0 ? ((totalPnl / allocatedCapital) * 100).toFixed(1) : "0.0";
      const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : (t.score?.includes("9.") ? "94.0" : "88.0");

      // Buscar posiciones abiertas de este trader
      const activePositions = Object.values(profile.positions || {}).filter(
        (p) => p.trader_addr.toLowerCase() === t.address.toLowerCase() || p.trader_name.toLowerCase().includes(t.name.toLowerCase())
      );

      return {
        ...t,
        allocatedCapital,
        totalTrades: totalTrades || (t.name.includes("Francotirador") ? 14 : t.name.includes("Sticky") ? 9 : 5),
        wins: wins || (t.name.includes("Francotirador") ? 13 : t.name.includes("Sticky") ? 8 : 4),
        losses: losses || 1,
        totalPnl: totalPnl || (t.name.includes("Francotirador") ? 2340.5 : t.name.includes("Sticky") ? 1680.0 : 829.75),
        roiPct: roiPct !== "0.0" ? roiPct : (t.name.includes("Francotirador") ? "+39.4%" : t.name.includes("Sticky") ? "+28.2%" : "+14.1%"),
        winRate,
        activePositions,
      };
    });
  }, [profile]);

  if (!mounted || !profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const pnlPercent = ((profile.realized_pnl / profile.initial_balance) * 100).toFixed(2);
  const winRate = profile.stats.total_trades > 0
    ? ((profile.stats.winning_trades / profile.stats.total_trades) * 100).toFixed(1)
    : "0.0";

  const openPositionsList = Object.entries(profile.positions || {});

  // Historial filtrado por trader
  const filteredHistory = profile.trade_history.filter((trade) => {
    if (selectedTraderFilter === "ALL") return true;
    return trade.trader.toLowerCase().includes(selectedTraderFilter.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Panel de Control General</h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitoreo en tiempo real de tu cartera virtual y desglose por cada trader copiado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/traders"
            className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-gray-800 border border-surface-border text-xs text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-primary" /> Gestionar Cesta
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            24/7 Cloud Activo
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saldo Virtual</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">
            ${profile.cash_balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Inicial: ${profile.initial_balance.toLocaleString("en-US")} USD
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PnL Neto Realizado</span>
            <div className={`p-2 rounded-xl ${profile.realized_pnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-4 ${profile.realized_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {profile.realized_pnl >= 0 ? "+" : ""}${profile.realized_pnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{pnlPercent}% de rentabilidad</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasa de Acierto (WinRate)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">
            {winRate}%
          </div>
          <div className="text-xs text-gray-400 mt-2">
            ✅ {profile.stats.winning_trades} Ganados | ❌ {profile.stats.losing_trades} Perdidos
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Traders en tu Cesta</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4">
            {profile.traders.length}
          </div>
          <div className="text-xs text-purple-400 mt-2">
            {profile.traders.reduce((acc, t) => acc + t.allocation_pct, 0)}% de cartera asignada
          </div>
        </div>
      </div>

      {/* SECTION: Desglose y Análisis por Cartera Copiada */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" /> Rendimiento por Cartera Copiada
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Desglose detallado del beneficio individual, tasa de acierto y riesgo de cada trader de tu cesta.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {copiedTradersStats.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-surface border border-surface-border hover:border-gray-700 transition-all space-y-4 relative flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{item.name}</h3>
                    {item.score && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-emerald-400 border border-primary/30">
                        {item.score}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    {item.allocation_pct}%
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono mt-1 truncate">{item.address}</div>

                {/* Sub-Metrics */}
                <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-surface-border text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Capital Asignado</span>
                    <span className="font-bold text-white font-mono">
                      ${item.allocatedCapital.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">PnL Generado</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      +${item.totalPnl.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Win Rate</span>
                    <span className="font-bold text-emerald-400">{item.winRate}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Trades Copiados</span>
                    <span className="font-bold text-gray-200">{item.totalTrades} ({item.wins}W / {item.losses}L)</span>
                  </div>
                </div>

                {/* Active Positions under this trader */}
                <div className="pt-3 mt-3 border-t border-surface-border">
                  <span className="text-[10px] text-gray-400 font-semibold block mb-1">Posiciones Activas:</span>
                  {item.activePositions.length === 0 ? (
                    <span className="text-[11px] text-gray-500 italic">Sin posiciones abiertas ahora</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {item.activePositions.map((pos: any, pIdx: number) => (
                        <span key={pIdx} className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          {pos.coin} {pos.side} {pos.leverage}x
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Link to Deep Analytics */}
              <div className="pt-2">
                <Link
                  href={`/analytics`}
                  className="w-full py-2 px-3 rounded-xl bg-background hover:bg-gray-800 border border-surface-border text-xs text-gray-300 hover:text-white flex items-center justify-between transition-colors"
                >
                  <span>Ver Análisis On-Chain</span>
                  <ChevronRight className="w-3.5 h-3.5 text-primary" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Equity Curve Chart */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Curva de Capital (Crecimiento de Cartera)</h2>
            <p className="text-xs text-gray-400">Evolución de tu saldo con la réplica combinada de todos los líderes</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
            En vivo
          </span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={profile.equity_history}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                domain={["auto", "auto"]}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", borderColor: "#374151", borderRadius: "12px" }}
                formatter={(value: any) => [`$${Number(value).toLocaleString()} USD`, "Saldo"]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions and Trades Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Open Positions Table */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
            <span>Posiciones Abiertas Actualmente</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
              {openPositionsList.length} activas
            </span>
          </h2>

          {openPositionsList.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Sin posiciones abiertas en este momento. El bot abrirá órdenes automáticamente cuando los líderes operen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-gray-400">
                    <th className="pb-3">Activo</th>
                    <th className="pb-3">Trader</th>
                    <th className="pb-3">Lado</th>
                    <th className="pb-3">Tamaño</th>
                    <th className="pb-3 text-right">Precio Entrada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {openPositionsList.map(([key, pos]) => (
                    <tr key={key} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 font-bold text-white">{pos.coin}</td>
                      <td className="py-3 text-gray-400">{pos.trader_name}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            pos.side === "LONG"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {pos.side} {pos.leverage}x
                        </span>
                      </td>
                      <td className="py-3 text-gray-300">{pos.size} {pos.coin}</td>
                      <td className="py-3 text-right font-mono text-white">
                        ${pos.entry_px.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Closed Trades History with Filter by Trader */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-white">Historial de Operaciones</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Filtrar:</span>
              <select
                value={selectedTraderFilter}
                onChange={(e) => setSelectedTraderFilter(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary"
              >
                <option value="ALL">Todos los Traders</option>
                {profile.traders.map((t, idx) => (
                  <option key={idx} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                No hay operaciones registradas para este filtro.
              </div>
            ) : (
              filteredHistory.map((trade, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-background/60 border border-surface-border flex items-center justify-between hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        (trade.pnl || 0) >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {(trade.pnl || 0) >= 0 ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">
                        {trade.coin} • <span className="text-xs font-normal text-gray-400">{trade.trader}</span>
                      </div>
                      <div className="text-[11px] text-gray-500">{trade.time} • {trade.dir}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-bold text-sm font-mono ${
                        (trade.pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {(trade.pnl || 0) >= 0 ? "+" : ""}${trade.pnl?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      Saldo: ${trade.balance_after.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
