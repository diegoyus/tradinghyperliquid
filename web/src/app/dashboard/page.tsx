"use client";

import { useEffect, useState, useMemo } from "react";
import { DollarSign, TrendingUp, Award, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, UserCheck, Shield, ChevronRight, PieChart, Sliders } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell, Legend } from "recharts";
import Link from "next/link";
import { getStoredProfile, resetProfile } from "@/lib/storage";
import { UserProfile } from "@/lib/types";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedTraderFilter, setSelectedTraderFilter] = useState<string>("ALL");

  // Estado en vivo desde Hyperliquid
  const [liveStats, setLiveStats] = useState<Record<string, any>>({});
  const [liveGlobalPnl, setLiveGlobalPnl] = useState(0);
  const [liveGlobalFloatingPnl, setLiveGlobalFloatingPnl] = useState(0);
  const [liveGlobalWins, setLiveGlobalWins] = useState(0);
  const [liveGlobalLosses, setLiveGlobalLosses] = useState(0);
  const [liveEquityHistory, setLiveEquityHistory] = useState<any[]>([
    { time: "Inicio", realized: 10000.0, equity: 10000.0 }
  ]);

  useEffect(() => {
    setMounted(true);
    setProfile(getStoredProfile());
  }, []);

  // Fetch real stats from Hyperliquid on mount
  useEffect(() => {
    if (!profile) return;
    const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

    const fetchLiveStats = async () => {
      // Leer timestamp de reinicio si existe
      const resetTime = typeof window !== "undefined"
        ? parseInt(localStorage.getItem("hyperliquid_reset_timestamp") || "0")
        : 0;

      const perTrader: Record<string, any> = {};
      let globalPnl = 0;
      let globalWins = 0;
      let globalLosses = 0;

      const allClosedTrades: { timestamp: number; pnl: number; timeStr: string }[] = [];
      let totalFloatingPnl = 0;

      for (const t of profile.traders) {
        try {
          const [stRes, fillsRes] = await Promise.all([
            fetch(HYPERLIQUID_INFO_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "clearinghouseState", user: t.address }),
            }),
            fetch(HYPERLIQUID_INFO_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "userFills", user: t.address }),
            }),
          ]);

          if (!stRes.ok) continue;
          const stData = await stRes.json();
          const fills = fillsRes.ok ? await fillsRes.json() : [];
          const traderAccountValue = parseFloat(stData?.marginSummary?.accountValue || "100000");
          const userCapital = profile.cash_balance * (t.allocation_pct / 100);

          // Contar trades cerrados y calcular PnL proporcional
          const closedFills = Array.isArray(fills)
            ? fills.filter((f: any) => {
                const isClosed = parseFloat(f.closedPnl || "0") !== 0;
                const afterReset = (f.time || 0) > resetTime;
                return isClosed && afterReset;
              })
            : [];

          let traderPnl = 0;
          let wins = 0;
          let losses = 0;
          const openPositions: any[] = [];

          for (const f of closedFills) {
            const rawPnl = parseFloat(f.closedPnl || "0");
            const myPnl = traderAccountValue > 0 ? (rawPnl / traderAccountValue) * userCapital : 0;
            traderPnl += myPnl;
            if (myPnl > 0) wins++;
            else if (myPnl < 0) losses++;

            const d = f.time ? new Date(f.time) : new Date();
            const timeStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
            allClosedTrades.push({
              timestamp: f.time || 0,
              pnl: myPnl,
              timeStr
            });
          }

          // Posiciones abiertas
          const assetPositions = stData?.assetPositions || [];
          for (const p of assetPositions) {
            const pos = p.position || {};
            const szi = parseFloat(pos.szi || "0");
            const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
            const coin = pos.coin || "Crypto";
            if (szi !== 0) {
              let openTimeMs = 0;
              if (Array.isArray(fills)) {
                const matchingFills = fills.filter((f: any) => f.coin === coin);
                if (matchingFills.length > 0) {
                  openTimeMs = Math.min(...matchingFills.map((f: any) => f.time || 0));
                }
              }

              // Si se abrió antes del reinicio (o no tiene fill y hay un reinicio activo), la ignoramos completamente
              if (resetTime > 0 && (openTimeMs === 0 || openTimeMs < resetTime)) {
                continue;
              }

              openPositions.push({
                coin,
                side: szi > 0 ? "LONG" : "SHORT",
                leverage: pos.leverage?.value || 10,
              });

              const pnlFrac = traderAccountValue > 0 ? unrealizedPnl / traderAccountValue : 0;
              const myPosPnl = userCapital * pnlFrac;
              totalFloatingPnl += myPosPnl;
            }
          }

          const totalTrades = wins + losses;
          const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";

          perTrader[t.address.toLowerCase()] = {
            totalPnl: traderPnl,
            wins,
            losses,
            totalTrades,
            winRate,
            openPositions,
          };

          globalPnl += traderPnl;
          globalWins += wins;
          globalLosses += losses;
        } catch {}
      }

      setLiveStats(perTrader);
      setLiveGlobalPnl(globalPnl);
      setLiveGlobalFloatingPnl(totalFloatingPnl);
      setLiveGlobalWins(globalWins);
      setLiveGlobalLosses(globalLosses);

      // Reconstruir la curva de capital cronológicamente con doble línea (realized y equity)
      allClosedTrades.sort((a, b) => a.timestamp - b.timestamp);
      let runningBal = profile.initial_balance;
      const newHistory = [{ time: "Inicio", realized: runningBal, equity: runningBal }];

      for (const t of allClosedTrades) {
        runningBal += t.pnl;
        newHistory.push({
          time: t.timeStr,
          realized: parseFloat(runningBal.toFixed(2)),
          equity: parseFloat(runningBal.toFixed(2))
        });
      }

      // Añadir valor flotante final
      newHistory.push({
        time: "Actual",
        realized: parseFloat(runningBal.toFixed(2)),
        equity: parseFloat((runningBal + totalFloatingPnl).toFixed(2))
      });

      setLiveEquityHistory(newHistory);
    };

    fetchLiveStats();
  }, [profile]);

  // Calcular métricas por cada trader copiado (CON DATOS EN VIVO)
  const copiedTradersStats = useMemo(() => {
    if (!profile) return [];

    return profile.traders.map((t) => {
      const live = liveStats[t.address.toLowerCase()];
      const allocatedCapital = profile.cash_balance * (t.allocation_pct / 100);

      const totalPnl = live?.totalPnl || 0;
      const wins = live?.wins || 0;
      const losses = live?.losses || 0;
      const totalTrades = live?.totalTrades || 0;
      const winRate = live?.winRate || "0.0";
      const roiPct = allocatedCapital > 0 ? ((totalPnl / allocatedCapital) * 100).toFixed(1) : "0.0";
      const activePositions = live?.openPositions || [];

      return {
        ...t,
        allocatedCapital,
        totalTrades,
        wins,
        losses,
        totalPnl,
        roiPct: totalPnl !== 0 ? (totalPnl > 0 ? `+${roiPct}%` : `${roiPct}%`) : "+0.0%",
        winRate,
        activePositions,
      };
    });
  }, [profile, liveStats]);

  if (!mounted || !profile) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const totalGlobalTrades = liveGlobalWins + liveGlobalLosses;
  const pnlPercent = ((liveGlobalPnl / profile.initial_balance) * 100).toFixed(2);
  const winRate = totalGlobalTrades > 0
    ? ((liveGlobalWins / totalGlobalTrades) * 100).toFixed(1)
    : "0.0";

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
          <button
            onClick={() => {
              if (confirm("¿Quieres reiniciar tu cartera a los $10,000 USD iniciales y limpiar el historial?")) {
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            24/7 Cloud Activo
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CARD 1: Dinero Cerrado */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dinero Cerrado</span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4 font-mono">
            ${(profile.initial_balance + liveGlobalPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            PnL Realizado: <strong className={liveGlobalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
              {liveGlobalPnl >= 0 ? "+" : ""}${liveGlobalPnl.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* CARD 2: Dinero Flotante (PnL Abierto) */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dinero Flotante</span>
            <div className={`p-2 rounded-xl ${liveGlobalFloatingPnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-4 font-mono ${liveGlobalFloatingPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {liveGlobalFloatingPnl >= 0 ? "+" : ""}${liveGlobalFloatingPnl.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            PnL de posiciones abiertas actualmente
          </div>
        </div>

        {/* CARD 3: Valor Total (Cerrado + Flotante) */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor Total (Cuenta)</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4 font-mono">
            ${(profile.initial_balance + liveGlobalPnl + liveGlobalFloatingPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Capital inicial: ${profile.initial_balance.toLocaleString("en-US")} USD
          </div>
        </div>

        {/* CARD 4: Tasa de Acierto (WinRate) */}
        <div className="p-6 rounded-2xl bg-surface border border-surface-border relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tasa de Acierto (WinRate)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white mt-4 font-mono">
            {winRate}%
          </div>
          <div className="text-xs text-gray-400 mt-2">
            ✅ {liveGlobalWins} Ganados | ❌ {liveGlobalLosses} Perdidos
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
                    <span className={`font-bold font-mono ${item.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {item.totalPnl >= 0 ? "+" : ""}${item.totalPnl.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
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
            <AreaChart data={liveEquityHistory}>
               <defs>
                <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
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
                formatter={(value: any, name: string) => [
                  `$${Number(value).toLocaleString()} USD`,
                  name === "realized" ? "Dinero Cerrado" : "Valor con Flotante"
                ]}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="realized"
                name="realized"
                stroke="#10b981"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#realizedGradient)"
              />
              <Area
                type="monotone"
                dataKey="equity"
                name="equity"
                stroke="#8b5cf6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Positions and Trades Section */}
      <div className="space-y-8">
        {/* POSICIONES ABIERTAS EN VIVO (consulta real a Hyperliquid) */}
        <LiveCopiedPositions traders={profile.traders} userBalance={profile.cash_balance} />
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE: Posiciones Copiadas en Vivo desde Hyperliquid
// ============================================================
function LiveCopiedPositions({ traders, userBalance }: { traders: any[]; userBalance: number }) {
  const [positions, setPositions] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");
  const [filterTrader, setFilterTrader] = useState("ALL");

  const fetchLivePositions = async () => {
    setLoading(true);
    const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";
    const allPositions: any[] = [];
    const allRecentTrades: any[] = [];

    for (const t of traders) {
      try {
        const [stRes, fillsRes] = await Promise.all([
          fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "clearinghouseState", user: t.address }),
          }),
          fetch(HYPERLIQUID_INFO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "userFills", user: t.address }),
          }),
        ]);

        if (!stRes.ok) continue;
        const stData = await stRes.json();
        const fills = fillsRes.ok ? await fillsRes.json() : [];
        const traderAccountValue = parseFloat(stData?.marginSummary?.accountValue || "100000");

        // Posiciones abiertas
        const assetPositions = stData?.assetPositions || [];
        for (const p of assetPositions) {
          const pos = p.position || {};
          const szi = parseFloat(pos.szi || "0");
          const entryPx = parseFloat(pos.entryPx || "0");
          const unrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
          const coin = pos.coin || "Crypto";

          if (szi === 0 || entryPx <= 0) continue;

          // Buscar fecha apertura en fills (la más antigua para este coin)
          let openDate = "—";
          let openTimeMs = 0;
          if (Array.isArray(fills)) {
            const matchingFills = fills.filter((f: any) => f.coin === coin);
            if (matchingFills.length > 0) {
              openTimeMs = Math.min(...matchingFills.map((f: any) => f.time || 0));
              const d = new Date(openTimeMs);
              openDate = d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
            }
          }

          const resetTime = typeof window !== "undefined"
            ? parseInt(localStorage.getItem("hyperliquid_reset_timestamp") || "0")
            : 0;

          // Si se abrió antes del reinicio (o no tiene fill y hay un reinicio activo), la ignoramos por completo
          if (resetTime > 0 && (openTimeMs === 0 || openTimeMs < resetTime)) {
            continue;
          }

          const traderPosNotional = Math.abs(szi) * entryPx;
          const fraction = traderAccountValue > 0 ? traderPosNotional / traderAccountValue : 0.1;
          const userFraction = Math.min(fraction * (t.risk_multiplier || 1.0), (t.max_trade_sizing_pct || 25) / 100);
          const userCapital = userBalance * (t.allocation_pct / 100);
          const myNotional = userCapital * userFraction;
          const myLev = Math.min(pos.leverage?.value || 10, t.max_leverage || 10);
          const myMargin = myNotional / myLev;
          const myQty = myNotional / entryPx;
          const pnlFrac = traderAccountValue > 0 ? unrealizedPnl / traderAccountValue : 0;
          const myPnl = userCapital * pnlFrac;
          const myPnlPct = myMargin > 0 ? (myPnl / myMargin) * 100 : 0;

          allPositions.push({
            traderName: t.name,
            coin,
            side: szi > 0 ? "LONG" : "SHORT",
            myLev,
            myMargin,
            myNotional,
            myQty,
            entryPx,
            myPnl,
            myPnlPct,
            openDate,
          });
        }

        // Trades cerrados recientes (últimos 30)
        if (Array.isArray(fills)) {
          const resetTime = typeof window !== "undefined"
            ? parseInt(localStorage.getItem("hyperliquid_reset_timestamp") || "0")
            : 0;

          const closed = fills.filter((f: any) => {
            const isClosed = parseFloat(f.closedPnl || "0") !== 0;
            const afterReset = (f.time || 0) > resetTime;
            return isClosed && afterReset;
          }).slice(0, 30);
          for (const f of closed) {
            const pnl = parseFloat(f.closedPnl || "0");
            const pnlFrac = traderAccountValue > 0 ? pnl / traderAccountValue : 0;
            const userCapital = userBalance * (t.allocation_pct / 100);
            const myPnl = userCapital * pnlFrac;
            const d = f.time ? new Date(f.time) : new Date();

            allRecentTrades.push({
              traderName: t.name,
              coin: f.coin || "Crypto",
              dir: f.dir || "—",
              myPnl,
              time: d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
              timestamp: d.getTime(),
            });
          }
        }
      } catch {}
    }

    allRecentTrades.sort((a, b) => b.timestamp - a.timestamp);
    setPositions(allPositions);
    setRecentTrades(allRecentTrades.slice(0, 50));
    setLastRefresh(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    setLoading(false);
  };

  useEffect(() => {
    fetchLivePositions();
    const interval = setInterval(fetchLivePositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalPnl = positions.reduce((s, p) => s + p.myPnl, 0);
  const totalMargin = positions.reduce((s, p) => s + p.myMargin, 0);
  const totalPnlPct = totalMargin > 0 ? (totalPnl / totalMargin) * 100 : 0;

  return (
    <>
      {/* POSICIONES ABIERTAS EN VIVO */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Tus Posiciones Copiadas en Vivo
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
              {positions.length} activas
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-500">Actualizado: {lastRefresh}</span>
            <button onClick={fetchLivePositions} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Refrescar">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {positions.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            {loading ? "Consultando posiciones reales en Hyperliquid..." : "Sin posiciones abiertas. Tu capital está 100% en liquidez segura."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-gray-400">
                    <th className="pb-3">Activo</th>
                    <th className="pb-3">Trader</th>
                    <th className="pb-3">Lado</th>
                    <th className="pb-3 text-right">Tu Margen</th>
                    <th className="pb-3 text-right">Entrada</th>
                    <th className="pb-3 text-right">Tu PnL</th>
                    <th className="pb-3 text-right">📅 Fecha Apertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {positions.map((pos, idx) => (
                    <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 font-bold text-white">{pos.coin}</td>
                      <td className="py-3 text-gray-400 text-[11px]">{pos.traderName}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${pos.side === "LONG" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {pos.side} {pos.myLev}x
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-gray-300">${pos.myMargin.toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-white">${pos.entryPx.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className={`py-3 text-right font-mono font-bold ${pos.myPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {pos.myPnl >= 0 ? "+" : ""}${pos.myPnl.toFixed(2)} <span className="text-[10px] opacity-70">({pos.myPnlPct >= 0 ? "+" : ""}{pos.myPnlPct.toFixed(1)}%)</span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-gray-400">{pos.openDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RESUMEN TOTAL FLOTANTE */}
            <div className={`mt-2 p-4 rounded-xl border ${totalPnl >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white">📊 Total Flotante de tu Cartera:</div>
                <div className={`text-lg font-extrabold font-mono ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USD
                  <span className="text-xs ml-1 opacity-70">({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>💰 Margen en Uso: <b className="text-white">${totalMargin.toFixed(2)}</b></span>
                <span>💵 Liquidez Libre: <b className="text-white">${(userBalance - totalMargin).toFixed(2)}</b></span>
                <span>🏦 Valor Cartera: <b className="text-white">${(userBalance + totalPnl).toFixed(2)}</b></span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* HISTORIAL DE TRADES CERRADOS RECIENTES DE LOS TRADERS */}
      {recentTrades.length > 0 && (() => {
        const filteredRecentTrades = recentTrades.filter(
          (t) => filterTrader === "ALL" || t.traderName.toLowerCase() === filterTrader.toLowerCase()
        );

        return (
          <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white">📜 Historial Reciente de Operaciones Cerradas (Copy Estimado)</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Últimos trades cerrados por los traders de tu cesta, con el PnL estimado según tu asignación de capital.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Filtrar:</span>
                <select
                  value={filterTrader}
                  onChange={(e) => setFilterTrader(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-background border border-surface-border text-white text-xs focus:outline-none focus:border-primary"
                >
                  <option value="ALL">Todos los Traders</option>
                  {traders.map((t, idx) => (
                    <option key={idx} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredRecentTrades.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No hay operaciones registradas para este filtro.
                </div>
              ) : (
                filteredRecentTrades.map((trade, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-background/60 border border-surface-border flex items-center justify-between hover:border-gray-700 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${trade.myPnl >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                        {trade.myPnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white">{trade.coin} <span className="text-xs font-normal text-gray-400">• {trade.traderName}</span></div>
                        <div className="text-[10px] text-gray-500">{trade.time} • {trade.dir}</div>
                      </div>
                    </div>
                    <div className={`font-bold text-sm font-mono ${trade.myPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {trade.myPnl >= 0 ? "+" : ""}${trade.myPnl.toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
