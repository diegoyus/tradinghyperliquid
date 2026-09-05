"use client";

import { useEffect, useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  Award,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  UserCheck,
  Shield,
  ChevronRight,
  PieChart,
  Sliders,
  HelpCircle,
  GraduationCap,
  Sparkles,
  History,
  Wallet,
  Lock,
  Zap,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  Calendar,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  X,
  Info,
  Coins
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import Link from "next/link";
import { getStoredProfile, resetProfile, updateTradersConfig, saveStoredProfile, isAuthenticated, updateTradingMode } from "@/lib/storage";
import { UserProfile, UnifiedTrade } from "@/lib/types";
import { getUserProfileFromCloud, saveUserProfileToCloud } from "@/lib/cloudSync";
import { fetchFullTradeHistory, approveTradeId, rejectTradeId, getLeaderAudit } from "@/lib/tradeHistory";
import { MetricsInfoModal } from "@/components/MetricsInfoModal";
import { EditAliasModal } from "@/components/EditAliasModal";
import { GuidedTour } from "@/components/GuidedTour";
import { CopiedTraderCard } from "@/components/CopiedTraderCard";

function CustomDailyTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const seguro = Number(data.dineroSeguro ?? data.realized ?? 0);
    const abierto = Number(data.dineroAbierto ?? 0);
    const flotante = Number(data.ganandoPerdiendo ?? 0);
    const total = Number(data.dineroTotal ?? data.equity ?? 0);
    const change = Number(data.dailyChange ?? 0);

    return (
      <div className="p-4 rounded-2xl bg-black/95 border border-surface-border shadow-2xl space-y-2 text-xs min-w-[260px]">
        <div className="font-extrabold text-white text-sm border-b border-surface-border/60 pb-1.5 flex items-center justify-between">
          <span>📅 {data.fullDate || data.time}</span>
          {data.tradesCount !== undefined && data.tradesCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-surface-border text-gray-300 font-mono">
              {data.tradesCount} {data.tradesCount === 1 ? "op" : "ops"}
            </span>
          )}
        </div>
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              🛡️ Dinero Seguro:
            </span>
            <strong className="text-emerald-400 font-mono text-xs">
              ${seguro.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {abierto > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                ⚡ Dinero Abierto:
              </span>
              <strong className="text-blue-300 font-mono text-xs">
                ${abierto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          )}

          {data.ganandoPerdiendo !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                📊 Ganando / Perdiendo:
              </span>
              <strong className={`font-mono text-xs ${flotante >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {flotante >= 0 ? "+" : ""}${flotante.toFixed(2)}
              </strong>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-surface-border/60 pt-2 mt-1">
            <span className="text-white font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              💰 Total (Todo incluido):
            </span>
            <strong className="text-amber-300 font-mono text-sm font-black">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>

          {data.dailyChange !== undefined && data.dailyChange !== 0 && (
            <div className="text-[10px] text-gray-400 pt-0.5 text-right flex items-center justify-end gap-1">
              <span>Resultado del día:</span>
              <strong className={change >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                {change >= 0 ? "+" : ""}${change.toFixed(2)}
              </strong>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function DailyBreakdownTable({ data, isReal }: { data: any[]; isReal: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return null;

  // Mostramos los días de más reciente a más antiguo
  const displayData = [...data].reverse();
  const visibleRows = expanded ? displayData : displayData.slice(0, 5);

  return (
    <div className="rounded-2xl bg-surface/70 border border-surface-border overflow-hidden mt-4">
      <div className="p-4 flex items-center justify-between border-b border-surface-border/60 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Desglose Registro Día por Día</h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-border text-gray-300 font-mono">
            {data.length} {data.length === 1 ? "registro" : "registros"}
          </span>
        </div>
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> 🛡️ Dinero Seguro
          </span>
          <span className="text-gray-600">•</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> 💰 Total
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-left text-xs min-w-[620px]">
          <thead className="bg-surface-border/30 text-gray-400 uppercase font-semibold border-b border-surface-border/60 text-[11px]">
            <tr>
              <th className="py-2.5 px-4">Día / Fecha</th>
              <th className="py-2.5 px-4 text-right">🛡️ Dinero Seguro</th>
              <th className="py-2.5 px-4 text-right">⚡ Dinero Abierto</th>
              <th className="py-2.5 px-4 text-right">📊 Flotante</th>
              <th className="py-2.5 px-4 text-right">💰 Dinero Total</th>
              <th className="py-2.5 px-4 text-right">📈 PnL del Día</th>
              <th className="py-2.5 px-4 text-center">Operaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/40 font-mono">
            {visibleRows.map((row, idx) => {
              const seguro = Number(row.dineroSeguro ?? row.realized ?? 0);
              const abierto = Number(row.dineroAbierto ?? 0);
              const flotante = Number(row.ganandoPerdiendo ?? 0);
              const total = Number(row.dineroTotal ?? row.equity ?? 0);
              const change = Number(row.dailyChange ?? 0);

              return (
                <tr key={idx} className="hover:bg-surface-border/20 transition-colors">
                  <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                    <span>{row.fullDate || row.time}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    ${seguro.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-300">
                    {abierto > 0 ? `$${abierto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {row.ganandoPerdiendo !== undefined && flotante !== 0 ? (
                      <span className={flotante >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                        {flotante >= 0 ? "+" : ""}${flotante.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500">$0.00</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-amber-300 text-sm">
                    ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {change !== 0 ? (
                      <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        change > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {change > 0 ? "+" : ""}${change.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-sans text-gray-400 text-[11px]">
                    {row.tradesCount > 0 ? `${row.tradesCount} ${row.tradesCount === 1 ? "op" : "ops"}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayData.length > 5 && (
        <div className="p-2.5 text-center border-t border-surface-border/40 bg-surface-border/10">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold transition-colors py-1 px-3"
          >
            {expanded ? "Mostrar menos días ▲" : `Ver todos los días (${displayData.length}) ▼`}
          </button>
        </div>
      )}
    </div>
  );
}

function PerformanceStatsSection({
  isReal,
  capitalBase,
  totalAbsoluteGain,
  globalTotalRoiPct,
  avgPnlPerTradeUSD,
  avgRoiPerTradePct,
  avgDailyPnlUSD,
  avgDailyRoiPct,
  winRate,
  wins,
  losses,
  totalTrades,
  profitFactor,
  bestTradePnl,
  worstTradePnl,
}: {
  isReal: boolean;
  capitalBase: number;
  totalAbsoluteGain: number;
  globalTotalRoiPct: number;
  avgPnlPerTradeUSD: number;
  avgRoiPerTradePct: number;
  avgDailyPnlUSD: number;
  avgDailyRoiPct: number;
  winRate: string | number;
  wins: number;
  losses: number;
  totalTrades: number;
  profitFactor: string | number;
  bestTradePnl: number;
  worstTradePnl: number;
}) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-surface-border space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border/60 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <span>Estadísticas & Rendimiento Cuantitativo</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Métricas clave de rentabilidad sobre el capital invertido, promedio por operación y consistencia.
          </p>
        </div>
        <span className="px-3 py-1 rounded-xl text-xs font-bold border self-start sm:self-auto flex items-center gap-1.5 bg-background border-surface-border text-gray-300">
          <span className={`w-2 h-2 rounded-full ${isReal ? "bg-blue-400" : "bg-emerald-400"}`} />
          <span>{isReal ? "Modo Real (On-Chain)" : "Modo Simulado ($10,000)"}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono">
        {/* 1. % Rentabilidad Total */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-amber-400" /> % Ganancia Total (ROI)
          </span>
          <div className={`text-xl sm:text-2xl font-black ${globalTotalRoiPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {globalTotalRoiPct >= 0 ? "+" : ""}{globalTotalRoiPct.toFixed(2)}%
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Sobre ${capitalBase.toFixed(2)} invertidos
          </span>
        </div>

        {/* 2. Ganancia Neta Absoluta */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Ganancia en Valor Absoluto
          </span>
          <div className={`text-xl sm:text-2xl font-black ${totalAbsoluteGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalAbsoluteGain >= 0 ? "+" : ""}${totalAbsoluteGain.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Beneficio neto en USD
          </span>
        </div>

        {/* 3. % Ganancia por Trade */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-blue-400" /> % Ganancia / Trade
          </span>
          <div className={`text-xl sm:text-2xl font-black ${avgRoiPerTradePct >= 0 ? "text-blue-400" : "text-red-400"}`}>
            {avgRoiPerTradePct >= 0 ? "+" : ""}{avgRoiPerTradePct.toFixed(2)}%
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Media {avgPnlPerTradeUSD >= 0 ? "+" : ""}${avgPnlPerTradeUSD.toFixed(2)} USD / trade
          </span>
        </div>

        {/* 4. % Ganancia Diario */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-purple-400" /> % Rendimiento Diario
          </span>
          <div className={`text-xl sm:text-2xl font-black ${avgDailyRoiPct >= 0 ? "text-purple-400" : "text-red-400"}`}>
            {avgDailyRoiPct >= 0 ? "+" : ""}{avgDailyRoiPct.toFixed(2)}%
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Media {avgDailyPnlUSD >= 0 ? "+" : ""}${avgDailyPnlUSD.toFixed(2)} USD / día
          </span>
        </div>

        {/* 5. Win Rate */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Win Rate
          </span>
          <div className="text-xl sm:text-2xl font-black text-white">
            {winRate}%
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            {wins} ganadas / {losses} pérdidas
          </span>
        </div>

        {/* 6. Profit Factor */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-yellow-400" /> Profit Factor
          </span>
          <div className="text-xl sm:text-2xl font-black text-white">
            {profitFactor}x
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Ganancia bruta vs pérdida
          </span>
        </div>

        {/* 7. Mejor Operación */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Mejor Operación
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400">
            {bestTradePnl > 0 ? `+$${bestTradePnl.toFixed(2)}` : "—"}
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Mayor ganancia individual
          </span>
        </div>

        {/* 8. Peor Operación */}
        <div className="p-4 rounded-xl bg-background/70 border border-surface-border space-y-1">
          <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> Peor Operación
          </span>
          <div className="text-xl sm:text-2xl font-black text-red-400">
            {worstTradePnl < 0 ? `-$${Math.abs(worstTradePnl).toFixed(2)}` : "—"}
          </div>
          <span className="text-[10px] text-gray-500 font-sans block truncate">
            Pérdida máxima acotada
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // 1. TODOS LOS ESTADOS (Declarados incondicionalmente al principio)
  const [profile, setProfile] = useState<UserProfile>(() => getStoredProfile());
  const [mounted, setMounted] = useState(false);
  const [selectedTraderFilter, setSelectedTraderFilter] = useState<string>("ALL");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [aliasModalTrader, setAliasModalTrader] = useState<any>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [liveStats, setLiveStats] = useState<Record<string, any>>({});
  const [liveGlobalPnl, setLiveGlobalPnl] = useState(0);
  const [liveGlobalFloatingPnl, setLiveGlobalFloatingPnl] = useState(0);
  const [liveGlobalWins, setLiveGlobalWins] = useState(0);
  const [liveGlobalLosses, setLiveGlobalLosses] = useState(0);
  const [liveTotalMarginUsed, setLiveTotalMarginUsed] = useState(0);
  const [recentTrades, setRecentTrades] = useState<UnifiedTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeFilterTab, setTradeFilterTab] = useState<"ALL" | "OPEN" | "CLOSED" | "LATEST_OPEN" | "PENDING">("ALL");
  const [realWalletData, setRealWalletData] = useState<any>(null);
  const [realWalletLoading, setRealWalletLoading] = useState(false);
  const [closingPos, setClosingPos] = useState<string | null>(null);
  const [closeSuccessMsg, setCloseSuccessMsg] = useState<string | null>(null);
  const [syncingVault, setSyncingVault] = useState(false);
  const [vaultSyncDone, setVaultSyncDone] = useState(false);
  const [liveEquityHistory, setLiveEquityHistory] = useState<any[]>([
    { time: "Inicio", realized: 10000.0, equity: 10000.0 }
  ]);
  const [simulatedDailyHistory, setSimulatedDailyHistory] = useState<any[]>([]);
  const [realFills, setRealFills] = useState<any[]>([]);
  const [realFillFilter, setRealFillFilter] = useState<"ALL" | "CLOSED_PNL" | "BUY" | "SELL">("ALL");
  const [realEquityHistory, setRealEquityHistory] = useState<any[]>([]);
  const [realDailyHistory, setRealDailyHistory] = useState<any[]>([]);
  const [chartViewMode, setChartViewMode] = useState<"DAILY" | "DETAILED">("DAILY");
  const [realStats, setRealStats] = useState<{
    winRate: number;
    wins: number;
    losses: number;
    totalTrades: number;
  }>({ winRate: 0, wins: 0, losses: 0, totalTrades: 0 });

  // 2. EFECTOS INICIALES
  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      window.location.href = "/auth?redirect=/dashboard";
      return;
    }
    const p = getStoredProfile();
    setProfile(p);

    // Sincronizar en vivo con Firestore
    const syncEmail = p.email || "diegoyusdiez@gmail.com";
    getUserProfileFromCloud(syncEmail).then((cloudProfile) => {
      if (cloudProfile) {
        setProfile(cloudProfile);
        saveStoredProfile(cloudProfile);
      }
    }).catch(() => {});

    if (typeof window !== "undefined") {
      if (localStorage.getItem("hyperliquid_tour_active") === "true") {
        setTourOpen(true);
        localStorage.removeItem("hyperliquid_tour_active");
      }

      const handleModeChange = (e: any) => {
        const cur = getStoredProfile();
        setProfile({ ...cur, trading_mode: e.detail });
      };

      window.addEventListener("trading-mode-changed", handleModeChange);
      return () => window.removeEventListener("trading-mode-changed", handleModeChange);
    }
  }, []);

  // 3. FUNCIONES DE ACCIÓN
  const handleCloseRealPosition = (coin: string) => {
    if (!confirm(`¿Estás seguro de que deseas CERRAR A MERCADO tu posición en ${coin}? Esta orden se ejecutará al precio actual.`)) {
      return;
    }
    setClosingPos(coin);
    window.open(`https://app.hyperliquid.xyz/trade/${coin}`, "_blank");
    setCloseSuccessMsg(`Redirigiendo a Hyperliquid para cerrar ${coin}...`);
    setTimeout(() => {
      setClosingPos(null);
      setCloseSuccessMsg(null);
    }, 4000);
  };

  const handlePanicCloseAll = () => {
    if (!confirm("🚨 BOTÓN DE PÁNICO: ¿Deseas cerrar TODAS las posiciones abiertas inmediatamente?")) {
      return;
    }
    window.open("https://app.hyperliquid.xyz/portfolio", "_blank");
    setCloseSuccessMsg("🚨 Abriendo cartera de Hyperliquid para cerrar todas las posiciones...");
    setTimeout(() => setCloseSuccessMsg(null), 5000);
  };

  const handleSyncVaultKeyFromDashboard = async () => {
    if (!profile) return;
    setSyncingVault(true);
    try {
      let keyToSync = profile.agent_wallet?.agent_private_key;
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
        window.location.href = "/settings";
        return;
      }

      const updated: UserProfile = {
        ...profile,
        agent_wallet: {
          ...profile.agent_wallet!,
          agent_private_key: keyToSync,
        }
      };
      saveStoredProfile(updated);
      await saveUserProfileToCloud(updated);
      setProfile({ ...updated });
      setVaultSyncDone(true);
      setTimeout(() => setVaultSyncDone(false), 4000);
    } catch (e) {
      console.error("Error sincronizando clave de bóveda:", e);
    } finally {
      setSyncingVault(false);
    }
  };

  // Cargar datos de billetera REAL (saldo, posiciones y fills on-chain)
  const fetchRealWallet = async (walletAddr: string) => {
    setRealWalletLoading(true);
    try {
      // 1. clearinghouseState (saldo, margen y posiciones abiertas en Perps)
      const resState = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: walletAddr }),
      });
      const dataState = await resState.json();

      // 1.1 spotClearinghouseState (solo el saldo libre de Spot, sin duplicar el margen en hold)
      let spotFreeUsdc = 0;
      try {
        const resSpot = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "spotClearinghouseState", user: walletAddr }),
        });
        if (resSpot.ok) {
          const dataSpot = await resSpot.json();
          const usdcBal = (dataSpot.balances || []).find((b: any) => b.coin === "USDC");
          if (usdcBal) {
            const total = parseFloat(usdcBal.total || "0");
            const hold = parseFloat(usdcBal.hold || "0");
            spotFreeUsdc = Math.max(0, total - hold);
          }
        }
      } catch {}

      let accountValue = spotFreeUsdc;
      let totalRawUsd = spotFreeUsdc;
      let totalUnrealizedPnl = 0;
      let openPositions: any[] = [];

      let totalMarginUsed = 0;
      if (dataState && dataState.marginSummary) {
        accountValue += parseFloat(dataState.marginSummary.accountValue || "0");
        totalRawUsd += parseFloat(dataState.marginSummary.totalRawUsd || "0");
        totalUnrealizedPnl = parseFloat(dataState.marginSummary.totalUnrealizedPnl || "0");
        totalMarginUsed = parseFloat(dataState.marginSummary.totalMarginUsed || "0");

        openPositions = (dataState.assetPositions || [])
          .filter((p: any) => p.position && Math.abs(parseFloat(p.position.szi || "0")) > 0)
          .map((p: any) => {
            const pos = p.position;
            const szi = parseFloat(pos.szi || "0");
            const posMargin = parseFloat(pos.marginUsed || "0");
            return {
              coin: pos.coin,
              side: szi > 0 ? ("LONG" as const) : ("SHORT" as const),
              size: Math.abs(szi),
              entryPx: parseFloat(pos.entryPx || "0"),
              markPx: parseFloat(pos.markPx || "0"),
              unrealizedPnl: parseFloat(pos.unrealizedPnl || "0"),
              leverage: parseFloat(pos.leverage?.value || "1"),
              marginUsed: posMargin,
            };
          });

        if (totalMarginUsed === 0 && openPositions.length > 0) {
          totalMarginUsed = openPositions.reduce((sum, p) => sum + (p.marginUsed || 0), 0);
        }

        setRealWalletData({ accountValue, totalRawUsd, totalUnrealizedPnl, totalMarginUsed, openPositions });
      }

      // 2. userFills (movimientos reales ejecutados on-chain)
      try {
        const resFills = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "userFills", user: walletAddr }),
        });
        const dataFills = await resFills.json();

        if (Array.isArray(dataFills)) {
          const formattedFills = dataFills.map((f: any) => {
            const closedPnl = parseFloat(f.closedPnl || "0");
            const px = parseFloat(f.px || "0");
            const sz = parseFloat(f.sz || "0");
            const fee = parseFloat(f.fee || "0");
            const isLong = (f.dir || "").toLowerCase().includes("long") || f.side === "B";

            return {
              id: f.hash || f.tid || f.time,
              coin: f.coin,
              side: isLong ? "LONG" : "SHORT",
              dir: f.dir || (f.side === "B" ? "Buy" : "Sell"),
              px,
              sz,
              usdValue: px * sz,
              closedPnl,
              fee,
              time: f.time,
              hash: f.hash,
              isProfit: closedPnl >= 0,
            };
          });

          setRealFills(formattedFills.slice(0, 50));

          // Estadísticas reales de la billetera
          const closedWithPnl = formattedFills.filter((f) => Math.abs(f.closedPnl) > 0.0001);
          const wins = closedWithPnl.filter((f) => f.closedPnl > 0).length;
          const losses = closedWithPnl.filter((f) => f.closedPnl < 0).length;
          const totalT = wins + losses;
          const winRate = totalT > 0 ? Math.round((wins / totalT) * 100) : 0;

          setRealStats({
            winRate,
            wins,
            losses,
            totalTrades: formattedFills.length,
          });

          // 3. Construir curva de capital REAL: Vista Detallada + Vista Día a Día
          if (formattedFills.length > 0) {
            const chronological = [...formattedFills].sort((a, b) => a.time - b.time);
            const totalFillsPnl = chronological.reduce((s, f) => s + f.closedPnl, 0);
            const baseBal = Math.max(0, accountValue - totalUnrealizedPnl - totalFillsPnl);
            
            // A. Historial Detallado (Operación a Operación)
            let runningPnl = 0;
            const detailedPoints = [
              {
                time: "Inicio",
                dateLabel: "Inicio",
                fullDate: "Saldo Inicial Calculado",
                dineroSeguro: parseFloat(baseBal.toFixed(2)),
                dineroAbierto: 0,
                ganandoPerdiendo: 0,
                dineroTotal: parseFloat(baseBal.toFixed(2)),
                realized: parseFloat(baseBal.toFixed(2)),
                equity: parseFloat(baseBal.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              }
            ];

            chronological.slice(-30).forEach((f) => {
              runningPnl += f.closedPnl;
              const dateStr = new Date(f.time).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              const histBal = Math.max(0, baseBal + runningPnl);
              detailedPoints.push({
                time: dateStr,
                dateLabel: dateStr,
                fullDate: new Date(f.time).toLocaleString("es-ES"),
                dineroSeguro: parseFloat(histBal.toFixed(2)),
                dineroAbierto: 0,
                ganandoPerdiendo: 0,
                dineroTotal: parseFloat(histBal.toFixed(2)),
                realized: parseFloat(histBal.toFixed(2)),
                equity: parseFloat(histBal.toFixed(2)),
                dailyChange: parseFloat(f.closedPnl.toFixed(2)),
                tradesCount: 1,
              });
            });

            // Punto Final (AHORA): Exactamente igual al saldo actual on-chain de las tarjetas KPI
            const curRealSeguro = totalRawUsd || Math.max(0, accountValue - totalMarginUsed);
            detailedPoints.push({
              time: "Ahora",
              dateLabel: "Ahora",
              fullDate: "Momento Actual",
              dineroSeguro: parseFloat(curRealSeguro.toFixed(2)),
              dineroAbierto: parseFloat(totalMarginUsed.toFixed(2)),
              ganandoPerdiendo: parseFloat(totalUnrealizedPnl.toFixed(2)),
              dineroTotal: parseFloat(accountValue.toFixed(2)),
              realized: parseFloat(curRealSeguro.toFixed(2)),
              equity: parseFloat(accountValue.toFixed(2)),
              dailyChange: 0,
              tradesCount: 0,
            });
            setRealEquityHistory(detailedPoints);

            // B. Historial Agrupado Día por Día (DAILY)
            const realDailyMap: Record<string, {
              dateStr: string;
              timestamp: number;
              pnl: number;
              count: number;
            }> = {};

            for (const f of chronological) {
              const d = new Date(f.time);
              const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const dayLabel = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
              if (!realDailyMap[dayKey]) {
                realDailyMap[dayKey] = {
                  dateStr: dayLabel,
                  timestamp: f.time,
                  pnl: 0,
                  count: 0,
                };
              }
              realDailyMap[dayKey].pnl += f.closedPnl;
              realDailyMap[dayKey].count += 1;
            }

            const realSortedDays = Object.keys(realDailyMap).sort();
            const dailyPoints: any[] = [];
            let runBal = baseBal;

            if (realSortedDays.length > 0) {
              const firstD = new Date(realSortedDays[0]);
              firstD.setDate(firstD.getDate() - 1);
              const prevLabel = firstD.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
              dailyPoints.push({
                time: prevLabel,
                dateLabel: prevLabel,
                fullDate: `Inicio (${prevLabel})`,
                dineroSeguro: parseFloat(runBal.toFixed(2)),
                dineroAbierto: 0,
                ganandoPerdiendo: 0,
                dineroTotal: parseFloat(runBal.toFixed(2)),
                realized: parseFloat(runBal.toFixed(2)),
                equity: parseFloat(runBal.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              });

              for (let i = 0; i < realSortedDays.length; i++) {
                const dayKey = realSortedDays[i];
                const dData = realDailyMap[dayKey];
                runBal += dData.pnl;
                const isToday = i === realSortedDays.length - 1;

                const curMargin = isToday ? totalMarginUsed : 0;
                const curFloating = isToday ? totalUnrealizedPnl : 0;
                const seguro = isToday ? (totalRawUsd || Math.max(0, accountValue - curMargin)) : Math.max(0, runBal);
                const total = isToday ? accountValue : runBal;

                dailyPoints.push({
                  time: dData.dateStr,
                  dateLabel: dData.dateStr,
                  fullDate: new Date(dData.timestamp).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  }),
                  dineroSeguro: parseFloat(seguro.toFixed(2)),
                  dineroAbierto: parseFloat(curMargin.toFixed(2)),
                  ganandoPerdiendo: parseFloat(curFloating.toFixed(2)),
                  dineroTotal: parseFloat(total.toFixed(2)),
                  realized: parseFloat(seguro.toFixed(2)),
                  equity: parseFloat(total.toFixed(2)),
                  dailyChange: parseFloat(dData.pnl.toFixed(2)),
                  tradesCount: dData.count,
                });
              }
            } else {
              const todayLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
              dailyPoints.push({
                time: "Inicio",
                dateLabel: "Inicio",
                fullDate: "Inicio de Cuenta",
                dineroSeguro: parseFloat((totalRawUsd || accountValue).toFixed(2)),
                dineroAbierto: 0,
                ganandoPerdiendo: 0,
                dineroTotal: parseFloat(accountValue.toFixed(2)),
                realized: parseFloat((totalRawUsd || accountValue).toFixed(2)),
                equity: parseFloat(accountValue.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              });
              dailyPoints.push({
                time: todayLabel,
                dateLabel: todayLabel,
                fullDate: "Hoy",
                dineroSeguro: parseFloat((totalRawUsd || Math.max(0, accountValue - totalMarginUsed)).toFixed(2)),
                dineroAbierto: parseFloat(totalMarginUsed.toFixed(2)),
                ganandoPerdiendo: parseFloat(totalUnrealizedPnl.toFixed(2)),
                dineroTotal: parseFloat(accountValue.toFixed(2)),
                realized: parseFloat((totalRawUsd || Math.max(0, accountValue - totalMarginUsed)).toFixed(2)),
                equity: parseFloat(accountValue.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              });
            }

            setRealDailyHistory(dailyPoints);
          } else if (accountValue > 0) {
            const todayLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
            const single = [
              {
                time: "Inicio",
                dateLabel: "Inicio",
                fullDate: "Depósito Inicial",
                dineroSeguro: parseFloat((totalRawUsd || accountValue).toFixed(2)),
                dineroAbierto: 0,
                ganandoPerdiendo: 0,
                dineroTotal: parseFloat(accountValue.toFixed(2)),
                realized: parseFloat((totalRawUsd || accountValue).toFixed(2)),
                equity: parseFloat(accountValue.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              },
              {
                time: todayLabel,
                dateLabel: todayLabel,
                fullDate: "Hoy",
                dineroSeguro: parseFloat((totalRawUsd || Math.max(0, accountValue - totalMarginUsed)).toFixed(2)),
                dineroAbierto: parseFloat(totalMarginUsed.toFixed(2)),
                ganandoPerdiendo: parseFloat(totalUnrealizedPnl.toFixed(2)),
                dineroTotal: parseFloat(accountValue.toFixed(2)),
                realized: parseFloat((totalRawUsd || Math.max(0, accountValue - totalMarginUsed)).toFixed(2)),
                equity: parseFloat(accountValue.toFixed(2)),
                dailyChange: 0,
                tradesCount: 0,
              },
            ];
            setRealEquityHistory(single);
            setRealDailyHistory(single);
          }
        }
      } catch (errFills) {
        console.warn("No se pudieron cargar los fills reales:", errFills);
      }
    } catch (e) {
      console.error("Error al leer billetera real:", e);
    } finally {
      setRealWalletLoading(false);
    }
  };



  // Cargar estadísticas y movimientos en tiempo real desde Hyperliquid (OPTIMIZADO EN PARALELO)
  const fetchLiveStats = async () => {
    if (!profile) return;
    setTradesLoading(true);

    try {
      // 1. Obtener todos los movimientos calculados en paralelo
      const fullTrades = await fetchFullTradeHistory(profile);
      setRecentTrades(fullTrades.slice(0, 25));

      const closedTrades = fullTrades.filter((t) => t.status === "CLOSED");
      const openTrades = fullTrades.filter((t) => t.status === "OPEN");
      const pendingTrades = fullTrades.filter((t) => t.status === "PENDING_APPROVAL");

      let globalPnl = 0;
      let globalWins = 0;
      let globalLosses = 0;
      let totalFloatingPnl = 0;
      let totalMarginUsed = 0;
      const perTrader: Record<string, any> = {};

      // 2. Procesar cerradas
      closedTrades.forEach((t) => {
        globalPnl += t.pnl;
        if (t.pnl > 0) globalWins++;
        else if (t.pnl < 0) globalLosses++;
      });

      // 3. Procesar abiertas (solo las activas/aprobadas consumen margen y PnL flotante)
      openTrades.forEach((t) => {
        totalFloatingPnl += t.pnl;
        const myMargin = t.leverage > 0 ? t.usdValue / t.leverage : t.usdValue;
        totalMarginUsed += myMargin;
      });

      // 4. Desglose enriquecido por cada trader en la cesta (soporta tanto Simulado como Real)
      const currentBasket = profile.trading_mode === "REAL" && profile.real_traders && profile.real_traders.length > 0
        ? profile.real_traders
        : (profile.traders || []);

      const capitalBase = profile.trading_mode === "REAL"
        ? (realWalletData?.marginSummary?.accountValue || profile.initial_balance || 1000)
        : (profile.cash_balance || 10000);

      for (const tr of currentBasket) {
        const addr = tr.address.toLowerCase();
        const tClosed = closedTrades.filter((c) => c.traderAddr.toLowerCase() === addr);
        const tOpen = openTrades.filter((o) => o.traderAddr.toLowerCase() === addr);
        const tWins = tClosed.filter((c) => c.pnl > 0).length;
        const tLosses = tClosed.filter((c) => c.pnl < 0).length;
        const tPnl = tClosed.reduce((sum, c) => sum + c.pnl, 0);
        const totalT = tWins + tLosses;
        const totalCopiedTrades = tClosed.length + tOpen.length;

        const grossProfit = tClosed.filter((c) => c.pnl > 0).reduce((sum, c) => sum + c.pnl, 0);
        const grossLoss = Math.abs(tClosed.filter((c) => c.pnl < 0).reduce((sum, c) => sum + c.pnl, 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
        const traderFloatingPnl = tOpen.reduce((sum, o) => sum + o.pnl, 0);
        const traderMarginUsed = tOpen.reduce((sum, o) => sum + (o.leverage > 0 ? o.usdValue / o.leverage : o.usdValue), 0);
        const bestTrade = tClosed.length > 0 ? Math.max(...tClosed.map((c) => c.pnl)) : 0;
        const worstTrade = tClosed.length > 0 ? Math.min(...tClosed.map((c) => c.pnl)) : 0;
        const bestTradePct = tClosed.length > 0 ? Math.max(...tClosed.map((c) => c.pnlPct || 0)) : 0;
        const worstTradePct = tClosed.length > 0 ? Math.min(...tClosed.map((c) => c.pnlPct || 0)) : 0;

        // Expectativa matemática: Ganancia media por trade ($ y %)
        const avgTradePnl = tClosed.length > 0 ? (tPnl / tClosed.length) : 0;
        const avgTradeRoiPct = tClosed.length > 0 ? (tClosed.reduce((sum, c) => sum + (c.pnlPct || 0), 0) / tClosed.length) : 0;

        // Ganancia media en victorias vs Pérdida media en fallos
        const avgWin = tWins > 0 ? (grossProfit / tWins) : 0;
        const avgLoss = tLosses > 0 ? (grossLoss / tLosses) : 0;
        const payoffRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? "∞" : "0.00";

        // Racha consecutiva actual
        const sortedClosed = [...tClosed].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        let streakCount = 0;
        let streakType: "WIN" | "LOSS" | "NONE" = "NONE";
        if (sortedClosed.length > 0) {
          streakType = sortedClosed[0].pnl >= 0 ? "WIN" : "LOSS";
          for (const sc of sortedClosed) {
            if ((streakType === "WIN" && sc.pnl >= 0) || (streakType === "LOSS" && sc.pnl < 0)) {
              streakCount++;
            } else {
              break;
            }
          }
        }

        // Frecuencia diaria de trades
        const allTimestamps = [...tClosed.map((c) => c.timestamp || 0), ...tOpen.map((o) => (o.openTimestamp || o.timestamp || 0))].filter((ts) => ts > 0);
        const firstTradeTs = allTimestamps.length > 0 ? Math.min(...allTimestamps) : (tr.joined_at || Date.now());
        const daysTracking = Math.max(1, (Date.now() - firstTradeTs) / (24 * 3600 * 1000));
        const tradesPerDay = ((tClosed.length + tOpen.length) / daysTracking).toFixed(1);
        const avgHoursPerTrade = (tClosed.length + tOpen.length) > 0 ? (daysTracking * 24 / (tClosed.length + tOpen.length)).toFixed(1) : "0.0";

        // Volumen total gestionado
        const totalVolumeUSD = tClosed.reduce((sum, c) => sum + (c.usdValue || 0), 0) + tOpen.reduce((sum, o) => sum + (o.usdValue || 0), 0);

        // Distribución de monedas operadas
        const coinCount: Record<string, number> = {};
        tClosed.forEach((c) => {
          const coin = (c.coin || "OTRO").toUpperCase();
          coinCount[coin] = (coinCount[coin] || 0) + 1;
        });
        const totalCoinOps = tClosed.length || 1;
        const coinBreakdown = Object.entries(coinCount)
          .map(([coin, count]) => ({
            coin,
            pct: Math.round((count / totalCoinOps) * 100),
            count,
          }))
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 4);

        // Métricas de la última semana (7 días)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weeklyClosed = tClosed.filter((c) => c.timestamp >= sevenDaysAgo);
        const weeklyOpen = tOpen.filter((o) => (o.openTimestamp || o.timestamp || Date.now()) >= sevenDaysAgo);
        const weeklyTradesCount = weeklyClosed.length + weeklyOpen.length;
        const weeklyWins = weeklyClosed.filter((c) => c.pnl > 0).length;
        const weeklyLosses = weeklyClosed.filter((c) => c.pnl < 0).length;
        const weeklyPnl = weeklyClosed.reduce((sum, c) => sum + c.pnl, 0);
        const weeklyWinRate = weeklyTradesCount > 0 ? ((weeklyWins / weeklyTradesCount) * 100).toFixed(1) : "0.0";

        const assignedUSD = capitalBase * (tr.allocation_pct / 100);
        const freeAssignedMargin = Math.max(0, assignedUSD - traderMarginUsed);
        const marginUtilizationPct = assignedUSD > 0 ? Math.min(100, (traderMarginUsed / assignedUSD) * 100) : 0;
        const realizedRoiPct = assignedUSD > 0 ? ((tPnl / assignedUSD) * 100) : 0;
        const totalRoiPct = assignedUSD > 0 ? (((tPnl + traderFloatingPnl) / assignedUSD) * 100) : 0;

        perTrader[addr] = {
          totalPnl: tPnl,
          realizedPnl: tPnl,
          floatingPnl: traderFloatingPnl,
          totalCombinedPnl: tPnl + traderFloatingPnl,
          marginUsed: traderMarginUsed,
          freeAssignedMargin,
          marginUtilizationPct,
          assignedUSD,
          realizedRoiPctStr: tPnl >= 0 ? `+${realizedRoiPct.toFixed(2)}%` : `${realizedRoiPct.toFixed(2)}%`,
          totalRoiPctStr: (tPnl + traderFloatingPnl) >= 0 ? `+${totalRoiPct.toFixed(2)}%` : `${totalRoiPct.toFixed(2)}%`,
          wins: tWins,
          losses: tLosses,
          totalTrades: totalT,
          totalCopiedTrades,
          winRate: totalT > 0 ? ((tWins / totalT) * 100).toFixed(1) : "0.0",
          consecutiveStreakCount: streakCount,
          consecutiveStreakType: streakType,
          tradesPerDay,
          avgHoursPerTrade,
          avgTradePnl,
          avgTradeRoiPct,
          avgWin,
          avgLoss,
          payoffRatio,
          grossProfit,
          grossLoss,
          profitFactor,
          bestTrade,
          worstTrade,
          bestTradePct,
          worstTradePct,
          totalVolumeUSD,
          weeklyTradesCount,
          weeklyWins,
          weeklyLosses,
          weeklyPnl,
          weeklyWinRate,
          coinBreakdown,
          openPositions: tOpen.map((o) => ({
            id: o.id,
            coin: o.coin,
            side: o.side,
            leverage: o.leverage,
            entryPx: o.entryPx,
            size: o.size,
            usdValue: o.usdValue,
            pnl: o.pnl,
            pnlPct: o.pnlPct,
            durationStr: o.durationStr,
            marginUSD: o.leverage > 0 ? o.usdValue / o.leverage : o.usdValue,
          })),
          leaderAudit: getLeaderAudit(addr) || null,
        };
      }

      setLiveStats(perTrader);
      setLiveGlobalPnl(globalPnl);
      setLiveGlobalFloatingPnl(totalFloatingPnl);
      setLiveGlobalWins(globalWins);
      setLiveGlobalLosses(globalLosses);
      setLiveTotalMarginUsed(totalMarginUsed);

      // 5. Reconstruir curva de capital: Vista Detallada + Vista Día a Día (DAILY)
      const sortedClosed = [...closedTrades].sort((a, b) => a.timestamp - b.timestamp);
      
      // A. Historial Detallado (Operación a Operación)
      let runningBal = profile.initial_balance || 10000.0;
      const detailedSimHistory = [{
        time: "Inicio",
        dateLabel: "Inicio",
        fullDate: "Balance Inicial",
        dineroSeguro: runningBal,
        dineroAbierto: 0,
        ganandoPerdiendo: 0,
        dineroTotal: runningBal,
        realized: runningBal,
        equity: runningBal,
        dailyChange: 0,
        tradesCount: 0,
      }];

      for (const t of sortedClosed) {
        runningBal += t.pnl;
        detailedSimHistory.push({
          time: t.timeStr,
          dateLabel: t.timeStr,
          fullDate: new Date(t.timestamp).toLocaleString("es-ES"),
          dineroSeguro: parseFloat(runningBal.toFixed(2)),
          dineroAbierto: 0,
          ganandoPerdiendo: 0,
          dineroTotal: parseFloat(runningBal.toFixed(2)),
          realized: parseFloat(runningBal.toFixed(2)),
          equity: parseFloat(runningBal.toFixed(2)),
          dailyChange: parseFloat(t.pnl.toFixed(2)),
          tradesCount: 1,
        });
      }

      detailedSimHistory.push({
        time: "Actual",
        dateLabel: "Actual",
        fullDate: "Momento Actual",
        dineroSeguro: parseFloat(Math.max(0, runningBal - totalMarginUsed).toFixed(2)),
        dineroAbierto: parseFloat(totalMarginUsed.toFixed(2)),
        ganandoPerdiendo: parseFloat(totalFloatingPnl.toFixed(2)),
        dineroTotal: parseFloat((runningBal + totalFloatingPnl).toFixed(2)),
        realized: parseFloat(Math.max(0, runningBal - totalMarginUsed).toFixed(2)),
        equity: parseFloat((runningBal + totalFloatingPnl).toFixed(2)),
        dailyChange: 0,
        tradesCount: 0,
      });

      setLiveEquityHistory(detailedSimHistory);

      // B. Historial Agrupado Día por Día (DAILY)
      const simDailyMap: Record<string, {
        dateStr: string;
        timestamp: number;
        pnl: number;
        count: number;
      }> = {};

      for (const t of sortedClosed) {
        const d = new Date(t.timestamp);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        if (!simDailyMap[dayKey]) {
          simDailyMap[dayKey] = {
            dateStr: dayLabel,
            timestamp: t.timestamp,
            pnl: 0,
            count: 0,
          };
        }
        simDailyMap[dayKey].pnl += t.pnl;
        simDailyMap[dayKey].count += 1;
      }

      const simSortedDays = Object.keys(simDailyMap).sort();
      let cumSimBalance = profile.initial_balance || 10000.0;
      const simDailyPoints: any[] = [];

      if (simSortedDays.length > 0) {
        const firstD = new Date(simSortedDays[0]);
        firstD.setDate(firstD.getDate() - 1);
        const prevLabel = firstD.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        simDailyPoints.push({
          time: prevLabel,
          dateLabel: prevLabel,
          fullDate: `Inicio (${prevLabel})`,
          dineroSeguro: cumSimBalance,
          dineroAbierto: 0,
          ganandoPerdiendo: 0,
          dineroTotal: cumSimBalance,
          realized: cumSimBalance,
          equity: cumSimBalance,
          dailyChange: 0,
          tradesCount: 0,
        });

        for (let i = 0; i < simSortedDays.length; i++) {
          const dayKey = simSortedDays[i];
          const dData = simDailyMap[dayKey];
          cumSimBalance += dData.pnl;
          const isToday = i === simSortedDays.length - 1;

          const curMargin = isToday ? totalMarginUsed : 0;
          const curFloating = isToday ? totalFloatingPnl : 0;
          const seguro = isToday ? Math.max(0, cumSimBalance - curMargin) : cumSimBalance;
          const total = isToday ? (cumSimBalance + curFloating) : cumSimBalance;

          simDailyPoints.push({
            time: dData.dateStr,
            dateLabel: dData.dateStr,
            fullDate: new Date(dData.timestamp).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }),
            dineroSeguro: parseFloat(seguro.toFixed(2)),
            dineroAbierto: parseFloat(curMargin.toFixed(2)),
            ganandoPerdiendo: parseFloat(curFloating.toFixed(2)),
            dineroTotal: parseFloat(total.toFixed(2)),
            realized: parseFloat(seguro.toFixed(2)),
            equity: parseFloat(total.toFixed(2)),
            dailyChange: parseFloat(dData.pnl.toFixed(2)),
            tradesCount: dData.count,
          });
        }
      } else {
        const todayLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        simDailyPoints.push({
          time: "Inicio",
          dateLabel: "Inicio",
          fullDate: "Balance Inicial",
          dineroSeguro: cumSimBalance,
          dineroAbierto: 0,
          ganandoPerdiendo: 0,
          dineroTotal: cumSimBalance,
          realized: cumSimBalance,
          equity: cumSimBalance,
          dailyChange: 0,
          tradesCount: 0,
        });
        const seguro = Math.max(0, cumSimBalance - totalMarginUsed);
        const total = cumSimBalance + totalFloatingPnl;
        simDailyPoints.push({
          time: todayLabel,
          dateLabel: todayLabel,
          fullDate: "Hoy",
          dineroSeguro: parseFloat(seguro.toFixed(2)),
          dineroAbierto: parseFloat(totalMarginUsed.toFixed(2)),
          ganandoPerdiendo: parseFloat(totalFloatingPnl.toFixed(2)),
          dineroTotal: parseFloat(total.toFixed(2)),
          realized: parseFloat(seguro.toFixed(2)),
          equity: parseFloat(total.toFixed(2)),
          dailyChange: 0,
          tradesCount: 0,
        });
      }

      setSimulatedDailyHistory(simDailyPoints);

      // 6. Si hay órdenes pendientes y el usuario tiene Telegram conectado, notificar para validación
      if (
        profile.global_risk?.execution_mode === "TELEGRAM_APPROVAL" &&
        profile.telegram_chat_id &&
        pendingTrades.length > 0
      ) {
        let notifiedIds: string[] = [];
        try {
          notifiedIds = JSON.parse(
            localStorage.getItem("hyperliquid_notified_trades_v1") || "[]"
          );
        } catch {}

        for (const pt of pendingTrades) {
          if (!notifiedIds.includes(pt.id)) {
            fetch("/api/telegram/notify-trade-approval", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chatId: profile.telegram_chat_id,
                trade: pt,
              }),
            }).catch((e) => console.error("Error notificando aprobación por Telegram:", e));

            notifiedIds.push(pt.id);
          }
        }

        try {
          localStorage.setItem(
            "hyperliquid_notified_trades_v1",
            JSON.stringify(notifiedIds.slice(-50))
          );
        } catch {}
      }
    } catch (e) {
      console.error("Error al cargar datos en tiempo real:", e);
    } finally {
      setTradesLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
  }, [profile]);

  // Cuando el perfil tiene wallet_address real, cargar datos reales
  useEffect(() => {
    if (profile?.wallet_address) {
      fetchRealWallet(profile.wallet_address);
    }
  }, [profile?.wallet_address]);

  const handleSaveAlias = (address: string, newAlias: string) => {
    if (!profile) return;
    const isRealMode = profile.trading_mode === "REAL";
    const targetTraders = isRealMode ? (profile.real_traders || []) : (profile.traders || []);
    const updated = targetTraders.map((t) => {
      if (t.address.toLowerCase() === address.toLowerCase()) {
        return { ...t, alias: newAlias ? newAlias.trim() : undefined };
      }
      return t;
    });
    const newProfile = updateTradersConfig(updated, isRealMode ? "REAL" : "DEMO");
    setProfile({ ...newProfile });
    if (newProfile.telegram_chat_id) {
      fetch("/api/telegram/sync-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: newProfile.telegram_chat_id, profile: newProfile }),
      }).catch(() => {});
    }
  };

  const handleSwitchMode = (mode: "DEMO" | "REAL") => {
    const updated = updateTradingMode(mode);
    setProfile({ ...updated });
    if (updated.email) {
      saveUserProfileToCloud(updated).catch(() => {});
    }
    if (mode === "REAL" && updated.wallet_address) {
      fetchRealWallet(updated.wallet_address);
    }
  };

  // Filtrado de movimientos recientes en el dashboard simulado
  const pendingTrades = useMemo(() => {
    return recentTrades.filter((tr) => tr.status === "PENDING_APPROVAL");
  }, [recentTrades]);

  const displayedTrades = useMemo(() => {
    if (tradeFilterTab === "LATEST_OPEN") {
      const openOne = recentTrades.find((tr) => tr.status === "OPEN");
      return openOne ? [openOne] : [];
    }
    return recentTrades.filter((tr) => {
      if (tradeFilterTab === "PENDING") return tr.status === "PENDING_APPROVAL";
      if (tradeFilterTab === "OPEN") return tr.status === "OPEN";
      if (tradeFilterTab === "CLOSED") return tr.status === "CLOSED";
      return true;
    });
  }, [recentTrades, tradeFilterTab]);

  // Filtrado de ejecuciones on-chain reales (fills)
  const displayedRealFills = useMemo(() => {
    return realFills.filter((f) => {
      if (realFillFilter === "CLOSED_PNL") return Math.abs(f.closedPnl) > 0.0001;
      if (realFillFilter === "BUY") return (f.dir || "").toLowerCase().includes("buy") || f.side === "LONG";
      if (realFillFilter === "SELL") return (f.dir || "").toLowerCase().includes("sell") || f.side === "SHORT";
      return true;
    });
  }, [realFills, realFillFilter]);

  if (!mounted || !profile) return null;

  const isReal = profile.trading_mode === "REAL";
  const totalTradesCount = liveGlobalWins + liveGlobalLosses;
  const winRate = totalTradesCount > 0
    ? ((liveGlobalWins / totalTradesCount) * 100).toFixed(1)
    : "100.0";

  const totalRealizedEquity = profile.initial_balance + liveGlobalPnl;
  const totalFloatingEquity = totalRealizedEquity + liveGlobalFloatingPnl;
  const freeLiquidityUSD = Math.max(0, totalRealizedEquity - liveTotalMarginUsed);

  // Estadísticas combinadas de los traders copiados (soporta Simulado y Real)
  const currentBasket = isReal ? (profile.real_traders || []) : (profile.traders || []);
  const basketCapitalBase = isReal
    ? (realWalletData?.marginSummary?.accountValue || profile.initial_balance || 1000)
    : (profile.cash_balance || 10000);

  const copiedTradersStats = currentBasket.map((t) => {
    const live = liveStats[t.address.toLowerCase()] || {
      totalPnl: 0,
      realizedPnl: 0,
      floatingPnl: 0,
      totalCombinedPnl: 0,
      marginUsed: 0,
      freeAssignedMargin: 0,
      marginUtilizationPct: 0,
      wins: 0,
      losses: 0,
      totalTrades: 0,
      totalCopiedTrades: 0,
      winRate: "0.0",
      consecutiveStreakCount: 0,
      consecutiveStreakType: "NONE",
      tradesPerDay: "0.0",
      avgHoursPerTrade: "0.0",
      avgTradePnl: 0,
      avgTradeRoiPct: 0,
      avgWin: 0,
      avgLoss: 0,
      payoffRatio: "0.00",
      weeklyTradesCount: 0,
      weeklyWins: 0,
      weeklyLosses: 0,
      weeklyPnl: 0,
      weeklyWinRate: "0.0",
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: "0.00",
      bestTrade: 0,
      worstTrade: 0,
      bestTradePct: 0,
      worstTradePct: 0,
      totalVolumeUSD: 0,
      coinBreakdown: [],
      openPositions: [],
    };
    const assignedUSD = basketCapitalBase * (t.allocation_pct / 100);
    const realizedRoiPct = assignedUSD > 0 ? ((live.realizedPnl / assignedUSD) * 100) : 0;
    const totalRoiPct = assignedUSD > 0 ? ((live.totalCombinedPnl / assignedUSD) * 100) : 0;
    const marginUtilizationPct = assignedUSD > 0 ? Math.min(100, (live.marginUsed / assignedUSD) * 100) : 0;
    const freeAssignedMargin = Math.max(0, assignedUSD - live.marginUsed);
    const leaderAudit = live.leaderAudit || getLeaderAudit(t.address) || null;

    return {
      ...t,
      ...live,
      leaderAudit,
      assignedUSD,
      freeAssignedMargin,
      marginUtilizationPct,
      realizedRoiPctStr: live.realizedPnl >= 0 ? `+${realizedRoiPct.toFixed(2)}%` : `${realizedRoiPct.toFixed(2)}%`,
      totalRoiPctStr: live.totalCombinedPnl >= 0 ? `+${totalRoiPct.toFixed(2)}%` : `${totalRoiPct.toFixed(2)}%`,
    };
  });

  // 4 PILARES FINANCIEROS Y MÉTRICAS CUANTITATIVAS DE RENDIMIENTO
  const dineroAseguradoSim = Math.max(0, totalRealizedEquity - liveTotalMarginUsed);
  const dineroAbiertoSim = liveTotalMarginUsed;
  const ganandoPerdiendoSim = liveGlobalFloatingPnl;
  const dineroTotalSim = totalRealizedEquity + liveGlobalFloatingPnl;

  const curRealAsegurado = realWalletData
    ? (realWalletData.totalRawUsd || Math.max(0, realWalletData.accountValue - realWalletData.totalMarginUsed))
    : 0;
  const dineroAseguradoReal = curRealAsegurado;
  const dineroAbiertoReal = realWalletData?.totalMarginUsed || 0;
  const ganandoPerdiendoReal = realWalletData?.totalUnrealizedPnl || 0;
  const dineroTotalReal = realWalletData?.accountValue || 0;

  const curAsegurado = isReal ? dineroAseguradoReal : dineroAseguradoSim;
  const curAbierto = isReal ? dineroAbiertoReal : dineroAbiertoSim;
  const curGanandoPerdiendo = isReal ? ganandoPerdiendoReal : ganandoPerdiendoSim;
  const curTotal = isReal ? dineroTotalReal : dineroTotalSim;

  // Estadísticas cuantitativas de rendimiento (para la sección de estadísticas)
  const capitalBase = isReal
    ? (realWalletData ? Math.max(1, realWalletData.accountValue - (realStats.totalTrades > 0 ? (realFills.reduce((s, f) => s + f.closedPnl, 0) + (realWalletData.totalUnrealizedPnl || 0)) : 0)) : 98.88)
    : (profile.initial_balance || 10000.0);

  const realClosedPnl = realFills.reduce((s, f) => s + f.closedPnl, 0);
  const totalAbsoluteGain = isReal
    ? (realClosedPnl + (realWalletData?.totalUnrealizedPnl || 0))
    : (liveGlobalPnl + liveGlobalFloatingPnl);

  const globalTotalRoiPct = capitalBase > 0 ? ((totalAbsoluteGain / capitalBase) * 100) : 0;

  const closedCount = isReal ? realStats.totalTrades : totalTradesCount;
  const avgPnlPerTradeUSD = closedCount > 0 ? ((isReal ? realClosedPnl : liveGlobalPnl) / closedCount) : 0;
  const avgRoiPerTradePct = capitalBase > 0 && closedCount > 0
    ? (avgPnlPerTradeUSD / (capitalBase * 0.1)) * 100
    : 0;

  const daysRecordedCount = isReal ? Math.max(1, realDailyHistory.length) : Math.max(1, simulatedDailyHistory.length);
  const avgDailyPnlUSD = totalAbsoluteGain / daysRecordedCount;
  const avgDailyRoiPct = capitalBase > 0 ? ((avgDailyPnlUSD / capitalBase) * 100) : 0;

  const bestTradePnl = isReal
    ? (realFills.length > 0 ? Math.max(...realFills.map((f) => f.closedPnl || 0)) : 0)
    : (recentTrades.filter((t) => t.status === "CLOSED").length > 0
        ? Math.max(...recentTrades.filter((t) => t.status === "CLOSED").map((t) => t.pnl || 0))
        : 0);

  const worstTradePnl = isReal
    ? (realFills.length > 0 ? Math.min(...realFills.map((f) => f.closedPnl || 0)) : 0)
    : (recentTrades.filter((t) => t.status === "CLOSED").length > 0
        ? Math.min(...recentTrades.filter((t) => t.status === "CLOSED").map((t) => t.pnl || 0))
        : 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fadeIn pb-16">
      {/* Modales de Información y Onboarding */}
      <MetricsInfoModal isOpen={infoModalOpen} onClose={() => setInfoModalOpen(false)} />
      <GuidedTour isOpen={tourOpen} onClose={() => setTourOpen(false)} />

      {/* Header with Master Mode Switch Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Dashboard de Inversión</h1>
            {/* Selector Maestro: Modo Simulado vs Modo Real */}
            <div className="inline-flex max-w-full overflow-x-auto p-1 rounded-2xl bg-surface border border-surface-border">
              <button
                type="button"
                onClick={() => handleSwitchMode("DEMO")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  !isReal
                    ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/25"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${!isReal ? "bg-black" : "bg-emerald-400"}`} />
                <span>🟢 Modo Simulado ($10k)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode("REAL")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  isReal
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isReal ? "bg-white" : "bg-blue-400"}`} />
                <span>🔵 Modo Real (Mainnet)</span>
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-1.5">
            {isReal
              ? "🔵 Datos 100% reales de tu billetera Hyperliquid • Saldo on-chain, posiciones vivas y ejecuciones en tiempo real."
              : "🟢 Monitoreo de tu cartera virtual ($10,000 USD iniciales), estado del capital y registro continuo de movimientos simulados."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTourOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/40 text-xs font-bold hover:bg-primary/30 transition-all flex items-center gap-1.5 shadow-sm shadow-primary/10"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Guía Onboarding</span>
          </button>

          <button
            onClick={() => setInfoModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>¿Qué significan?</span>
          </button>

          {!isReal ? (
            <>
              <button
                onClick={() => {
                  if (confirm("¿Quieres reiniciar tu cartera a los $10,000 USD iniciales y limpiar el historial simulado?")) {
                    const fresh = resetProfile();
                    setProfile({ ...fresh });
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-gray-800 border border-surface-border text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
                title="Reiniciar saldo a $10,000 USD"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-400" /> Reiniciar ($10,000)
              </button>

              <Link
                href="/traders"
                className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-gray-800 border border-surface-border text-xs text-gray-300 flex items-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-primary" /> Gestionar Cesta
              </Link>
            </>
          ) : (
            <>
              {profile.wallet_address && (
                <button
                  onClick={() => profile.wallet_address && fetchRealWallet(profile.wallet_address)}
                  disabled={realWalletLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Actualizar datos on-chain de Hyperliquid"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${realWalletLoading ? "animate-spin" : ""}`} />
                  <span>Actualizar Billetera</span>
                </button>
              )}

              <a
                href="https://app.hyperliquid.xyz/portfolio"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-xs text-gray-300 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                <span>Ver en Hyperliquid</span>
              </a>

              <Link
                href="/traders"
                className="px-3.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs text-blue-300 font-bold flex items-center gap-1.5 transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-400" /> Gestionar Cesta Real
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 1. Metric Cards Grid: Los 4 Pilares Financieros Clave (Mobile-First) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* CARD 1: 🛡️ Dinero Asegurado */}
        <div className={`p-5 sm:p-6 rounded-2xl border relative overflow-hidden transition-all ${
          isReal
            ? "bg-blue-950/15 border-blue-500/30 shadow-lg shadow-blue-500/5"
            : "bg-surface border-surface-border"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>🛡️ Dinero Asegurado</span>
            </span>
            <div className={`p-2 rounded-xl ${isReal ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-3 sm:mt-4 font-mono">
            ${curAsegurado.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {isReal ? (
              <>USDC libre sin riesgo: <strong className="text-blue-400 font-mono">${(realWalletData?.totalRawUsd || curAsegurado).toFixed(2)}</strong></>
            ) : (
              <>Capital libre consolidado: <strong className="text-emerald-400 font-mono">${curAsegurado.toFixed(2)}</strong></>
            )}
          </div>
        </div>

        {/* CARD 2: ⚡ Dinero Abierto */}
        <div className={`p-5 sm:p-6 rounded-2xl border relative overflow-hidden transition-all ${
          isReal
            ? "bg-blue-950/15 border-blue-500/30"
            : "bg-surface border-surface-border"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>⚡ Dinero Abierto</span>
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 mt-3 sm:mt-4 font-mono">
            ${curAbierto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {isReal ? (
              <>Margen en juego: <strong className="text-white font-mono">{realWalletData?.openPositions?.length || 0} vivas on-chain</strong></>
            ) : (
              <>Margen en mercado: <strong className="text-white font-mono">${curAbierto.toFixed(2)}</strong></>
            )}
          </div>
        </div>

        {/* CARD 3: 📊 Ganando / Perdiendo */}
        <div className={`p-5 sm:p-6 rounded-2xl border relative overflow-hidden transition-all ${
          isReal ? "bg-blue-950/15 border-blue-500/30" : "bg-surface border-surface-border"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊 Ganando / Perdiendo</span>
            </span>
            <div className={`p-2 rounded-xl ${curGanandoPerdiendo >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold mt-3 sm:mt-4 font-mono ${curGanandoPerdiendo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {curGanandoPerdiendo >= 0 ? "+" : ""}${curGanandoPerdiendo.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            {isReal ? (
              <>PnL flotante en tiempo real: <strong className={curGanandoPerdiendo >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                {curGanandoPerdiendo >= 0 ? "+" : ""}${curGanandoPerdiendo.toFixed(2)}
              </strong></>
            ) : (
              <>Resultado flotante en vivo: <strong className={curGanandoPerdiendo >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                {curGanandoPerdiendo >= 0 ? "+" : ""}${curGanandoPerdiendo.toFixed(2)}
              </strong></>
            )}
          </div>
        </div>

        {/* CARD 4: 💰 Dinero Total (Todo Incluido) */}
        <div className={`p-5 sm:p-6 rounded-2xl border relative overflow-hidden transition-all ${
          isReal ? "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-500/10" : "bg-amber-950/15 border-amber-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>💰 Dinero Total (Todo Incluido)</span>
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-3 sm:mt-4 font-mono">
            ${curTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-300 mt-2">
            Asegurado + Abierto {curGanandoPerdiendo >= 0 ? "+" : "−"} Flotante
          </div>
        </div>
      </div>

      {/* BARRA DE ECUACIÓN VISUAL Y RESUMEN RÁPIDO */}
      <div className="p-4 rounded-2xl bg-surface border border-surface-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap text-xs font-semibold text-gray-300">
          <span className="text-gray-400 font-normal">Tu patrimonio:</span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            🛡️ Asegurado ${curAsegurado.toFixed(2)}
          </span>
          <span className="text-gray-500 font-bold">+</span>
          <span className="px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            ⚡ Abierto ${curAbierto.toFixed(2)}
          </span>
          <span className="text-gray-500 font-bold">+</span>
          <span className={`px-2.5 py-1 rounded-xl font-mono font-bold flex items-center gap-1 ${
            curGanandoPerdiendo >= 0
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}>
            <Activity className="w-3.5 h-3.5" />
            📊 Flotante {curGanandoPerdiendo >= 0 ? "+" : ""}${curGanandoPerdiendo.toFixed(2)}
          </span>
          <span className="text-gray-400 font-bold">=</span>
          <span className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-black text-xs sm:text-sm flex items-center gap-1 shadow-sm shadow-amber-500/10">
            💰 TOTAL ${curTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-surface-border/50 border border-surface-border text-xs text-gray-300 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Win Rate: <strong className="text-white font-mono">{isReal ? (realStats.wins + realStats.losses > 0 ? `${realStats.winRate}%` : "—") : (totalTradesCount > 0 ? `${winRate}%` : "—")}</strong></span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-surface-border/50 border border-surface-border text-xs text-gray-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Traders: <strong className="text-white font-mono">{(isReal ? (profile.real_traders || []) : (profile.traders || [])).length}</strong></span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CUERPO PRINCIPAL: SEPARACIÓN COMPLETA ENTRE MODO REAL Y MODO SIMULADO   */}
      {/* ========================================================================= */}
      {isReal ? (
        /* ======================== BLOQUE MODO REAL ======================== */
        <div className="space-y-8 animate-fadeIn">
          {/* BANNER BILLETERA REAL */}
          {!profile.wallet_address ? (
            <div className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="font-extrabold text-amber-300 text-base">
                    Estás en Modo Real pero aún no has conectado tu billetera
                  </h3>
                  <p className="text-xs text-gray-300 mt-1">
                    Para ver tus saldos reales, posiciones abiertas y activar la copia on-chain en Hyperliquid, vincula tu dirección pública en Ajustes.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href="/settings"
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-400/20 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Conectar Billetera en Ajustes</span>
                </Link>
                <Link
                  href="/guide?tab=FONDEO"
                  className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-border border border-amber-500/40 text-amber-300 font-extrabold text-xs transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <span>Guía de Fondeo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
              realWalletData
                ? "bg-blue-950/20 border-blue-500/40 shadow-lg shadow-blue-500/10"
                : "bg-surface border-surface-border"
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-white text-sm">Billetera Real Conectada (Hyperliquid)</h3>
                    <span className="font-mono text-[10px] text-gray-300 bg-background px-2 py-0.5 rounded border border-surface-border truncate max-w-[200px]">
                      {profile.wallet_address}
                    </span>
                  </div>
                  {realWalletLoading ? (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" /> Consultando datos on-chain de Hyperliquid...
                    </p>
                  ) : realWalletData ? (
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-xs text-gray-300">
                        Cuenta: <strong className="text-white font-mono">${realWalletData.accountValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span className="text-xs text-gray-300">
                        USDC Libre: <strong className="text-blue-400 font-mono">${realWalletData.totalRawUsd.toFixed(2)}</strong>
                      </span>
                      <span className="text-xs text-gray-300">
                        PnL Flotante: <strong className={realWalletData.totalUnrealizedPnl >= 0 ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                          {realWalletData.totalUnrealizedPnl >= 0 ? "+" : ""}${realWalletData.totalUnrealizedPnl.toFixed(2)}
                        </strong>
                      </span>
                      <span className="text-xs text-gray-300">
                        Posiciones abiertas: <strong className="text-white">{realWalletData.openPositions.length}</strong>
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">No se pudieron cargar los datos on-chain.</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/guide?tab=FONDEO"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all"
                  title="Guía de Fondeo"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Fondear</span>
                </Link>
                <button
                  onClick={() => profile.wallet_address && fetchRealWallet(profile.wallet_address)}
                  disabled={realWalletLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/20 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${realWalletLoading ? "animate-spin" : ""}`} />
                  Actualizar
                </button>
                <a
                  href="https://app.hyperliquid.xyz/portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-gray-300 text-xs font-bold hover:border-primary/40 hover:text-primary transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver en Hyperliquid
                </a>
              </div>
            </div>
          )}

          {/* BANNER SI TIENE 0 SALDO EN REAL */}
          {profile.wallet_address && realWalletData && realWalletData.accountValue === 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 text-xs text-amber-300">
                <span className="text-lg">💡</span>
                <span>
                  Tu cuenta en Hyperliquid tiene <strong>$0.00 USDC</strong>. Para empezar a copiar en real, deposita fondos desde Arbitrum One.
                </span>
              </div>
              <Link
                href="/guide?tab=FONDEO"
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center gap-1 shrink-0 transition-all shadow-sm"
              >
                <span>Ver Guía de Fondeo & Requisitos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}


          {/* POSICIONES REALES ABIERTAS */}
          {profile.wallet_address && (
            <div className={`p-6 rounded-2xl border space-y-4 transition-all ${
              realWalletData && realWalletData.openPositions.length > 0
                ? "bg-blue-950/20 border-blue-500/30"
                : "bg-surface border-surface-border"
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Posiciones Reales Abiertas en Tu Billetera Hyperliquid
                  {realWalletData && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                      {realWalletData.openPositions.length} activas
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  {realWalletData && realWalletData.openPositions.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePanicCloseAll}
                      className="py-1.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-red-500/10"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>🚨 Cerrar Todo (Pánico)</span>
                    </button>
                  )}
                  <span className="text-xs text-gray-400">Datos on-chain en tiempo real de Hyperliquid</span>
                </div>
              </div>

              {closeSuccessMsg && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>{closeSuccessMsg}</span>
                </div>
              )}

              {realWalletLoading ? (
                <div className="p-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Consultando posiciones abiertas en Hyperliquid...</span>
                </div>
              ) : realWalletData && realWalletData.openPositions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {realWalletData.openPositions.map((pos: any, i: number) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        pos.side === "LONG"
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white text-sm">{pos.coin}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              pos.side === "LONG"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-red-500/20 text-red-300 border border-red-500/30"
                            }`}>
                              {pos.side}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">{pos.leverage.toFixed(1)}x</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Entrada</span>
                            <span className="text-white font-mono">${pos.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Precio actual</span>
                            <span className="text-white font-mono">${pos.markPx.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Margen usado</span>
                            <span className="text-white font-mono">${pos.marginUsed.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs pt-1 border-t border-white/5">
                            <span className="text-gray-300 font-semibold">PnL no realizado</span>
                            <span className={`font-extrabold font-mono ${pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCloseRealPosition(pos.coin)}
                        disabled={closingPos === pos.coin}
                        className="mt-3 w-full py-2 px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                        <span>{closingPos === pos.coin ? "Cerrando..." : `Cerrar ${pos.coin} a Mercado`}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-background/50 border border-surface-border text-center text-xs text-gray-400">
                  Actualmente tu billetera no tiene ninguna posición abierta en Hyperliquid. Tu capital está en liquidez disponible en USDC.
                </div>
              )}
            </div>
          )}

          {/* CURVA DE CAPITAL REAL & SELECTOR DÍA A DÍA */}
          <div className="p-5 sm:p-6 rounded-2xl border bg-blue-950/10 border-blue-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span>Curva de Capital Real (Hyperliquid Mainnet)</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  🔵 Evolución de tu <strong className="text-blue-400">🛡️ Dinero Seguro</strong> vs <strong className="text-amber-300">💰 Dinero Total</strong> on-chain.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {/* Selector Día a Día vs Operación a Operación */}
                <div className="inline-flex p-1 rounded-xl bg-surface border border-surface-border">
                  <button
                    type="button"
                    onClick={() => setChartViewMode("DAILY")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartViewMode === "DAILY"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Día a Día</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode("DETAILED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartViewMode === "DETAILED"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Operación a Operación</span>
                  </button>
                </div>

                <button
                  onClick={() => setInfoModalOpen(true)}
                  className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 font-bold hover:underline"
                >
                  ¿Cómo interpretar?
                </button>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    (chartViewMode === "DAILY" ? realDailyHistory : realEquityHistory).length > 0
                      ? (chartViewMode === "DAILY" ? realDailyHistory : realEquityHistory)
                      : [
                          {
                            time: "Hoy",
                            dateLabel: "Hoy",
                            fullDate: "Momento Actual",
                            dineroSeguro: curAsegurado,
                            dineroAbierto: curAbierto,
                            ganandoPerdiendo: curGanandoPerdiendo,
                            dineroTotal: curTotal,
                            realized: curAsegurado,
                            equity: curTotal,
                            dailyChange: 0,
                            tradesCount: 0,
                          },
                        ]
                  }
                >
                  <defs>
                    <linearGradient id="colorRealizedBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEquityGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="dateLabel" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend
                    formatter={(val) =>
                      val === "dineroSeguro"
                        ? "🛡️ Dinero Seguro (Consolidado)"
                        : "💰 Dinero Total (Todo Incluido)"
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="dineroSeguro"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRealizedBlue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="dineroTotal"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorEquityGold)"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* TABLA DE DESGLOSE DÍA POR DÍA (REAL) */}
            <DailyBreakdownTable data={realDailyHistory} isReal={true} />
          </div>

          {/* SECCIÓN DE ESTADÍSTICAS & RENDIMIENTO CUANTITATIVO (REAL) */}
          <PerformanceStatsSection
            isReal={true}
            capitalBase={capitalBase}
            totalAbsoluteGain={totalAbsoluteGain}
            globalTotalRoiPct={globalTotalRoiPct}
            avgPnlPerTradeUSD={avgPnlPerTradeUSD}
            avgRoiPerTradePct={avgRoiPerTradePct}
            avgDailyPnlUSD={avgDailyPnlUSD}
            avgDailyRoiPct={avgDailyRoiPct}
            winRate={realStats.wins + realStats.losses > 0 ? realStats.winRate : 0}
            wins={realStats.wins}
            losses={realStats.losses}
            totalTrades={realStats.totalTrades}
            profitFactor={realStats.losses > 0 ? (realStats.wins / realStats.losses).toFixed(2) : (realStats.wins > 0 ? "∞" : "0.00")}
            bestTradePnl={bestTradePnl}
            worstTradePnl={worstTradePnl}
          />

          {/* ESTADO & SOLVENCIA DE CUENTA REAL ON-CHAIN */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-400" /> Solvencia & Liquidez de Cuenta Real
                </h2>
                <p className="text-xs text-gray-400">
                  Desglose on-chain de liquidez libre en USDC, margen bloqueado en posiciones vivas y estado de autorización de tu Agente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-bold border border-blue-500/30 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>Mainnet Hyperliquid Conectada</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {/* USDC Libre */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" /> USDC Libre (Efectivo)
                </span>
                <div className="text-xl font-black text-blue-400">
                  ${(realWalletData?.totalRawUsd || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Disponible para nuevas órdenes</span>
              </div>

              {/* Margen en Uso Real */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Margen Retenido
                </span>
                <div className="text-xl font-black text-amber-300">
                  ${((realWalletData?.openPositions || []).reduce((sum: number, p: any) => sum + (p.marginUsed || 0), 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Comprometido en {realWalletData?.openPositions?.length || 0} posiciones</span>
              </div>

              {/* PnL No Realizado Real */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-purple-400" /> PnL No Realizado
                </span>
                <div className={`text-xl font-black ${(realWalletData?.totalUnrealizedPnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {(realWalletData?.totalUnrealizedPnl || 0) >= 0 ? "+" : ""}${(realWalletData?.totalUnrealizedPnl || 0).toFixed(2)}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Flotando en contratos perps</span>
              </div>

              {/* Agente de Trading */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1 font-sans">
                <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-blue-400" /> Agente Delegado
                </span>
                <div className="text-sm font-black text-white pt-1">
                  {profile.agent_wallet?.is_approved_on_chain ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      🟢 Activo On-Chain
                    </span>
                  ) : (
                    <Link href="/settings" className="text-amber-400 hover:underline flex items-center gap-1 text-xs">
                      🟡 Configurar Agente →
                    </Link>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 truncate block font-mono">
                  {profile.agent_wallet?.agent_address ? `${profile.agent_wallet.agent_address.slice(0, 8)}...` : "Sin agente"}
                </span>
              </div>
            </div>
          </div>

          {/* HISTORIAL DE EJECUCIONES ON-CHAIN REALES (userFills) */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-400" /> Fills On-Chain Reales (Hyperliquid)
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {realFills.length} ejecuciones
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Operaciones ejecutadas directamente por tu billetera en Hyperliquid Mainnet.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Tabs de Filtro de Fills */}
                <div className="flex p-1 rounded-xl bg-background border border-surface-border text-xs font-bold">
                  <button
                    onClick={() => setRealFillFilter("ALL")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      realFillFilter === "ALL"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Todos ({realFills.length})
                  </button>
                  <button
                    onClick={() => setRealFillFilter("CLOSED_PNL")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      realFillFilter === "CLOSED_PNL"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Con PnL ({realFills.filter((f) => Math.abs(f.closedPnl) > 0.0001).length})
                  </button>
                  <button
                    onClick={() => setRealFillFilter("BUY")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      realFillFilter === "BUY"
                        ? "bg-emerald-500 text-black font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Compras
                  </button>
                  <button
                    onClick={() => setRealFillFilter("SELL")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      realFillFilter === "SELL"
                        ? "bg-red-500 text-white font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Ventas
                  </button>
                </div>

                <Link
                  href="/history"
                  className="px-3 py-1.5 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-xs text-blue-400 font-bold flex items-center gap-1 transition-colors"
                >
                  <span>Ver Historial Completo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Tabla de Fills */}
            {displayedRealFills.length === 0 ? (
              <div className="py-8 text-center space-y-2 bg-background/40 rounded-xl border border-surface-border/50">
                <History className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">No hay ejecuciones on-chain para este filtro.</p>
                <p className="text-[11px] text-gray-500">
                  Las operaciones aparecerán tan pronto como tu Agente o billetera ejecuten órdenes en Hyperliquid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border/60">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-surface-border bg-background/80 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Activo</th>
                      <th className="py-3 px-4">Dirección</th>
                      <th className="py-3 px-4 text-right">Precio Ejecutado</th>
                      <th className="py-3 px-4 text-right">Tamaño ($ USD)</th>
                      <th className="py-3 px-4 text-right">Comisión (Fee)</th>
                      <th className="py-3 px-4 text-right">PnL Realizado</th>
                      <th className="py-3 px-4 text-center">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/40 font-mono text-[11px]">
                    {displayedRealFills.map((fill) => {
                      const isBuy = (fill.dir || "").toLowerCase().includes("buy") || fill.side === "LONG";
                      const hasPnl = Math.abs(fill.closedPnl) > 0.0001;
                      const isProfit = fill.closedPnl >= 0;
                      const dateStr = new Date(fill.time).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      return (
                        <tr key={fill.id} className="hover:bg-background/40 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              <CheckCircle2 className="w-3 h-3 text-blue-400" />
                              <span>EJECUTADO ON-CHAIN</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-gray-300 font-sans text-xs">
                            {dateStr}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-background border border-surface-border font-bold text-white">
                              {fill.coin}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                isBuy
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/15 text-red-400 border-red-500/30"
                              }`}
                            >
                              {isBuy ? "↗ BUY" : "↘ SELL"} ({fill.side})
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-white">
                            ${fill.px.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right text-gray-300">
                            ${fill.usdValue.toFixed(2)} USD
                            <span className="text-[10px] text-gray-500 ml-1">({fill.sz} {fill.coin})</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right text-gray-400">
                            ${fill.fee ? fill.fee.toFixed(4) : "0.0000"}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right font-bold">
                            {hasPnl ? (
                              <span className={isProfit ? "text-emerald-400" : "text-red-400"}>
                                {isProfit ? "+" : ""}${fill.closedPnl.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-center font-sans">
                            {fill.hash ? (
                              <a
                                href={`https://app.hyperliquid.xyz/explorer/tx/${fill.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                              >
                                <span className="font-mono">{fill.hash.slice(0, 6)}...</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-gray-600 font-mono">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TRADERS EN TU CESTA REAL */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-400" /> Traders en Tu Cesta Real ({(profile.real_traders || []).length})
                </h2>
                <p className="text-xs text-gray-400">
                  Traders líderes configurados para la replicación on-chain con tu billetera real en Hyperliquid.
                </p>
              </div>
              <Link
                href="/traders"
                className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs text-blue-300 font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Gestionar Cesta Real</span>
              </Link>
            </div>

            {(profile.real_traders || []).length === 0 ? (
              <div className="p-8 rounded-3xl bg-blue-950/20 border border-blue-500/30 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center mx-auto text-xl">
                  👥
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-white">No tienes traders en tu Cesta Real todavía</h3>
                  <p className="text-xs text-gray-400">
                    Tu Agente de Trading necesita que selecciones traders líderes para replicar sus órdenes en tu cuenta Hyperliquid Mainnet.
                  </p>
                </div>
                <Link
                  href="/traders"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/25 transition-all"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configurar Cesta Real en Traders</span>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {copiedTradersStats.map((t, idx) => (
                  <CopiedTraderCard
                    key={idx}
                    trader={t}
                    isReal={true}
                    onEditAlias={(trader) => setAliasModalTrader(trader)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ======================== BLOQUE MODO SIMULADO ======================== */
        <div className="space-y-8 animate-fadeIn">
          {/* Hero Bienvenida si la Cesta Simulada está vacía */}
          {profile.traders.length === 0 && (
            <div className="p-8 rounded-3xl bg-gradient-to-r from-primary/15 via-surface to-background border-2 border-primary/40 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                    🚀 Cartera Inicial Limpia ($10,000 USD)
                  </span>
                  <h2 className="text-xl font-extrabold text-white">
                    ¡Bienvenido! No tienes ningún trader copiado todavía
                  </h2>
                  <p className="text-xs text-gray-300 max-w-2xl">
                    Tu saldo de $10,000 USD está 100% disponible en efectivo. Empieza explorando el Hall de la Fama y asigna tu capital con control de riesgo total.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => setTourOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-surface hover:bg-surface-border text-white border border-surface-border text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>Ver Tutorial Guiado</span>
                  </button>
                  <Link
                    href="/traders"
                    className="px-5 py-2.5 rounded-xl bg-primary text-black font-extrabold text-xs hover:bg-primary-hover shadow-lg shadow-primary/25 transition-all flex items-center gap-1.5"
                  >
                    <Award className="w-4 h-4" />
                    <span>Explorar Hall de la Fama</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ALERTA DE VALIDACIÓN PENDIENTE TELEGRAM */}
          {pendingTrades.length > 0 && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5 animate-fadeIn">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-lg">
                  📱
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-amber-300 text-sm">
                      Tienes {pendingTrades.length} orden{pendingTrades.length > 1 ? "es" : ""} esperando tu validación
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-400 text-black">
                      Validación Previa Activa
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Revisa tu bot de Telegram o apruébalas directamente aquí para replicar la orden en tu cartera.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => {
                    pendingTrades.forEach((pt) => approveTradeId(pt.id));
                    fetchLiveStats();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aprobar Todas</span>
                </button>
                <button
                  onClick={() => setTradeFilterTab("PENDING")}
                  className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-border text-white border border-surface-border text-xs font-bold transition-all"
                >
                  Ver Órdenes ({pendingTrades.length})
                </button>
              </div>
            </div>
          )}

          {/* CURVA DE CAPITAL SIMULADO & SELECTOR DÍA A DÍA */}
          <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <span>Curva de Capital (Día a Día) - Simulado</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  🟢 Evolución de tu <strong className="text-emerald-400">🛡️ Dinero Seguro</strong> vs <strong className="text-amber-300">💰 Dinero Total</strong> ($10,000 USD base).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                {/* Selector Día a Día vs Operación a Operación */}
                <div className="inline-flex p-1 rounded-xl bg-background border border-surface-border">
                  <button
                    type="button"
                    onClick={() => setChartViewMode("DAILY")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartViewMode === "DAILY"
                        ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Día a Día</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode("DETAILED")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      chartViewMode === "DETAILED"
                        ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Operación a Operación</span>
                  </button>
                </div>

                <button
                  onClick={() => setInfoModalOpen(true)}
                  className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
                >
                  ¿Cómo interpretar?
                </button>
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    (chartViewMode === "DAILY" ? simulatedDailyHistory : liveEquityHistory).length > 0
                      ? (chartViewMode === "DAILY" ? simulatedDailyHistory : liveEquityHistory)
                      : [
                          {
                            time: "Hoy",
                            dateLabel: "Hoy",
                            fullDate: "Momento Actual",
                            dineroSeguro: curAsegurado,
                            dineroAbierto: curAbierto,
                            ganandoPerdiendo: curGanandoPerdiendo,
                            dineroTotal: curTotal,
                            realized: curAsegurado,
                            equity: curTotal,
                            dailyChange: 0,
                            tradesCount: 0,
                          },
                        ]
                  }
                >
                  <defs>
                    <linearGradient id="colorRealizedGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEquityGoldSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="dateLabel" stroke="#666" fontSize={11} />
                  <YAxis stroke="#666" fontSize={11} domain={["auto", "auto"]} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend
                    formatter={(val) =>
                      val === "dineroSeguro"
                        ? "🛡️ Dinero Seguro (Consolidado)"
                        : "💰 Dinero Total (Todo Incluido)"
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="dineroSeguro"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRealizedGreen)"
                  />
                  <Area
                    type="monotone"
                    dataKey="dineroTotal"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorEquityGoldSim)"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* TABLA DE DESGLOSE DÍA POR DÍA (SIMULADO) */}
            <DailyBreakdownTable data={simulatedDailyHistory} isReal={false} />
          </div>

          {/* SECCIÓN DE ESTADÍSTICAS & RENDIMIENTO CUANTITATIVO (SIMULADO) */}
          <PerformanceStatsSection
            isReal={false}
            capitalBase={profile.initial_balance || 10000.0}
            totalAbsoluteGain={liveGlobalPnl + liveGlobalFloatingPnl}
            globalTotalRoiPct={globalTotalRoiPct}
            avgPnlPerTradeUSD={avgPnlPerTradeUSD}
            avgRoiPerTradePct={avgRoiPerTradePct}
            avgDailyPnlUSD={avgDailyPnlUSD}
            avgDailyRoiPct={avgDailyRoiPct}
            winRate={totalTradesCount > 0 ? winRate : 0}
            wins={liveGlobalWins}
            losses={liveGlobalLosses}
            totalTrades={totalTradesCount}
            profitFactor={liveGlobalLosses > 0 ? (liveGlobalWins / liveGlobalLosses).toFixed(2) : (liveGlobalWins > 0 ? "∞" : "0.00")}
            bestTradePnl={bestTradePnl}
            worstTradePnl={worstTradePnl}
          />

          {/* ESTADO INTEGRAL Y COMPOSICIÓN DE CARTERA SIMULADA */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Estado & Composición de tu Cartera Simulada
                </h2>
                <p className="text-xs text-gray-400">
                  Desglose instantáneo de solvencia: liquidez libre, margen retenido en mercado y parámetros de protección ($10k base).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 animate-pulse" />
                  <span>Cloud 24/7 Conectado</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {/* Liquidez Libre */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Liquidez Libre (Efectivo)
                </span>
                <div className="text-xl font-black text-emerald-400">
                  ${freeLiquidityUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Disponible para nuevas órdenes</span>
              </div>

              {/* Margen en Uso */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Margen Retenido
                </span>
                <div className="text-xl font-black text-amber-300">
                  ${liveTotalMarginUsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Comprometido en posiciones</span>
              </div>

              {/* PnL Flotante Vivo */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1">
                <span className="text-[10px] text-gray-400 uppercase font-sans font-bold flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-purple-400" /> PnL No Realizado
                </span>
                <div className={`text-xl font-black ${liveGlobalFloatingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {liveGlobalFloatingPnl >= 0 ? "+" : ""}${liveGlobalFloatingPnl.toFixed(2)}
                </div>
                <span className="text-[10px] text-gray-500 font-sans">Flotando en el mercado</span>
              </div>

              {/* Modo de Ejecución */}
              <div className="p-4 rounded-xl bg-background/60 border border-surface-border space-y-1 font-sans">
                <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-primary" /> Modo de Ejecución
                </span>
                <div className="text-sm font-black text-white pt-1">
                  {profile.global_risk?.execution_mode === "TELEGRAM_APPROVAL" ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      📱 Aprobación Telegram
                    </span>
                  ) : (
                    <span className="text-primary flex items-center gap-1">
                      ⚡ 100% Automático
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500">Circuit Breaker: -{profile.global_risk?.circuit_breaker_pct || 15}%</span>
              </div>
            </div>
          </div>

          {/* ÚLTIMOS MOVIMIENTOS Y ÓRDENES REPLICADAS SIMULADAS */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" /> Últimos Movimientos & Operaciones Simuladas
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                    {recentTrades.length} registradas
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Registro cronológico de órdenes virtuales replicando a los traders de tu cartera simulada.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Tabs de Filtro Rápido */}
                <div className="flex p-1 rounded-xl bg-background border border-surface-border text-xs font-bold">
                  <button
                    onClick={() => setTradeFilterTab("ALL")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tradeFilterTab === "ALL"
                        ? "bg-primary text-black"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                  {pendingTrades.length > 0 && (
                    <button
                      onClick={() => setTradeFilterTab("PENDING")}
                      className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                        tradeFilterTab === "PENDING"
                          ? "bg-amber-400 text-black shadow-sm font-black animate-pulse"
                          : "text-amber-300 hover:text-white bg-amber-500/10 border border-amber-500/30"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Por Validar ({pendingTrades.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setTradeFilterTab("LATEST_OPEN")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tradeFilterTab === "LATEST_OPEN"
                        ? "bg-amber-400 text-black shadow-sm font-extrabold"
                        : "text-amber-400 hover:text-white"
                    }`}
                  >
                    ⭐ Última Abierta
                  </button>
                  <button
                    onClick={() => setTradeFilterTab("OPEN")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tradeFilterTab === "OPEN"
                        ? "bg-emerald-500 text-black font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🟢 Abiertas
                  </button>
                  <button
                    onClick={() => setTradeFilterTab("CLOSED")}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tradeFilterTab === "CLOSED"
                        ? "bg-gray-700 text-white font-extrabold"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🏁 Cerradas
                  </button>
                </div>

                <Link
                  href="/history"
                  className="px-3 py-1.5 rounded-xl bg-surface hover:bg-gray-800 border border-surface-border text-xs text-primary font-bold flex items-center gap-1 transition-colors"
                >
                  <span>Ver Historial Completo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Tabla de Movimientos Simulados */}
            {displayedTrades.length === 0 ? (
              <div className="py-8 text-center space-y-2 bg-background/40 rounded-xl border border-surface-border/50">
                <History className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">No hay movimientos registrados para este filtro.</p>
                <p className="text-[11px] text-gray-500">
                  Las órdenes se registrarán automáticamente en cuanto los traders de tu cesta operen en Hyperliquid.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-surface-border/60">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="border-b border-surface-border bg-background/80 text-gray-400 uppercase font-black tracking-wider text-[10px]">
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4">Horarios (Apertura / Cierre)</th>
                      <th className="py-3 px-4">Trader Líder</th>
                      <th className="py-3 px-4">Activo</th>
                      <th className="py-3 px-4">Dirección</th>
                      <th className="py-3 px-4 text-right">Precio Entrada</th>
                      <th className="py-3 px-4 text-right">Tamaño ($ USD)</th>
                      <th className="py-3 px-4 text-right">Acción / PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/40 font-mono text-[11px]">
                    {displayedTrades.map((trade) => {
                      const isLong = trade.side === "LONG";
                      const isOpen = trade.status === "OPEN";
                      const isPending = trade.status === "PENDING_APPROVAL";
                      const isProfit = trade.pnl >= 0;

                      return (
                        <tr
                          key={trade.id}
                          className={`transition-colors ${
                            isPending
                              ? "bg-amber-500/[0.08] hover:bg-amber-500/[0.12] border-l-2 border-l-amber-400"
                              : isOpen
                              ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                              : "hover:bg-background/40"
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20 animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>VALIDACIÓN PENDIENTE</span>
                              </span>
                            ) : isOpen ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                <span>EN VIVO • ABIERTA</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-gray-800/90 text-gray-400 border border-gray-700/80">
                                🏁 CERRADA
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-emerald-400 font-bold text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                  IN
                                </span>
                                <span className="text-gray-200 font-mono text-[11px]">
                                  {trade.openTimeStr || trade.timeStr}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className={`font-bold text-[9px] px-1 py-0.2 rounded border ${
                                  isPending
                                    ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                                    : isOpen
                                    ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                    : "text-gray-400 bg-gray-800 border-gray-700"
                                }`}>
                                  OUT
                                </span>
                                <span className={`font-mono text-[11px] ${
                                  isPending
                                    ? "text-amber-300 font-bold"
                                    : isOpen
                                    ? "text-emerald-400 animate-pulse font-bold"
                                    : "text-gray-400"
                                }`}>
                                  {isPending
                                    ? "Esperando Aprobación 📱"
                                    : isOpen
                                    ? "En mercado 🟢"
                                    : trade.closeTimeStr || trade.timeStr}
                                </span>
                                {trade.durationStr && (
                                  <span className="text-[10px] text-gray-500 ml-1 font-mono">
                                    ({trade.durationStr})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-bold text-white font-sans">
                            {trade.traderName}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-background border border-surface-border font-bold text-white">
                              {trade.coin}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                isLong
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-red-500/15 text-red-400 border-red-500/30"
                              }`}
                            >
                              {isLong ? "↗ LONG" : "↘ SHORT"} {trade.leverage}x
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-white">
                            ${trade.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right text-gray-300">
                            ${trade.usdValue > 0 && trade.usdValue < 0.01 ? trade.usdValue.toFixed(4) : trade.usdValue.toFixed(2)} USD
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-right font-bold">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5 font-sans">
                                <button
                                  onClick={() => {
                                    approveTradeId(trade.id);
                                    fetchLiveStats();
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-extrabold text-[10px] hover:bg-emerald-400 shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Aprobar</span>
                                </button>
                                <button
                                  onClick={() => {
                                    rejectTradeId(trade.id);
                                    fetchLiveStats();
                                  }}
                                  className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 font-bold text-[10px] transition-all"
                                >
                                  Descartar
                                </button>
                              </div>
                            ) : (
                              <span className={isProfit ? "text-emerald-400" : "text-red-400"}>
                                {isProfit ? "+" : ""}${Math.abs(trade.pnl) > 0 && Math.abs(trade.pnl) < 0.01 ? trade.pnl.toFixed(4) : trade.pnl.toFixed(2)}
                                <span className="text-[10px] text-gray-500 ml-1 font-mono">
                                  ({isProfit ? "+" : ""}{trade.pnlPct.toFixed(2)}%)
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DESGLOSE DE MÉTRICAS DETALLADAS POR TRADER SIMULADO */}
          {profile.traders.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-4">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" /> Métricas & Rendimiento por Trader Simulado ({copiedTradersStats.length})
                  </h2>
                  <p className="text-xs text-gray-400">
                    Desglose individual de operaciones ejecutadas, beneficios cerrados, flotante en vivo y posiciones abiertas por cada trader en tu cartera virtual.
                  </p>
                </div>
                <Link
                  href="/traders"
                  className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-border border border-surface-border text-xs text-primary font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Gestionar Cesta & Riesgo</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {copiedTradersStats.map((t, idx) => (
                  <CopiedTraderCard
                    key={idx}
                    trader={t}
                    isReal={false}
                    onEditAlias={(trader) => setAliasModalTrader(trader)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
