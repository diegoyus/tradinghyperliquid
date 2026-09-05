"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Search,
  Settings,
  LogOut,
  Activity,
  GraduationCap,
  History,
  Crown,
  User,
  Menu,
  X,
  BookOpen,
  ChevronRight
} from "lucide-react";
import { getStoredProfile, isSuperAdmin, updateTradingMode } from "@/lib/storage";
import { UserProfile } from "@/lib/types";
import { APP_VERSION, LAST_DEPLOY_DATE } from "@/lib/version";

export default function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(true);
  const [modeNotice, setModeNotice] = useState<string | null>(null);

  useEffect(() => {
    const p = getStoredProfile();
    setProfile(p);

    if (typeof window !== "undefined") {
      const completed = localStorage.getItem("hyperliquid_tour_completed") === "true";
      setIsTourCompleted(completed);

      const handleTourChange = () => {
        setIsTourCompleted(localStorage.getItem("hyperliquid_tour_completed") === "true");
      };

      const handleModeChange = (e: any) => {
        const currentP = getStoredProfile();
        setProfile({ ...currentP, trading_mode: e.detail });
      };

      window.addEventListener("tour-status-changed", handleTourChange);
      window.addEventListener("trading-mode-changed", handleModeChange);

      // Auto-sync perfil con Telegram
      if (p.telegram_chat_id) {
        fetch("/api/telegram/sync-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: p.telegram_chat_id, profile: p }),
        }).catch(() => {});
      }

      return () => {
        window.removeEventListener("tour-status-changed", handleTourChange);
        window.removeEventListener("trading-mode-changed", handleModeChange);
      };
    }
  }, [pathname]);

  const handleSwitchMode = (mode: "DEMO" | "REAL") => {
    const updated = updateTradingMode(mode);
    setProfile({ ...updated });
    if (mode === "REAL") {
      if (!updated.wallet_address) {
        setModeNotice("🔵 Modo Real activado. Conecta tu billetera en Ajustes para ver tu saldo real.");
      } else {
        setModeNotice("🔵 Modo Real activado. Mostrando datos de tu billetera Hyperliquid.");
      }
    } else {
      setModeNotice("🟢 Modo Simulado activado (Paper Trading con $10,000 USD).");
    }
    setTimeout(() => setModeNotice(null), 4000);
  };

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isAdmin = profile?.email && isSuperAdmin(profile.email);

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tourKey: "nav-dashboard" },
    { href: "/traders", label: "Traders", icon: Users, tourKey: "nav-traders" },
    { href: "/history", label: "Historial", icon: History, tourKey: "nav-history" },
    { href: "/analytics", label: "Analizador", icon: Search, tourKey: "nav-analytics" },
    { href: "/guide", label: "Guía", icon: BookOpen, tourKey: "nav-guide" },
    { href: "/settings", label: "Ajustes", icon: Settings, tourKey: "nav-settings" },
  ];

  if (pathname === "/" || pathname === "/auth") {
    return null;
  }

  const handleStartInteractiveTour = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("start-interactive-tour"));
    }
  };

  const isReal = profile?.trading_mode === "REAL";

  return (
    <nav className="border-b border-surface-border bg-background/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          
          {/* 1. Brand Logo: Solo Icono + Badge de Entorno (Sin texto de nombre para optimizar espacio en móvil) */}
          <div className="flex items-center gap-2 shrink-0">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 group transition-transform active:scale-95" 
              title="Ir al Dashboard"
            >
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shadow-sm transition-all group-hover:scale-105 ${
                isReal 
                  ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-blue-500/20" 
                  : "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-emerald-500/20"
              }`}>
                <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5 animate-pulse" />
              </div>

              {/* Badge de Entorno Compacto */}
              {isReal ? (
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-black border border-blue-500/40 animate-pulse flex items-center gap-1 shadow-sm shadow-blue-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>REAL</span>
                </span>
              ) : (
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-black border border-emerald-500/30 flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="hidden sm:inline">SIMULADO</span>
                  <span className="sm:hidden">SIM</span>
                </span>
              )}
            </Link>
          </div>

          {/* 2. Navigation Links (Desktop lg+) */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-tour={link.tourKey}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/40 shadow-sm"
                      : "text-gray-400 hover:text-gray-100 hover:bg-surface/80"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Link Exclusivo Superadmin */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  pathname === "/admin"
                    ? "bg-amber-400 text-black shadow-md shadow-amber-400/20"
                    : "bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25"
                }`}
                title="Panel Superadministrador"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Superadmin</span>
              </Link>
            )}
          </div>

          {/* 3. Right Section: Switcher de Entorno, Tour, Perfil y Hamburguesa */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* BOTÓN SELECTOR DE ENTORNO (SIMULADO / REAL) */}
            <div className="flex items-center bg-surface/90 border border-surface-border p-0.5 rounded-xl shadow-inner shrink-0">
              <button
                type="button"
                onClick={() => handleSwitchMode("DEMO")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  !isReal
                    ? "bg-emerald-500 text-black shadow-sm shadow-emerald-500/30 font-black"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title="Entorno Simulado (Paper Trading)"
              >
                <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${!isReal ? "bg-black" : "bg-emerald-500"}`} />
                <span className="hidden sm:inline">Simulado</span>
                <span className="sm:hidden">Sim</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode("REAL")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  isReal
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400 font-black"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title="Entorno Real (Hyperliquid Mainnet)"
              >
                <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${isReal ? "bg-cyan-300 animate-pulse" : "bg-blue-500"}`} />
                <span>Real</span>
              </button>
            </div>
            
            {/* Botón de Tour: En Desktop */}
            {!isTourCompleted && (
              <button
                onClick={handleStartInteractiveTour}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-400/15 text-amber-300 border border-amber-400/30 text-xs font-bold hover:bg-amber-400/25 transition-all shadow-sm shadow-amber-400/10 animate-pulse shrink-0"
                title="Iniciar Tour Guiado Interactivo"
              >
                <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                <span>Tour</span>
              </button>
            )}

            {/* Identificador de Usuario Logueado (En Desktop/Tablet sm+) */}
            {profile ? (
              <Link
                href="/settings"
                className="hidden sm:flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-surface/80 hover:bg-surface border border-surface-border hover:border-primary/40 transition-all text-xs group shrink-0"
                title={`Sesión activa: ${profile.name || profile.email} (${profile.email})`}
              >
                <div className="relative shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs uppercase shadow-sm ${
                    isAdmin 
                      ? "bg-amber-400 text-black shadow-amber-400/20" 
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}>
                    {profile.name ? profile.name.charAt(0) : profile.email?.charAt(0) || "U"}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-background" />
                </div>

                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-white group-hover:text-primary transition-colors leading-tight truncate max-w-[90px] md:max-w-[130px]">
                      {profile.name || profile.email?.split("@")[0] || "Usuario"}
                    </span>
                    {isAdmin ? (
                      <span className="px-1 py-0.1 rounded bg-amber-400/20 text-amber-300 font-extrabold text-[8px] border border-amber-400/40">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-1 py-0.1 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[8px]">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 font-mono leading-tight truncate max-w-[90px] md:max-w-[130px]">
                    {profile.email}
                  </span>
                </div>
              </Link>
            ) : (
              <Link
                href="/auth"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary-hover shadow-md shadow-primary/20 transition-all shrink-0"
              >
                <User className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </Link>
            )}

            {/* Botón Salir (En Desktop sm+) */}
            <Link
              href="/auth"
              className="hidden sm:flex p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </Link>

            {/* Botón Hamburguesa para Móvil / Tablet (< lg) - Siempre visible y nunca escondido */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-gray-200 hover:text-white bg-surface/80 hover:bg-surface border border-surface-border transition-all active:scale-95 shrink-0 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10"
              aria-label={mobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>
        </div>
      </div>

      {/* Menú Desplegable Móvil / Tablet (100% de ancho y accesible) */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-surface-border bg-surface/98 backdrop-blur-2xl px-4 py-4 space-y-3.5 shadow-2xl animate-fadeIn max-h-[85vh] overflow-y-auto">
          
          {/* Tarjeta de Perfil en Móvil */}
          {profile ? (
            <div className="p-3 rounded-2xl bg-background/80 border border-surface-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-sm ${
                  isAdmin 
                    ? "bg-amber-400 text-black shadow-amber-400/20" 
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}>
                  {profile.name ? profile.name.charAt(0) : profile.email?.charAt(0) || "U"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs truncate">
                      {profile.name || profile.email?.split("@")[0] || "Usuario"}
                    </span>
                    {isAdmin ? (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-extrabold text-[8px] border border-amber-400/40">
                        ADMIN
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold text-[8px]">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono block truncate">
                    {profile.email}
                  </span>
                </div>
              </div>

              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-border border border-surface-border text-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <span>Ajustes</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </Link>
            </div>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-primary text-black font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary/20"
            >
              <User className="w-4 h-4" />
              <span>Iniciar Sesión</span>
            </Link>
          )}

          {/* Switch de Entorno Táctil Grande en Móvil */}
          <div className="p-3 rounded-2xl bg-background/80 border border-surface-border space-y-2">
            <span className="text-[11px] font-bold text-gray-400 block">Modo de Operación:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSwitchMode("DEMO");
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-center ${
                  !isReal
                    ? "bg-emerald-500/15 border-emerald-500/50 text-white shadow-sm shadow-emerald-500/10"
                    : "bg-surface border-surface-border text-gray-400 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className={!isReal ? "text-emerald-300" : ""}>Simulado</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5">$10,000 virtuales</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSwitchMode("REAL");
                  setMobileMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-center ${
                  isReal
                    ? "bg-blue-600/20 border-blue-500/60 text-white shadow-sm shadow-blue-500/10"
                    : "bg-surface border-surface-border text-gray-400 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs">
                  <span className={`w-2 h-2 rounded-full ${isReal ? "bg-cyan-300 animate-pulse" : "bg-blue-400"}`} />
                  <span className={isReal ? "text-blue-300" : ""}>Modo Real</span>
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5">Billetera Mainnet</span>
              </button>
            </div>
          </div>

          {/* Enlaces de Navegación con Área Táctil Cómoda */}
          <div className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                      : "text-gray-300 hover:text-white hover:bg-background/80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-gray-400"}`} />
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </Link>
              );
            })}

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-sm shadow-amber-400/10"
              >
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>Panel Superadmin</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
              </Link>
            )}
          </div>

          {/* Acciones Secundarias y Logout */}
          <div className="pt-3 border-t border-surface-border/70 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleStartInteractiveTour();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 text-xs font-bold hover:bg-amber-400/20 transition-all"
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span>Ver Tour Guiado</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400/60" />
            </button>

            <Link
              href="/auth"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </Link>
          </div>

          {/* Pie del menú móvil con versión */}
          <div className="pt-2 text-center text-[10px] text-gray-500 font-mono">
            HyperCopy {APP_VERSION} • Deploy: {LAST_DEPLOY_DATE.split(",")[0]}
          </div>

        </div>
      )}

      {/* Banner de Feedback de Cambio de Modo */}
      {modeNotice && (
        <div className={`px-4 py-2 text-xs font-bold text-center border-t border-b flex items-center justify-center gap-2 animate-fadeIn transition-colors ${
          isReal 
            ? "bg-blue-950/90 text-blue-300 border-blue-800/60 shadow-lg shadow-blue-950/50" 
            : "bg-emerald-950/90 text-emerald-300 border-emerald-800/60 shadow-lg shadow-emerald-950/50"
        }`}>
          <span>{modeNotice}</span>
        </div>
      )}
    </nav>
  );
}
