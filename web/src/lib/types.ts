export interface TraderConfig {
  name: string;
  score?: string;
  address: string;
  allocation_pct: number;
  risk_multiplier: number;
  max_leverage: number;
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
  positions: Record<string, Position>;
  trade_history: TradeHistoryItem[];
  equity_history: EquityPoint[];
  stats: UserStats;
}
