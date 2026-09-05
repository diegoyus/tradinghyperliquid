import { UserProfile, TraderConfig, GlobalRiskSettings, AgentWalletConfig } from "./types";
import { ethers } from "ethers";
import { saveUserProfileToCloud } from "./cloudSync";

export const SUPERADMIN_EMAIL = "diegoyusdiez@gmail.com";

export const DEFAULT_GLOBAL_RISK: GlobalRiskSettings = {
  circuit_breaker_pct: 15.0,
  emergency_stop_enabled: true,
  max_global_leverage: 10,
  execution_mode: "AUTO",
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
  role: "USER",
  status: "ACTIVE",
  created_at: new Date().toISOString(),
  last_active: new Date().toISOString(),
  telegram_chat_id: "",
  wallet_address: "",
  trading_mode: "DEMO",
  initial_balance: 10000.0,
  cash_balance: 10000.0,
  realized_pnl: 0.0,
  peak_balance: 10000.0,
  traders: [],
  real_traders: [],
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

const INITIAL_REGISTRY_USERS: UserProfile[] = [];

const STORAGE_KEY = "hyperliquid_copy_user_profile_v2";
const REGISTRY_STORAGE_KEY = "hyperliquid_users_registry_v1";

export function isSuperAdmin(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const p = JSON.parse(raw);
    return !!(p && p.email && p.email.toLowerCase() !== "demo@copytrading.com" && p.email.includes("@"));
  } catch {
    return false;
  }
}

export function getAllUsers(): UserProfile[] {
  const current = getStoredProfile();
  let users: UserProfile[] = [];

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      try {
        users = JSON.parse(raw);
      } catch {}
    }
  }

  if (!Array.isArray(users) || users.length === 0) {
    users = [...INITIAL_REGISTRY_USERS];
  }

  // Filtrar cualquier entrada anterior que coincida con el usuario actual o el email de superadmin
  users = users.filter(
    (u) =>
      u.id !== current.id &&
      u.email.toLowerCase() !== current.email.toLowerCase() &&
      (current.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
        ? u.email.toLowerCase() !== SUPERADMIN_EMAIL.toLowerCase()
        : true)
  );

  // Inyectar al usuario actual en PRIMER LUGAR con sus datos en vivo y sincronizados
  const realCurrent: UserProfile = {
    ...current,
    role: isSuperAdmin(current.email) ? "SUPERADMIN" : current.role || "USER",
    status: current.status || "ACTIVE",
    last_active: new Date().toISOString(),
  };

  users.unshift(realCurrent);

  if (typeof window !== "undefined") {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
  }

  return users;
}

export function saveAllUsers(users: UserProfile[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
  }
}

export function updateUserStatus(userId: string, status: "ACTIVE" | "INACTIVE"): UserProfile[] {
  const users = getAllUsers();
  const updated = users.map((u) => (u.id === userId ? { ...u, status } : u));
  saveAllUsers(updated);

  // Si es el usuario activo actual, sincronizar también su estado local
  const current = getStoredProfile();
  if (current.id === userId) {
    current.status = status;
    saveStoredProfile(current);
  }
  return updated;
}

export function updateUserProfileByAdmin(updatedUser: UserProfile): void {
  const users = getAllUsers();
  const updated = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
  saveAllUsers(updated);

  // Si es el usuario activo actual
  const current = getStoredProfile();
  if (current.id === updatedUser.id || current.email.toLowerCase() === updatedUser.email.toLowerCase()) {
    saveStoredProfile(updatedUser);
  }
}

export function impersonateUser(user: UserProfile): void {
  saveStoredProfile(user);
}

export function syncUserToRegistry(profile: UserProfile): void {
  const users = getAllUsers();
  const existingIdx = users.findIndex((u) => u.id === profile.id || u.email.toLowerCase() === profile.email.toLowerCase());
  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...profile };
  } else {
    users.unshift(profile);
  }
  saveAllUsers(users);
}

