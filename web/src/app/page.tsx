import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, LineChart, BellRing, Cpu } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden bg-background">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          100% Simulado en Tiempo Real • Hyperliquid DEX
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Copia a los Mejores Traders de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Hyperliquid</span> en Automático
        </h1>
        
        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
          Crea tu cuenta gratuita con <strong>$10,000 USD virtuales</strong>, elige tu cesta de traders ganadores, asigna porcentajes y recibe alertas instantáneas en tu Telegram.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/auth"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-black font-bold text-base hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group"
          >
            Comenzar a Simular Gratis
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-surface-border bg-surface text-gray-200 font-semibold text-base hover:bg-gray-800 transition-colors"
          >
            Ver Dashboard Demo
          </Link>
        </div>

        {/* Live Metrics Ticker Banner */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-xl bg-surface/60 border border-surface-border backdrop-blur-sm">
            <div className="text-gray-400 text-xs font-medium uppercase">Traders Analizados</div>
            <div className="text-2xl font-bold text-white mt-1">43,000+</div>
            <div className="text-xs text-emerald-400 mt-1">Leaderboard en vivo</div>
          </div>
          <div className="p-4 rounded-xl bg-surface/60 border border-surface-border backdrop-blur-sm">
            <div className="text-gray-400 text-xs font-medium uppercase">Tasa de Acierto Top</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">96.9%</div>
            <div className="text-xs text-gray-400 mt-1">El Francotirador</div>
          </div>
          <div className="p-4 rounded-xl bg-surface/60 border border-surface-border backdrop-blur-sm">
            <div className="text-gray-400 text-xs font-medium uppercase">Velocidad de Réplica</div>
            <div className="text-2xl font-bold text-white mt-1">&lt; 200 ms</div>
            <div className="text-xs text-emerald-400 mt-1">WebSocket directo</div>
          </div>
          <div className="p-4 rounded-xl bg-surface/60 border border-surface-border backdrop-blur-sm">
            <div className="text-gray-400 text-xs font-medium uppercase">Coste de Uso</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">$0</div>
            <div className="text-xs text-gray-400 mt-1">100% Gratuito</div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-surface-border">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12">
          Todo lo que necesitas para aprender y ganar
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-surface border border-surface-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Cesta Multi-Trader Inteligente</h3>
            <p className="text-sm text-gray-400">
              No pongas todos los huevos en una sola cesta. Asigna porcentajes personalizados a varios traders profesionales a la vez.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-surface-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <LineChart className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Estadísticas y Curva de Capital</h3>
            <p className="text-sm text-gray-400">
              Visualiza en gráficos interactivos cómo crece tu saldo ficticio, tu Win Rate y el rendimiento individual de cada trader copiado.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-surface-border hover:border-primary/50 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <BellRing className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Alertas Instantáneas por Telegram</h3>
            <p className="text-sm text-gray-400">
              Vincula tu cuenta con nuestro bot oficial de Telegram y recibe avisos en tu móvil cada vez que tus traders abran o cierren posiciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
