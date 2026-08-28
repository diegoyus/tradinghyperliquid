import { UserProfile, TraderConfig } from "./types";

export const DEFAULT_TRADERS: TraderConfig[] = [
  {
    name: "El Francotirador",
    score: "9.8/10",
    address: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06",
    allocation_pct: 40.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
  },
  {
    name: "Sticky (Scalping)",
    score: "9.3/10",
    address: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe",
    allocation_pct: 30.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
  },
  {
    name: "Macro / Acciones",
    score: "8.9/10",
    address: "0xb6db1b4dc6244f86e482d834739d949d799e4da5",
    allocation_pct: 20.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
  },
  {
    name: "Especialista SOL",
    score: "8.5/10",
    address: "0xab7fb756330e3983e676f44c03dabda9120aa273",
    allocation_pct: 10.0,
    risk_multiplier: 1.0,
    max_leverage: 10,
  },
];

const INITIAL_PROFILE: UserProfile = {
  id: "user_demo",
  email: "demo@copytrading.com",
  name: "Usuario Inversor",
  telegram_chat_id: "",
  initial_balance: 10000.0,
  cash_balance: 14850.25,
  realized_pnl: 4850.25,
  peak_balance: 15200.0,
  traders: DEFAULT_TRADERS,
  positions: {
    BTC_0x337a: {
      trader_name: "El Francotirador",
      trader_addr: "0x337afda118de433f5a8c8ad6d6ef48b76d027a06",
      coin: "BTC",
      size: 0.15,
      entry_px: 64200.0,
      side: "LONG",
      leverage: 10,
      open_time: "Hoy 14:32",
    },
    ETH_0x613e: {
      trader_name: "Sticky",
      trader_addr: "0x613ead0ea5af374af0ccfc117ef116a8e8d133fe",
      coin: "ETH",
      size: 1.8,
      entry_px: 2480.5,
      side: "LONG",
      leverage: 5,
      open_time: "Hoy 16:05",
    },
  },
  trade_history: [
    {
      time: "Hoy 18:20",
      trader: "El Francotirador",
      coin: "XRP",
      dir: "Close Long",
      px: 0.62,
      sz: 5000,
      pnl: 340.5,
      balance_after: 14850.25,
    },
    {
      time: "Hoy 15:10",
      trader: "Sticky",
      coin: "ZEC",
      dir: "Close Long",
      px: 585.0,
      sz: 15,
      pnl: 680.0,
      balance_after: 14509.75,
    },
    {
      time: "Ayer 22:45",
      trader: "Macro / Acciones",
      coin: "BTC",
      dir: "Close Long",
      px: 65100.0,
      sz: 0.2,
      pnl: 820.0,
      balance_after: 13829.75,
    },
    {
      time: "Ayer 19:30",
      trader: "Especialista SOL",
      coin: "SOL",
      dir: "Close Long",
      px: 152.4,
      sz: 25,
      pnl: 410.25,
      balance_after: 13009.75,
    },
  ],
  equity_history: [
    { time: "Día 1", balance: 10000.0 },
    { time: "Día 3", balance: 10450.0 },
    { time: "Día 7", balance: 11200.0 },
    { time: "Día 12", balance: 12150.0 },
    { time: "Día 18", balance: 13000.0 },
    { time: "Día 24", balance: 14100.0 },
    { time: "Hoy", balance: 14850.25 },
  ],
  stats: {
    total_trades: 28,
    winning_trades: 25,
    losing_trades: 3,
  },
};

const STORAGE_KEY = "hyperliquid_copy_user_profile";

export function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") return INITIAL_PROFILE;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROFILE));
    return INITIAL_PROFILE;
  }
  try {
    return JSON.parse(raw);
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

export function updateTelegramChatId(chatId: string): UserProfile {
  const profile = getStoredProfile();
  profile.telegram_chat_id = chatId;
  saveStoredProfile(profile);
  return profile;
}

export function resetProfile(): UserProfile {
  const fresh: UserProfile = {
    ...INITIAL_PROFILE,
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
