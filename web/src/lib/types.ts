export interface TraderConfig {
  name: string;
  alias?: string;
  score?: string;
  address: string;
  allocation_pct: number;
  risk_multiplier: number;
  max_leverage: number;
  stop_loss_pct: number;
  max_trade_sizing_pct: number;
  copy_existing_positions?: boolean;
  joined_at?: number;
  coin_filter_mode?: "ALL" | "ALLOWLIST" | "BLOCKLIST";
  allowed_coins?: string[];
  blocked_coins?: string[];
  is_real?: boolean;
  weekTradesCount?: number;
}

export interface GlobalRiskSettings {
  circuit_breaker_pct: number;
  emergency_stop_enabled: boolean;
  max_global_leverage: number;
  execution_mode?: "AUTO" | "TELEGRAM_APPROVAL";
}

export interface Position {
  trader_name: string;
  trader_addr: string;
  coin: string;
  size: number;
  entry_px: number;
  side: "LONG" | "SHORT";
  leverage: number;
  open_time: string;
}

export interface TradeHistoryItem {
  time: string;
  trader: string;
  coin: string;
  dir: string;
  px: number;
  sz: number;
  pnl?: number;
  balance_after: number;
}

export interface UnifiedTrade {
  id: string;
  timestamp: number;
  timeStr: string;
  openTimestamp?: number;
  closeTimestamp?: number;
  openTimeStr?: string;
  openTime?: string;
  closeTimeStr?: string;
  durationStr?: string;
  traderName: string;
  traderAddr: string;
  coin: string;
  dir: string;
  side: "LONG" | "SHORT";
  status: "OPEN" | "CLOSED" | "PENDING_APPROVAL";
  entryPx: number;
  exitPx?: number;
  markPx?: number;
  size: number;
  usdValue: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  fee?: number;
}

export interface EquityPoint {
  time: string;
  balance: number;
}

export interface UserStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
}

export interface AgentWalletConfig {
  agent_address: string;         // Dirección pública delegada del agente (0x...)
  agent_private_key?: string;    // Clave privada efímera del agente para firmar órdenes
  encrypted_key_payload?: {
    encrypted: string;
    iv: string;
    tag: string;
  };                             // Payload cifrado AES-256-GCM para almacenamiento seguro en la nube
  is_approved_on_chain: boolean; // Si Hyperliquid ya confirmó la aprobación
  name?: string;                 // Nombre asignado (ej. "HyperCopy Agent")
  agent_name?: string;
  created_at: number | string;   // Timestamp de creación
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role?: "SUPERADMIN" | "USER";
  status?: "ACTIVE" | "INACTIVE" | "PENDING_APPROVAL";
  created_at?: string;
  last_active?: string;
  telegram_chat_id: string;
  wallet_address?: string;       // Dirección pública Hyperliquid del usuario (0x...)
  trading_mode?: "DEMO" | "REAL"; // DEMO = simulado, REAL = billetera conectada
  agent_wallet?: AgentWalletConfig; // Configuración del Agente de Trading en Real
  initial_balance: number;
  cash_balance: number;
  realized_pnl: number;
  peak_balance: number;
  traders: TraderConfig[];
  real_traders?: TraderConfig[]; // Cesta de traders independiente para Modo Real
  global_risk: GlobalRiskSettings;
  positions: Record<string, Position>;
  trade_history: TradeHistoryItem[];
  equity_history: EquityPoint[];
  real_equity_history?: EquityPoint[];
  stats: UserStats;
}
