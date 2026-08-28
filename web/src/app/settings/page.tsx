"use client";

import { useEffect, useState } from "react";
import { Bell, Send, CheckCircle2, AlertTriangle, RefreshCw, MessageSquare } from "lucide-react";
import { getStoredProfile, updateTelegramChatId, resetProfile } from "@/lib/storage";
import { UserProfile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatId, setChatId] = useState("");
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const p = getStoredProfile();
    setProfile(p);
    setChatId(p.telegram_chat_id || "");
  }, []);

  if (!profile) return null;

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = updateTelegramChatId(chatId.trim());
    setProfile({ ...updated });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTestTelegram = async () => {
    if (!chatId.trim()) {
      setTestResult({ success: false, msg: "Introduce primero tu Chat ID de Telegram." });
      return;
    }
    setTestingTelegram(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, msg: "¡Mensaje de prueba entregado con éxito a tu Telegram!" });
      } else {
        setTestResult({
          success: false,
          msg: `Error: ${data.error}. Recuerda iniciar el chat con el bot antes de recibir mensajes.`,
        });
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: `Error de conexión: ${e.message}` });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleResetPortfolio = () => {
    if (confirm("¿Estás seguro de que deseas reiniciar tu saldo a $10,000 USD y borrar el historial simulado?")) {
      const fresh = resetProfile();
      setProfile({ ...fresh });
      alert("Cartera reiniciada a $10,000 USD.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-surface-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Ajustes & Alertas</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configura tus notificaciones en tiempo real por Telegram y la gestión de tu cuenta.
        </p>
      </div>

      {/* Telegram Alerts Config Card */}
      <div className="p-6 rounded-2xl bg-surface border border-surface-border space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Alertas en Tiempo Real por Telegram</h2>
              <p className="text-xs text-gray-400">Recibe un aviso al instante cada vez que se ejecute una orden.</p>
            </div>
          </div>
          {saveSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </span>
          )}
        </div>

        {/* How to get Chat ID box */}
        <div className="p-4 rounded-xl bg-background/60 border border-surface-border text-xs text-gray-300 space-y-2">
          <div className="font-bold text-white">¿Cómo obtener tu Chat ID en 30 segundos?</div>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Abre Telegram y busca el bot oficial de alertas o dale a <strong>/start</strong>.</li>
            <li>Busca a <strong>@userinfobot</strong> en Telegram para ver tu número de <strong>Id</strong> (ej. <code className="text-emerald-400">123456789</code>).</li>
            <li>Pega tu número de ID en la casilla inferior y pulsa guardar.</li>
          </ol>
        </div>

        <form onSubmit={handleSaveTelegram} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">Tu Telegram Chat ID</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="Ejemplo: 987654321"
                className="flex-1 px-4 py-2.5 rounded-lg bg-background border border-surface-border text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary font-mono"
              />
              <button
                type="submit"
                className="py-2.5 px-6 rounded-lg bg-primary text-black font-bold text-xs hover:bg-primary-hover transition-all"
              >
                Guardar ID
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="py-2 px-4 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 font-semibold text-xs hover:bg-blue-600/30 transition-all flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              {testingTelegram ? "Enviando alerta..." : "Enviar Alerta de Prueba a mi Telegram"}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{testResult.msg}</span>
            </div>
          )}
        </form>
      </div>

      {/* Danger Zone / Reset Portfolio */}
      <div className="p-6 rounded-2xl bg-surface border border-red-500/20 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" /> Zona de Reinicio
        </h2>
        <p className="text-xs text-gray-400">
          Si deseas reiniciar todas tus estadísticas simuladas y restablecer tu saldo inicial a <strong>$10,000 USD</strong>.
        </p>
        <button
          onClick={handleResetPortfolio}
          className="py-2.5 px-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-xs transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reiniciar mi Cartera a $10,000 USD
        </button>
      </div>
    </div>
  );
}
