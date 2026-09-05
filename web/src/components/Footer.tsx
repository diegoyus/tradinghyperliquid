"use client";

import { useState } from "react";
import {
  APP_VERSION,
  LAST_DEPLOY_DATE,
  DEPLOY_COMMIT,
  DEPLOY_ENV,
  DEPLOY_HISTORY,
  VersionChange
} from "@/lib/version";
import { GitCommit, Clock, RefreshCw, History, X, CheckCircle2, Sparkles } from "lucide-react";

export default function Footer() {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleForceRefresh = () => {
    setIsRefreshing(true);
    if (typeof window !== "undefined") {
      try {
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      } catch (e) {}
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  return (
    <>
      <footer className="border-t border-surface-border/60 bg-surface/30 backdrop-blur-sm mt-auto py-5 px-4 sm:px-6 lg:px-8 text-xs text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3.5 text-center sm:text-left">
          
          {/* Info Principal y Estado de Producción */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-[11px]">
            <span className="text-gray-300 font-medium">Hyperliquid DEX Copy Trading</span>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {DEPLOY_ENV}
            </span>
          </div>

          {/* Control de Versión y Fecha de Último Deploy */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-[11px]">
            {/* Tag de Versión */}
            <div className="inline-flex items-center gap-1.5 bg-background/80 px-2 py-0.5 rounded-md border border-surface-border text-gray-200 font-mono font-bold">
              <GitCommit className="w-3 h-3 text-primary" />
              <span>{APP_VERSION}</span>
              <span className="text-gray-500 text-[9px]">({DEPLOY_COMMIT})</span>
            </div>

            {/* Fecha del último despliegue */}
            <div className="inline-flex items-center gap-1 text-gray-400 text-[11px] font-mono" title="Fecha y hora del último despliegue a producción">
              <Clock className="w-3 h-3 text-amber-400/80 shrink-0" />
              <span className="text-gray-500">Deploy:</span>
              <span className="text-gray-300 font-semibold">{LAST_DEPLOY_DATE}</span>
            </div>

            {/* Botón para ver Changelog histórico */}
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-surface-border text-gray-300 hover:text-white border border-surface-border transition-colors text-[10px] font-medium"
              title="Ver cambios de cada versión"
            >
              <History className="w-3 h-3 text-blue-400" />
              <span>Cambios</span>
            </button>

            {/* Botón para forzar actualización y evitar caché móvil */}
            <button
              type="button"
              onClick={handleForceRefresh}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface hover:bg-surface-border text-gray-400 hover:text-white border border-surface-border transition-colors text-[10px]"
              title="Recargar página para asegurar la última versión de producción"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-400 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden xs:inline">Actualizar</span>
            </button>
          </div>

        </div>
      </footer>

      {/* Modal de Historial de Versiones */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl bg-surface border border-surface-border shadow-2xl p-6 text-left max-h-[85vh] flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-surface-border/70 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Historial de Despliegues</h3>
                  <p className="text-xs text-gray-400">Control de versiones y mejoras en producción</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface-border transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Versión Actual Destacada */}
            <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white">Versión Activa Actual:</span>
                <span className="text-xs font-mono font-black text-emerald-300 bg-black/40 px-2 py-0.5 rounded border border-emerald-500/30">
                  {APP_VERSION}
                </span>
              </div>
              <span className="text-[10px] font-mono text-gray-400">{LAST_DEPLOY_DATE}</span>
            </div>

            {/* Lista de Versiones */}
            <div className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
              {DEPLOY_HISTORY.map((item, idx) => (
                <div
                  key={item.version}
                  className={`p-4 rounded-2xl border ${
                    idx === 0
                      ? "bg-surface-border/20 border-surface-border"
                      : "bg-surface-border/10 border-surface-border/50 text-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-white bg-background px-2 py-0.5 rounded border border-surface-border">
                        {item.version}
                      </span>
                      <span className="text-xs font-bold text-gray-100">{item.title}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{item.date}</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-gray-300 pl-1">
                    {item.details.map((detail, dIdx) => (
                      <li key={dIdx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-relaxed">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer Modal */}
            <div className="mt-5 pt-4 border-t border-surface-border/70 flex items-center justify-between">
              <span className="text-[10px] text-gray-500 font-mono">
                Deploy commit: {DEPLOY_COMMIT} • {DEPLOY_ENV}
              </span>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary-hover transition-colors"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
