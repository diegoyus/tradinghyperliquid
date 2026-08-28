"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Award, Activity, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getStoredProfile, resetProfile } from "@/lib/storage";
import { UserProfile } from "@/lib/types";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setProfile(getStoredProfile());
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Panel de Control</h1>
          <p className="text-sm text-gray-400 mt-1">
            Cartera Virtual de Copy Trading • Monitoreo en tiempo real de Hyperliquid DEX
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Simulación Activa
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

      {/* Interactive Equity Curve Chart */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Curva de Capital (Crecimiento de Cartera)</h2>
            <p className="text-xs text-gray-400">Evolución de tu saldo con la réplica de trades</p>
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

        {/* Closed Trades History */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center justify-between">
            <span>Historial Reciente de Trades</span>
            <span className="text-xs text-gray-400">Últimas operaciones</span>
          </h2>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {profile.trade_history.map((trade, idx) => (
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
