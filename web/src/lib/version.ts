/**
 * Control de Versiones y Despliegues de HyperCopy
 * Actualizado automáticamente en cada versión y despliegue de producción.
 */
export const APP_VERSION = "v2.5.0";
export const LAST_DEPLOY_DATE = "5 de Septiembre de 2026, 12:35 CEST";
export const DEPLOY_COMMIT = "b84f3e9";
export const DEPLOY_ENV = "Producción (Vercel Edge)";

export interface VersionChange {
  version: string;
  date: string;
  title: string;
  details: string[];
}

export const DEPLOY_HISTORY: VersionChange[] = [
  {
    version: "v2.5.0",
    date: "05/09/2026, 12:35",
    title: "Optimización UX Mobile-First & Footer de Versiones",
    details: [
      "Eliminado texto del logo en el header para liberar ancho en móvil.",
      "Menú hamburguesa 100% visible en móvil, sin desborde horizontal.",
      "Footer inferior discreto con versión y fecha exacta del último deploy.",
      "Diseño adaptable sin scroll horizontal accidental."
    ]
  },
  {
    version: "v2.4.0",
    date: "05/09/2026, 11:55",
    title: "Correlación Gráfica 100% Exacta & Estadísticas Cuantitativas",
    details: [
      "Correlación matemática perfecta de la curva de capital con el saldo actual.",
      "Notificaciones de Telegram con margen real invertido y % ROI exacto al cerrar.",
      "Nueva sección de estadísticas de rendimiento (ROI %, PnL absoluto, media/trade, diario).",
      "Bloqueo de zoom táctil accidental en dispositivos móviles (solo desplazamiento)."
    ]
  },
  {
    version: "v2.3.0",
    date: "04/09/2026, 19:30",
    title: "Guía Interactiva de Fondeo & Requisitos de Red",
    details: [
      "Calculadora de reparto de fondos y comparativa de plataformas de intercambio.",
      "Separación estricta de carteras y órdenes entre Modo Real y Modo Simulado."
    ]
  }
];
