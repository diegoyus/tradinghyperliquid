import { UserProfile, TraderConfig, GlobalRiskSettings } from "./types";

export const DEFAULT_GLOBAL_RISK: GlobalRiskSettings = {
  circuit_breaker_pct: 15.0,
  emergency_stop_enabled: true,
  max_global_leverage: 10,
};

export const DEFAULT_TRADERS: TraderConfig[] = [
  {
    name: "El Francotirador",
    score: "9.8/10",
    address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06",
    allocation_pct: 40.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
    stop_loss_pct: 5.0,
    max_trade_sizing_pct: 25.0,
  },
  {
    name: "Sticky (Scalping)",
    score: "9.3/10",
    address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe",
    allocation_pct: 30.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
    stop_loss_pct: 6.0,
    max_trade_sizing_pct: 20.0,
  },
  {
    name: "Macro / Acciones",
    score: "8.9/10",
    address: "0xb6db1b4dc6244f86e482d834739d949d799e4da5",
    allocation_pct: 20.0,
    risk_multiplier: 0.8,
    max_leverage: 5,
    stop_loss_pct: 8.0,
    max_trade_sizing_pct: 20.0,
  },
  {
    name: "Especialista SOL",
    score: "8.5/10",
    address: "0xab7fb756330e3983e676f44c03dabda9120aa273",
    allocation_pct: 10.0,
    risk_multiplier: 0.8,
    max_leverage: 5,
    stop_loss_pct: 7.0,
    max_trade_sizing_pct: 15.0,
  },
];

const INITIAL_PROFILE: UserProfile = {
  id: "user_demo",
  email: "demo@copytrading.com",
  name: "Usuario Inversor",
  telegram_chat_id: "",
  initial_balance: 10000.0,
  cash_balance: 10000.0,
  realized_pnl: 0.0,
  peak_balance: 10000.0,
  traders: DEFAULT_TRADERS,
  global_risk: DEFAULT_GLOBAL_RISK,
  positions: {},
  trade_history: [],
  equity_history: [
    { time: "Inicio", balance: 10000.0 },
  ],
  stats: {
    total_trades: 0,
    winning_trades: 0,
    losing_trades: 0,
  },
};

const STORAGE_KEY = "hyperliquid_copy_user_profile_v2";

export function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") return INITIAL_PROFILE;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROFILE));
    return INITIAL_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.global_risk) {
      parsed.global_risk = DEFAULT_GLOBAL_RISK;
    }
    parsed.traders = (parsed.traders || []).map((t: any) => ({
      ...t,
      stop_loss_pct: t.stop_loss_pct ?? 5.0,
      max_trade_sizing_pct: t.max_trade_sizing_pct ?? 25.0,
      risk_multiplier: t.risk_multiplier ?? 1.0,
      max_leverage: t.max_leverage ?? 10,
    }));
    return parsed;
  } catch (e) {
    return INITIAL_PROFILE;
  }
}

export function saveStoredProfile(profile: UserProfile): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }
}

export function updateTradersConfig(traders: TraderConfig[]): UserProfile {
  const profile = getStoredProfile();
  profile.traders = traders;
  saveStoredProfile(profile);
  return profile;
}

export function updateGlobalRisk(risk: GlobalRiskSettings): UserProfile {
  const profile = getStoredProfile();
  profile.global_risk = risk;
  saveStoredProfile(profile);
  return profile;
}

export function updateTelegramChatId(chatId: string): UserProfile {
  const profile = getStoredProfile();
  profile.telegram_chat_id = chatId;
  saveStoredProfile(profile);
  return profile;
}

export function resetProfile(): UserProfile {
  const fresh: UserProfile = {
    ...INITIAL_PROFILE,
    initial_balance: 10000.0,
    cash_balance: 10000.0,
    realized_pnl: 0.0,
    peak_balance: 10000.0,
    positions: {},
    trade_history: [],
    equity_history: [{ time: "Inicio", balance: 10000.0 }],
    stats: { total_trades: 0, winning_trades: 0, losing_trades: 0 },
  };
  saveStoredProfile(fresh);
  return fresh;
}