export function getStoredProfile(): UserProfile {
  if (typeof window === "undefined") return INITIAL_PROFILE;
  const raw = localStorage.getItem(STORAGE_KEY);
  let parsed: UserProfile;

  if (!raw) {
    parsed = { ...INITIAL_PROFILE };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { ...INITIAL_PROFILE };
    }
  }

  if (!parsed.global_risk) {
    parsed.global_risk = { ...DEFAULT_GLOBAL_RISK };
  }

  if (!parsed.trading_mode) {
    parsed.trading_mode = "DEMO";
  }

  // Aplicar tema dinámico en DOM (verde simulado vs azul real)
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", parsed.trading_mode === "REAL" ? "real" : "demo");
  }

  // Auto-grant SUPERADMIN if matches diegoyusdiez@gmail.com
  if (parsed.email && isSuperAdmin(parsed.email)) {
    parsed.role = "SUPERADMIN";
    parsed.status = "ACTIVE";
  }

  // Recuperar respaldo específico de este correo si la sesión activa perdió datos
  if (parsed.email) {
    const cleanEmail = parsed.email.toLowerCase().trim();
    const backupRaw = localStorage.getItem(`hyperliquid_profile_${cleanEmail}`);
    if (backupRaw) {
      try {
        const backupParsed = JSON.parse(backupRaw);
        if ((!parsed.traders || parsed.traders.length === 0) && backupParsed.traders && backupParsed.traders.length > 0) {
          parsed.traders = backupParsed.traders;
        }
        if (!parsed.telegram_chat_id && backupParsed.telegram_chat_id) {
          parsed.telegram_chat_id = backupParsed.telegram_chat_id;
        }
        if (backupParsed.global_risk?.execution_mode) {
          parsed.global_risk.execution_mode = backupParsed.global_risk.execution_mode;
        }
      } catch {}
    }
  }

  parsed.traders = (parsed.traders || []).map((t: any) => ({
    ...t,
    stop_loss_pct: t.stop_loss_pct ?? 5.0,
    max_trade_sizing_pct: t.max_trade_sizing_pct ?? 25.0,
    risk_multiplier: t.risk_multiplier ?? 1.0,
    max_leverage: t.max_leverage ?? 10,
  }));

  parsed.real_traders = (parsed.real_traders || []).map((t: any) => ({
    ...t,
    stop_loss_pct: t.stop_loss_pct ?? 5.0,
    max_trade_sizing_pct: t.max_trade_sizing_pct ?? 25.0,
    risk_multiplier: t.risk_multiplier ?? 1.0,
    max_leverage: t.max_leverage ?? 10,
  }));

  return parsed;
}

export function saveStoredProfile(profile: UserProfile): void {
  if (typeof window !== "undefined") {
    // Si es diegoyusdiez@gmail.com, asegurar rol de superadmin
    if (profile.email && isSuperAdmin(profile.email)) {
      profile.role = "SUPERADMIN";
      profile.status = "ACTIVE";
    }

    // 1. Guardar en clave principal activa
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

    // 2. Guardar en clave de respaldo permanente por correo
    if (profile.email) {
      const cleanEmail = profile.email.toLowerCase().trim();
      localStorage.setItem(`hyperliquid_profile_${cleanEmail}`, JSON.stringify(profile));
    }

    // 3. Sincronizar automáticamente en el registro general de usuarios
    try {
      const rawReg = localStorage.getItem(REGISTRY_STORAGE_KEY);
      let users: UserProfile[] = rawReg ? JSON.parse(rawReg) : [];
      if (!Array.isArray(users)) users = [];
      const idx = users.findIndex(
        (u) => u.id === profile.id || (u.email && u.email.toLowerCase() === profile.email.toLowerCase())
      );
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...profile };
      } else {
        users.unshift(profile);
      }
      localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(users));
    } catch {}

    // 4. Sincronizar en tiempo real con la nube (Firestore)
    if (profile.email) {
      saveUserProfileToCloud(profile).catch(() => {});
    }
  }
}

export function getActiveTraders(profile: UserProfile): TraderConfig[] {
  return profile.trading_mode === "REAL" ? (profile.real_traders || []) : (profile.traders || []);
}

