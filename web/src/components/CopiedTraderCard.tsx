"use client";

import React, { useState } from "react";
import {
  PieChart,
  DollarSign,
  TrendingUp,
  Activity,
  History,
  Calendar,
  Award,
  Wallet,
  Zap,
  Shield,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Coins
} from "lucide-react";

export interface CopiedTraderCardProps {
  trader: any;
  isReal: boolean;
  onEditAlias?: (trader: any) => void;
}

export function CopiedTraderCard({ trader: t, isReal, onEditAlias }: CopiedTraderCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isProfitTotal = (t.totalCombinedPnl ?? 0) >= 0;
  const openPositions = t.openPositions || [];
  const hasOpenPositions = openPositions.length > 0;
  const totalTrades = t.totalTrades || 0;
  const wins = t.wins || 0;
  const losses = t.losses || 0;
  const winRateNum = parseFloat(t.winRate || "0");

  // Racha
  const streakCount = t.consecutiveStreakCount || 0;
  const streakType = t.consecutiveStreakType || "NONE";

  return (
    <div className={`p-5 sm:p-6 rounded-3xl border transition-all shadow-xl space-y-5 ${
      isReal
        ? "bg-surface/95 border-blue-500/30 hover:border-blue-500/50 shadow-blue-950/20"
        : "bg-surface/95 border-surface-border hover:border-primary/40 shadow-black/20"
    }`}>
      {/* 1. CABECERA: Nombre, Alias, Score, Dirección y Estado Actual */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-surface-border/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {t.alias ? (
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-amber-300 text-lg">🏷️ {t.alias}</span>
                <span className="text-xs text-gray-400 font-medium">({t.name})</span>
              </div>
            ) : (
              <span className="font-black text-white text-lg">{t.name}</span>
            )}

            {t.score && (
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                ★ {t.score}
              </span>
            )}

            {onEditAlias && (
              <button
                type="button"
                onClick={() => onEditAlias(t)}
                className="px-2 py-0.5 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                title="Cambiar Alias Personalizado"
              >
                <span>✏️ {t.alias ? "Editar Alias" : "+ Poner Alias"}</span>
              </button>
            )}

            {/* Badge de Estado Dinámico */}
            {hasOpenPositions ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{openPositions.length} viva{openPositions.length > 1 ? "s" : ""} en mercado</span>
              </span>
            ) : streakCount >= 2 && streakType === "WIN" ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                <span>🔥 {streakCount} victorias seguidas</span>
              </span>
            ) : streakCount >= 2 && streakType === "LOSS" ? (
              <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30 flex items-center gap-1">
                <span>⚠️ {streakCount} pérdidas seguidas</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-surface text-gray-400 text-[10px] font-medium border border-surface-border flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                <span>Esperando señal</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-400">
            <span className="font-mono text-[11px] bg-background/80 px-2 py-0.5 rounded border border-surface-border text-gray-300">
              {t.address.slice(0, 6)}...{t.address.slice(-4)}
            </span>
            <span className={`px-2 py-0.5 rounded font-bold text-[11px] border ${
              isReal
                ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            }`}>
              {t.allocation_pct}% (${(t.assignedUSD || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USD asignados)
            </span>
            <span className="px-2 py-0.5 rounded bg-background text-gray-400 border border-surface-border text-[10px]">
              SL: -{t.stop_loss_pct}% • Max {t.max_leverage}x
            </span>
            {t.joined_at && (
              <span className="px-2 py-0.5 rounded bg-surface text-gray-400 border border-surface-border text-[10px]">
                Copiando desde {new Date(t.joined_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>

        {/* 2. BANNER PRINCIPAL DE BENEFICIO (Valor Absoluto $ y ROI %) */}
        <div className="sm:text-right bg-background/80 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-surface-border/60">
          <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">
            Mis Ganancias de Réplica
          </span>
          <div className="flex sm:justify-end items-baseline gap-1.5">
            <span className={`text-2xl font-black font-mono ${isProfitTotal ? "text-emerald-400" : "text-red-400"}`}>
              {isProfitTotal ? "+" : ""}${(t.totalCombinedPnl || 0).toFixed(2)} USD
            </span>
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
              isProfitTotal 
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}>
              {t.totalRoiPctStr || `${((t.totalCombinedPnl || 0) / (t.assignedUSD || 1) * 100).toFixed(2)}%`}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex sm:justify-end items-center gap-1.5 mt-0.5 font-mono">
            <span>Cerrado: <strong className={t.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{t.realizedPnl >= 0 ? "+" : ""}${(t.realizedPnl || 0).toFixed(2)}</strong></span>
            <span className="text-gray-600">•</span>
            <span>Flotante: <strong className={t.floatingPnl >= 0 ? "text-purple-300" : "text-red-400"}>{t.floatingPnl >= 0 ? "+" : ""}${(t.floatingPnl || 0).toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* AVISO INFORMATIVO SI LLEVA 0 OPERACIONES */}
      {totalTrades === 0 && !hasOpenPositions && (
        <div className="p-3 rounded-2xl bg-surface/70 border border-surface-border text-xs text-gray-300 flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-white text-[11px]">
              Copia activa en segundo plano ({t.allocation_pct}% de tu capital: ${(t.assignedUSD || 0).toFixed(0)} USD)
            </div>
            <div className="text-[10px] text-gray-400 leading-relaxed">
              Aún no se han ejecutado nuevas operaciones desde que empezaste a copiar a este trader. Cuando el líder abra una posición en Hyperliquid, el motor la replicará automáticamente en tu cuenta.
            </div>
          </div>
        </div>
      )}

      {/* 3. GRID DE 4 PILARES CLAVE: Veces Copiado, Frecuencia Diaria, Ganancia Media y Profit Factor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
        
        {/* Pilar 1: Veces que he copiado y resultado (Ganadas vs Perdidas) */}
        <div className="p-3 rounded-2xl bg-background/70 border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-sans font-bold">
            <span>Mis Operaciones</span>
            <History className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-base font-black text-white flex items-baseline gap-1.5">
            <span>{totalTrades} trades</span>
          </div>
          
          {/* Barra Visual de Win Rate */}
          <div className="space-y-1 pt-0.5 font-sans">
            <div className="flex items-center justify-between text-[10px]">
              <span className={wins > 0 ? "text-emerald-400 font-bold" : "text-gray-400 font-medium"}>{wins} Ganados</span>
              <span className={losses > 0 ? "text-red-400 font-bold" : "text-gray-400 font-medium"}>{losses} Perdidos</span>
            </div>
            <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden flex">
              {totalTrades > 0 ? (
                <>
                  <div
                    style={{ width: `${winRateNum}%` }}
                    className="bg-emerald-500 h-full rounded-full transition-all"
                  />
                  <div
                    style={{ width: `${100 - winRateNum}%` }}
                    className="bg-red-500 h-full rounded-full transition-all"
                  />
                </>
              ) : (
                <div className="bg-gray-700 h-full w-full" />
              )}
            </div>
            <div className="text-[10px] text-gray-400 flex items-center justify-between pt-0.5">
              <span>Acierto:</span>
              <strong className={`font-mono font-bold ${totalTrades > 0 ? (winRateNum >= 50 ? "text-emerald-400" : "text-amber-400") : "text-gray-400"}`}>
                {totalTrades > 0 ? `${t.winRate || "0.0"}%` : "—"}
              </strong>
            </div>
          </div>
        </div>

        {/* Pilar 2: Cuántos trades copio de media por día */}
        <div className="p-3 rounded-2xl bg-background/70 border border-emerald-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-sans font-bold">
            <span>Ritmo & Frecuencia</span>
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-black text-emerald-300">
            {totalTrades > 0 ? `~${t.tradesPerDay || "0.0"}` : "0.0"} <span className="text-xs font-normal text-gray-400">/día</span>
          </div>
          <div className="space-y-0.5 text-[10px] text-gray-400 font-sans">
            <div className="flex items-center justify-between">
              <span>Cadencia:</span>
              <strong className="text-gray-300 font-mono">
                {totalTrades > 0 && t.avgHoursPerTrade && t.avgHoursPerTrade > 0 ? `1 trade / ${t.avgHoursPerTrade}h` : "Esperando señal"}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Últimos 7 días:</span>
              <strong className="text-emerald-400 font-mono">
                {t.weeklyTradesCount || 0} ops ({t.weeklyWins || 0}G/{t.weeklyLosses || 0}P)
              </strong>
            </div>
          </div>
        </div>

        {/* Pilar 3: Dinero ganado de media por trade */}
        <div className="p-3 rounded-2xl bg-background/70 border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-sans font-bold">
            <span>Media por Trade</span>
            <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className={`text-base font-black ${ (t.avgTradePnl || 0) > 0 ? "text-emerald-400" : (t.avgTradePnl || 0) < 0 ? "text-red-400" : "text-gray-300"}`}>
            {(t.avgTradePnl || 0) >= 0 ? "+" : ""}${(t.avgTradePnl || 0).toFixed(2)}
          </div>
          <div className="space-y-0.5 text-[10px] text-gray-400 font-sans">
            <div className="flex items-center justify-between">
              <span>Avg Ganancia:</span>
              <strong className="text-emerald-400 font-mono">{t.avgWin > 0 ? `+$${(t.avgWin || 0).toFixed(2)}` : "—"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Avg Pérdida:</span>
              <strong className="text-red-400 font-mono">{t.avgLoss > 0 ? `-$${(t.avgLoss || 0).toFixed(2)}` : "—"}</strong>
            </div>
          </div>
        </div>

        {/* Pilar 4: Profit Factor & Payoff Ratio */}
        <div className="p-3 rounded-2xl bg-background/70 border border-surface-border space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase font-sans font-bold">
            <span>Profit Factor</span>
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-base font-black text-white">
            {totalTrades > 0 ? `${t.profitFactor || "0.00"}x` : "—"}
          </div>
          <div className="space-y-0.5 text-[10px] text-gray-400 font-sans">
            <div className="flex items-center justify-between">
              <span>Ratio B/P (Payoff):</span>
              <strong className="text-cyan-300 font-mono">{totalTrades > 0 ? `${t.payoffRatio || "0.00"}x` : "—"}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>7D Beneficio:</span>
              <strong className={`font-mono ${(t.weeklyPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(t.weeklyPnl || 0) >= 0 ? "+" : ""}${(t.weeklyPnl || 0).toFixed(1)}
              </strong>
            </div>
          </div>
        </div>

      </div>

      {/* 4. SECCIÓN DESPLEGABLE: Más Estadísticas Cuantitativas & Récords */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full py-2 px-3 rounded-xl bg-background/50 hover:bg-background/80 border border-surface-border/60 text-xs text-gray-300 font-semibold flex items-center justify-between transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>{showDetails ? "Ocultar Análisis Avanzado" : "Ver Récords, Auditoría del Líder y Desglose"}</span>
          </span>
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showDetails && (
          <div className="mt-3 p-4 rounded-2xl bg-background/70 border border-surface-border/80 space-y-4 animate-fadeIn">
            {/* BLOQUE EXCLUSIVO: Auditoría Histórica del Líder en Blockchain */}
            {t.leaderAudit && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Auditoría Histórica del Líder en Blockchain (Hyperliquid L1)</span>
                  </span>
                  <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30 font-mono">
                    Histórico Previo
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Track record acumulado por este trader en la blockchain antes de que tú empezaras a copiarlo. <em>(Datos públicos de auditoría; no representan balance de tu cuenta)</em>:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                  <div className="p-2 rounded-xl bg-background/60 border border-surface-border">
                    <span className="text-[10px] text-gray-400 font-sans block">Total Trades Líder</span>
                    <span className="font-bold text-white">{t.leaderAudit.totalFills} trades</span>
                  </div>
                  <div className="p-2 rounded-xl bg-background/60 border border-surface-border">
                    <span className="text-[10px] text-gray-400 font-sans block">Efectividad Global</span>
                    <span className="font-bold text-emerald-400">{t.leaderAudit.winRate}% ({t.leaderAudit.wins}G / {t.leaderAudit.losses}P)</span>
                  </div>
                  <div className="p-2 rounded-xl bg-background/60 border border-surface-border">
                    <span className="text-[10px] text-gray-400 font-sans block">Profit Factor Líder</span>
                    <span className="font-bold text-cyan-300">{t.leaderAudit.profitFactor}x</span>
                  </div>
                  <div className="p-2 rounded-xl bg-background/60 border border-surface-border">
                    <span className="text-[10px] text-gray-400 font-sans block">PnL Acumulado Líder</span>
                    <span className="font-bold text-emerald-400">+${(t.leaderAudit.netPnl || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            )}
            {/* Récords de Mejores / Peores Operaciones */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 font-sans font-bold uppercase block">🏆 Mejor Trade Copiado</span>
                <div className="text-sm font-black text-emerald-400">
                  +${(t.bestTrade || 0).toFixed(2)}
                </div>
                <span className="text-[9px] text-emerald-400/80 font-sans">
                  +{((t.bestTradePct || 0)).toFixed(1)}% ROI
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 font-sans font-bold uppercase block">📉 Peor Trade Sufrido</span>
                <div className="text-sm font-black text-red-400">
                  ${(t.worstTrade || 0).toFixed(2)}
                </div>
                <span className="text-[9px] text-red-400/80 font-sans">
                  {((t.worstTradePct || 0)).toFixed(1)}% ROI
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 font-sans font-bold uppercase block">💰 Ganancia Bruta Total</span>
                <div className="text-sm font-black text-emerald-300">
                  +${(t.grossProfit || 0).toFixed(2)}
                </div>
                <span className="text-[9px] text-gray-400 font-sans">Suma de aciertos</span>
              </div>

              <div className="p-2.5 rounded-xl bg-surface border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 font-sans font-bold uppercase block">🔻 Pérdida Bruta Total</span>
                <div className="text-sm font-black text-red-300">
                  -${(t.grossLoss || 0).toFixed(2)}
                </div>
                <span className="text-[9px] text-gray-400 font-sans">Suma de fallos</span>
              </div>
            </div>

            {/* Utilización de Margen Asignado */}
            <div className="p-3 rounded-xl bg-surface border border-surface-border space-y-2 text-xs">
              <div className="flex items-center justify-between font-sans">
                <span className="text-gray-300 font-bold flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-primary" />
                  Margen en Riesgo vs Cupo Asignado:
                </span>
                <span className="font-mono text-gray-400 text-[11px]">
                  ${(t.marginUsed || 0).toFixed(2)} / ${(t.assignedUSD || 0).toFixed(0)} USD ({((t.marginUtilizationPct || 0)).toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, t.marginUtilizationPct || 0)}%` }}
                  className={`h-full rounded-full transition-all ${
                    (t.marginUtilizationPct || 0) > 80 ? "bg-red-500" : "bg-primary"
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-sans pt-0.5">
                <span>Margen libre restante: <strong className="text-white font-mono">${(t.freeAssignedMargin || Math.max(0, (t.assignedUSD || 0) - (t.marginUsed || 0))).toFixed(2)} USD</strong></span>
                <span>Volumen total gestionado: <strong className="text-white font-mono">${(t.totalVolumeUSD || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</strong></span>
              </div>
            </div>

            {/* Desglose de Monedas Operadas */}
            {t.coinBreakdown && t.coinBreakdown.length > 0 && (
              <div className="pt-2 border-t border-surface-border/50">
                <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1.5 font-sans">
                  🪙 Criptomonedas Operadas en tu Cartera:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.coinBreakdown.map((cb: any, cIdx: number) => (
                    <span
                      key={cIdx}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-gray-200 font-mono font-bold text-xs flex items-center gap-1.5"
                    >
                      <span>{cb.coin}</span>
                      <span className="text-primary font-bold text-[10px] bg-primary/10 px-1.5 py-0.2 rounded border border-primary/20">
                        {cb.pct}% ({cb.count} ops)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. POSICIONES ABIERTAS EN TIEMPO REAL */}
      <div className="space-y-2.5 pt-2 border-t border-surface-border/50">
        <div className="flex items-center justify-between text-xs">
          <span className="font-extrabold text-gray-300 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            Posiciones Abiertas en Vivo ({openPositions.length})
          </span>
          {hasOpenPositions && (
            <span className="text-[10px] text-emerald-400 font-bold animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Replicadas en Hyperliquid L1
            </span>
          )}
        </div>

        {hasOpenPositions ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {openPositions.map((pos: any, pIdx: number) => {
              const isLong = pos.side === "LONG";
              const isPosProfit = pos.pnl >= 0;

              return (
                <div
                  key={pIdx}
                  className="p-3.5 rounded-2xl bg-background/90 border border-emerald-500/30 space-y-2 font-mono text-xs shadow-md shadow-black/20"
                >
                  <div className="flex items-center justify-between font-sans">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-sm">{pos.coin}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          isLong
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {isLong ? "↗ LONG" : "↘ SHORT"} {pos.leverage}x
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-black font-mono text-sm block ${isPosProfit ? "text-emerald-400" : "text-red-400"}`}>
                        {isPosProfit ? "+" : ""}${pos.pnl.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-bold ${isPosProfit ? "text-emerald-400/80" : "text-red-400/80"}`}>
                        {isPosProfit ? "+" : ""}{(pos.pnlPct || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 pt-2 border-t border-surface-border/40 font-sans">
                    <div>
                      <span>Entrada: </span>
                      <strong className="text-gray-200 font-mono">${Number(pos.entryPx).toLocaleString()}</strong>
                    </div>
                    <div className="text-right">
                      <span>Tamaño: </span>
                      <strong className="text-gray-200 font-mono">${Number(pos.usdValue).toFixed(0)} USD</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-sans pt-1">
                    <span>Margen propio: <strong className="text-white font-mono">${Number(pos.marginUSD || (pos.usdValue / pos.leverage)).toFixed(2)}</strong></span>
                    {pos.durationStr && (
                      <span className="flex items-center gap-1 text-gray-400 font-mono">
                        <Clock className="w-3 h-3 text-gray-500" />
                        {pos.durationStr}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-background/50 border border-surface-border/40 text-xs text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              Sin posiciones abiertas en este momento
            </span>
            <span className="text-[10px] text-gray-500 font-mono">Capital 100% en liquidez</span>
          </div>
        )}
      </div>

    </div>
  );
}
