export interface TraderConfig {
  name: string;
  score?: string;
  address: string;
  allocation_pct: number;
  risk_multiplier: number;
  max_leverage: number;
  stop_loss_pct: number;
  max_trade_sizing_pct: number;
}

export interface GlobalRiskSettings {
  circuit_breaker_pct: number;
  emergency_stop_enabled: boolean;
  max_global_leverage: number;
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

export interface EquityPoint {
  time: string;
  balance: number;
}

export interface UserStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  telegram_chat_id: string;
  initial_balance: number;
  cash_balance: number;
  realized_pnl: number;
  peak_balance: number;
  traders: TraderConfig[];
  global_risk: GlobalRiskSettings;
  positions: Record<string, Position>;
  trade_history: TradeHistoryItem[];
  equity_history: EquityPoint[];
  stats: UserStats;
}
