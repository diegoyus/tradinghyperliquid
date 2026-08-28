"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, Lock, Mail, ArrowRight, UserPlus, Sparkles } from "lucide-react";
import { getStoredProfile, saveStoredProfile } from "@/lib/storage";

export default function AuthPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulación de autenticación (funciona instantáneamente en demo / local y en Firebase)
    setTimeout(() => {
      const profile = getStoredProfile();
      profile.email = email || "inversor@copytrading.com";
      profile.name = name || (isRegister ? "Nuevo Usuario" : profile.name);
      saveStoredProfile(profile);
      router.push("/dashboard");
    }, 400);
  };

  const handleDemoAccess = () => {
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 200);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 p-8 rounded-2xl bg-surface border border-surface-border backdrop-blur-xl relative z-10 shadow-2xl">
        <div className="text-center">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary/20 border border-primary items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {isRegister ? "Crear cuenta gratuita" : "Bienvenido de nuevo"}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {isRegister
              ? "Empieza con $10,000 USD simulados en segundos"
              : "Accede a tu panel de copy trading en Hyperliquid"}
          </p>
        </div>

        {/* Demo Fast Access Button */}
        <button
          onClick={handleDemoAccess}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-sm hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          Acceso Rápido Demo (1-Click)
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-surface-border w-full" />
          <span className="bg-surface px-3 text-xs text-gray-400 uppercase">o con tu email</span>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">Nombre</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu Nombre o Alias"
                className="w-full px-4 py-2.5 rounded-lg bg-background border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1">Contraseña</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-surface-border text-white placeholder-gray-500 focus:outline-none focus:border-primary text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 px-4 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Entrando..." : isRegister ? "Registrarme" : "Iniciar Sesión"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
          >
            {isRegister
              ? "¿Ya tienes cuenta? Inicia sesión aquí"
              : "¿No tienes cuenta? Regístrate gratis"}
          </button>
        </div>
      </div>
    </div>
  );
}
