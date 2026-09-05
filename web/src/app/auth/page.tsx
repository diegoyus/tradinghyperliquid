"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, Lock, Mail, ArrowRight, UserPlus, Sparkles, ShieldCheck, CheckCircle2, Clock } from "lucide-react";
import { getStoredProfile, saveStoredProfile, syncUserToRegistry, isSuperAdmin, getAllUsers, DEFAULT_GLOBAL_RISK } from "@/lib/storage";
import { getUserProfileFromCloud, saveUserProfileToCloud } from "@/lib/cloudSync";
import { UserProfile } from "@/lib/types";

export default function AuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false); // Default to login so returning users dont get reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);

  // Leer parámetros de URL (?email=...&redirect=...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setEmail(emailParam.trim());
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const isSuper = isSuperAdmin(cleanEmail);

      // 1. PRIMERO: Buscar en Firebase Cloud Firestore (con timeout de 1.2s para evitar bloqueos)
      let cloudUser: UserProfile | null = null;
      try {
        cloudUser = await Promise.race([
          getUserProfileFromCloud(cleanEmail),
          new Promise<null>((res) => setTimeout(() => res(null), 1200))
        ]);
      } catch (err) {
        console.warn("Error leyendo de la nube:", err);
      }

      // 2. Si no está en cloud, buscar en el registro local
      const allUsers = getAllUsers();
      let existingUser = cloudUser || allUsers.find(
        (u) => u.email && u.email.toLowerCase() === cleanEmail
      );

      // Si no está en allUsers, buscar en la clave de respaldo por correo
      if (!existingUser && typeof window !== "undefined") {
        const backupRaw = localStorage.getItem(`hyperliquid_profile_${cleanEmail}`);
        if (backupRaw) {
          try {
            existingUser = JSON.parse(backupRaw);
          } catch {}
        }
      }

      let profile: UserProfile;

      if (existingUser) {
        // RESTAURAR perfil existente intacto con TODOS sus traders y ajustes
        profile = {
          ...existingUser,
          email: cleanEmail,
          role: isSuper ? "SUPERADMIN" : existingUser.role || "USER",
          status: isSuper ? "ACTIVE" : existingUser.status || "ACTIVE",
          last_active: new Date().toISOString(),
        };
      } else {
        // Usuario nuevo que no existía previamente
        const newUserId = isSuper ? "admin_diego" : `user_${Date.now()}`;
        const userRole = isSuper ? "SUPERADMIN" : "USER";
        const userStatus = isSuper ? "ACTIVE" : "PENDING_APPROVAL";
        const emailUsername = cleanEmail.split("@")[0] || "Inversor";
        const displayName = isSuper ? "Diego Yus (Superadmin)" : emailUsername;

        profile = {
          id: newUserId,
          email: cleanEmail,
          name: displayName,
          role: userRole,
          status: userStatus,
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          telegram_chat_id: "",
          initial_balance: 10000.0,
          cash_balance: 10000.0,
          realized_pnl: 0.0,
          peak_balance: 10000.0,
          traders: [],
          global_risk: { ...DEFAULT_GLOBAL_RISK },
          positions: {},
          trade_history: [],
          equity_history: [{ time: "Inicio", balance: 10000.0 }],
          stats: { total_trades: 0, winning_trades: 0, losing_trades: 0 },
        };

      }

      // Guardar en almacenamiento local
      saveStoredProfile(profile);
      syncUserToRegistry(profile);

      // Guardar en la nube Firestore con espera segura
      try {
        await Promise.race([
          saveUserProfileToCloud(profile),
          new Promise((res) => setTimeout(res, 2000)),
        ]);
      } catch (err) {
        console.warn("Fallo guardando en la nube:", err);
      }

      // Si es un usuario nuevo, notificar y persistir también vía el endpoint del servidor
      if (!existingUser && !isSuper) {
        try {
          await fetch("/api/auth/register-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: profile.name,
              email: profile.email,
              userId: profile.id,
              profile,
            }),
          });
        } catch (notifyErr) {
          console.warn("Error en register-notify:", notifyErr);
        }
      }

      // Sincronizar automáticamente con el webhook de Telegram si tiene Chat ID
      if (profile.telegram_chat_id) {
        fetch("/api/telegram/sync-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
        }).catch(() => {});
      }

      let targetDestination = "/dashboard";
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        targetDestination = params.get("redirect") || "/dashboard";
      }

      if (!existingUser && !isSuper) {
        setPendingNotice(true);
        setTimeout(() => {
          window.location.href = targetDestination;
        }, 1800);
      } else {
        window.location.href = targetDestination;
      }
    } catch (err) {
      console.error("Error en login:", err);
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 p-8 rounded-3xl bg-surface border border-surface-border backdrop-blur-xl relative z-10 shadow-2xl">
        <div className="text-center">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-primary/20 border border-primary/40 items-center justify-center mb-3 shadow-md shadow-primary/10">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-white">
            {isRegister ? "Crear Cuenta de Copy Trading" : "Iniciar Sesión"}
          </h2>
          <p className="mt-2 text-xs text-gray-400">
            {isRegister
              ? "Empieza con $10,000 USD limpios y 0 traders asignados para elegir a los mejores"
              : "Accede a tu panel y gestión de cartera en Hyperliquid"}
          </p>
        </div>

        {/* Notificación de Validación Telegram */}
        {pendingNotice && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-1 animate-slideUp">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>¡Cuenta creada con éxito!</span>
            </div>
            <p className="text-[11px] text-gray-300">
              Se ha enviado una notificación de validación al Superadministrador por Telegram para aprobar tu acceso.
            </p>
          </div>
        )}

        {/* Formulario */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm font-medium"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background/60 border border-surface-border/70 text-[11px] text-gray-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Tus fondos virtuales ($10,000 USD) se inicializan inmediatamente al registrarte.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-primary text-black font-black text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Preparando Cartera..." : isRegister ? "Registrarme y Empezar" : "Entrar a mi Panel"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-surface-border/50">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-gray-400 hover:text-primary transition-colors font-semibold"
          >
            {isRegister
              ? "¿Ya tienes cuenta creada? Inicia sesión aquí"
              : "¿Eres nuevo? Crea tu cuenta con $10,000 gratis"}
          </button>
        </div>
      </div>
    </div>
  );
}