export function updateTradersConfig(traders: TraderConfig[], targetMode?: "DEMO" | "REAL"): UserProfile {
  const profile = getStoredProfile();
  const effectiveMode = targetMode || profile.trading_mode || "DEMO";
  if (effectiveMode === "REAL") {
    profile.real_traders = traders;
  } else {
    profile.traders = traders;
  }
  saveStoredProfile(profile);

  // Sincronizar automáticamente con Telegram
  if (profile.telegram_chat_id) {
    fetch("/api/telegram/sync-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
    }).catch(() => {});
  }

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
  if (typeof window !== "undefined") {
    localStorage.setItem("hyperliquid_reset_timestamp", Date.now().toString());
  }
  const current = getStoredProfile();
  const fresh: UserProfile = {
    ...INITIAL_PROFILE,
    id: current.id || "user_demo",
    email: current.email || "demo@copytrading.com",
    name: current.name || "Usuario Inversor",
    role: isSuperAdmin(current.email) ? "SUPERADMIN" : "USER",
    status: "ACTIVE",
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

export function updateTradingMode(mode: "DEMO" | "REAL"): UserProfile {
  const profile = getStoredProfile();
  profile.trading_mode = mode;
  saveStoredProfile(profile);

  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-theme", mode === "REAL" ? "real" : "demo");
    window.dispatchEvent(new CustomEvent("trading-mode-changed", { detail: mode }));
  }

  // Sincronizar automáticamente con Telegram
  if (profile.telegram_chat_id) {
    fetch("/api/telegram/sync-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
    }).catch(() => {});
  }

  return profile;
}

export function getResetTimestamp(): number {
  if (typeof window !== "undefined") {
    return parseInt(localStorage.getItem("hyperliquid_reset_timestamp") || "0", 10) || 0;
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// GESTIÓN DE AGENT WALLETS PARA COPY TRADING EN REAL (HYPERLIQUID)
// ─────────────────────────────────────────────────────────────

export function generateNewAgentWallet(name: string = "HyperCopy Agent"): AgentWalletConfig {
  const profile = getStoredProfile();
  // Crear nueva wallet criptográfica aleatoria segura con ethers
  const randomWallet = ethers.Wallet.createRandom();

  const agentConfig: AgentWalletConfig = {
    agent_address: randomWallet.address.toLowerCase(),
    agent_private_key: randomWallet.privateKey,
    is_approved_on_chain: false,
    name,
    created_at: Date.now(),
  };

  profile.agent_wallet = agentConfig;
  saveStoredProfile(profile);

  // Sincronizar con Telegram si está vinculado
  if (profile.telegram_chat_id) {
    fetch("/api/telegram/sync-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
    }).catch(() => {});
  }

  return agentConfig;
}

export function setCustomAgentWallet(agentAddress: string, privateKey?: string, name: string = "Custom Agent"): AgentWalletConfig {
  const profile = getStoredProfile();

  const agentConfig: AgentWalletConfig = {
    agent_address: agentAddress.toLowerCase().trim(),
    agent_private_key: privateKey ? privateKey.trim() : undefined,
    is_approved_on_chain: false,
    name,
    created_at: Date.now(),
  };

  profile.agent_wallet = agentConfig;
  saveStoredProfile(profile);

  if (profile.telegram_chat_id) {
    fetch("/api/telegram/sync-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
    }).catch(() => {});
  }

  return agentConfig;
}

export async function verifyAgentOnChain(userAddress: string, agentAddress: string): Promise<boolean> {
  if (!userAddress || !agentAddress) return false;

  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "extraAgents", user: userAddress }),
    });

    if (!res.ok) return false;
    const data = await res.json();

    if (Array.isArray(data)) {
      const isApproved = data.some(
        (agent: any) => agent.address && agent.address.toLowerCase() === agentAddress.toLowerCase()
      );

      const profile = getStoredProfile();
      if (profile.agent_wallet && profile.agent_wallet.agent_address.toLowerCase() === agentAddress.toLowerCase()) {
        profile.agent_wallet.is_approved_on_chain = isApproved;
        saveStoredProfile(profile);
      }

      return isApproved;
    }
  } catch (e) {
    console.error("Error verificando extraAgents en Hyperliquid:", e);
  }

  return false;
}

export function removeAgentWallet(): UserProfile {
  const profile = getStoredProfile();
  delete profile.agent_wallet;
  saveStoredProfile(profile);

  if (profile.telegram_chat_id) {
    fetch("/api/telegram/sync-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: profile.telegram_chat_id, profile }),
    }).catch(() => {});
  }

  return profile;
}

