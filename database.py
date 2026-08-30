import sqlite3
import json
from typing import Any, Dict, List, Optional

DB_FILE = "trading_bot.db"

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# --- HELPERS PARA CONSULTAS COMUNES ---

def get_user(user_id: str):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()

def update_user_balance(user_id: str, pnl: float):
    with get_connection() as conn:
        conn.execute("UPDATE users SET cash_balance = cash_balance + ?, realized_pnl = realized_pnl + ? WHERE user_id = ?", (pnl, pnl, user_id))
        conn.commit()

def get_user_traders(user_id: str):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM user_traders WHERE user_id = ?", (user_id,)).fetchall()

def upsert_user_trader(user_id: str, t: Dict[str, Any]):
    with get_connection() as conn:
        conn.execute('''
            INSERT INTO user_traders (user_id, trader_address, name, allocation_pct, risk_multiplier, max_leverage)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, trader_address) DO UPDATE SET
                name=excluded.name, allocation_pct=excluded.allocation_pct,
                risk_multiplier=excluded.risk_multiplier, max_leverage=excluded.max_leverage
        ''', (user_id, t['address'].lower(), t.get('name', t['address'][:8]),
              t.get('allocation_pct', 25.0), t.get('risk_multiplier', 1.0), t.get('max_leverage', 10)))
        conn.commit()

def delete_user_trader(user_id: str, trader_addr: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM user_traders WHERE user_id = ? AND trader_address = ?", (user_id, trader_addr.lower()))
        conn.commit()

def get_positions(user_id: str):
    with get_connection() as conn:
        return conn.execute("SELECT * FROM positions WHERE user_id = ?", (user_id,)).fetchall()

def upsert_position(user_id: str, pos_key: str, pos_data: Dict[str, Any]):
    with get_connection() as conn:
        conn.execute('''
            INSERT INTO positions (user_id, pos_key, trader_name, trader_addr, coin, size, entry_px, side, leverage, open_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(pos_key) DO UPDATE SET
                size=excluded.size, entry_px=excluded.entry_px
        ''', (user_id, pos_key, pos_data['trader_name'], pos_data['trader_addr'],
              pos_data['coin'], pos_data['size'], pos_data['entry_px'],
              pos_data['side'], pos_data['leverage'], pos_data['open_time']))
        conn.commit()

def delete_position(user_id: str, pos_key: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM positions WHERE user_id = ? AND pos_key = ?", (user_id, pos_key))
        conn.commit()

def add_trade_history(user_id: str, trade: Dict[str, Any]):
    with get_connection() as conn:
        conn.execute('''
            INSERT INTO trade_history (user_id, time, trader, coin, dir, px, sz, balance_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, trade['time'], trade['trader'], trade['coin'], trade['dir'],
              trade['px'], trade['sz'], trade['balance_after']))
        conn.commit()

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()

        # Tabla de Usuarios
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                cash_balance REAL DEFAULT 10000.0,
                realized_pnl REAL DEFAULT 0.0,
                status TEXT DEFAULT 'ACTIVE',
                telegram_chat_id TEXT,
                initial_balance REAL DEFAULT 10000.0,
                peak_balance REAL DEFAULT 10000.0,
                circuit_breaker_triggered INTEGER DEFAULT 0
            )
        ''')

        # Tabla de Traders seguidos por cada usuario
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_traders (
                user_id TEXT,
                trader_address TEXT,
                name TEXT,
                allocation_pct REAL DEFAULT 25.0,
                risk_multiplier REAL DEFAULT 1.0,
                max_leverage INTEGER DEFAULT 10,
                joined_at INTEGER DEFAULT 0,
                copy_existing_positions INTEGER DEFAULT 0,
                coin_filter_mode TEXT DEFAULT 'ALL',
                allowed_coins TEXT,
                blocked_coins TEXT,
                PRIMARY KEY (user_id, trader_address),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Tabla de Posiciones Abiertas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS positions (
                user_id TEXT,
                pos_key TEXT PRIMARY KEY,
                trader_name TEXT,
                trader_addr TEXT,
                coin TEXT,
                size REAL,
                entry_px REAL,
                side TEXT,
                leverage INTEGER,
                open_time TEXT,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        '''),

        # Tabla de Historial de Operaciones
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trade_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                time TEXT,
                trader TEXT,
                coin TEXT,
                dir TEXT,
                px REAL,
                sz REAL,
                balance_after REAL,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        # Tabla de Estadísticas Globales por Usuario
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT PRIMARY KEY,
                total_trades INTEGER DEFAULT 0,
                winning_trades INTEGER DEFAULT 0,
                losing_trades INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')

        conn.commit()

def migrate_from_json():
    """Migra datos desde users_db.json y paper_portfolio.json a SQLite"""
    import os

    # 1. Migrar users_db.json
    if os.path.exists("users_db.json"):
        with open("users_db.json", "r") as f:
            users_data = json.load(f)

        with get_connection() as conn:
            cursor = conn.cursor()
            for user_id, user in users_data.items():
                # Insertar Usuario
                cursor.execute('''
                    INSERT OR IGNORE INTO users (user_id, cash_balance, realized_pnl, status, telegram_chat_id)
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, user.get("cash_balance", 10000.0), user.get("realized_pnl", 0.0),
                      user.get("status", "ACTIVE"), user.get("telegram_chat_id")))

                # Insertar Traders del usuario
                for t in user.get("traders", []):
                    cursor.execute('''
                        INSERT OR IGNORE INTO user_traders
                        (user_id, trader_address, name, allocation_pct, risk_multiplier, max_leverage,
                         joined_at, copy_existing_positions, coin_filter_mode, allowed_coins, blocked_coins)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, t["address"].lower(), t.get("name", t["address"][:8]),
                          t.get("allocation_pct", 25.0), t.get("risk_multiplier", 1.0),
                          t.get("max_leverage", 10), t.get("joined_at", 0),
                          1 if t.get("copy_existing_positions") else 0,
                          t.get("coin_filter_mode", "ALL"),
                          json.dumps(t.get("allowed_coins", [])),
                          json.dumps(t.get("blocked_coins", []))))

                # Insertar Posiciones
                positions = user.get("positions", {})
                for pos_key, pos in positions.items():
                    cursor.execute('''
                        INSERT OR IGNORE INTO positions
                        (user_id, pos_key, trader_name, trader_addr, coin, size, entry_px, side, leverage, open_time)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, pos_key, pos["trader_name"], pos["trader_addr"],
                          pos["coin"], pos["size"], pos["entry_px"], pos["side"], pos["leverage"], pos["open_time"]))

                # Insertar Historial
                for trade in user.get("trade_history", []):
                    cursor.execute('''
                        INSERT INTO trade_history (user_id, time, trader, coin, dir, px, sz, balance_after)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, trade["time"], trade["trader"], trade["coin"], trade["dir"],
                          trade["px"], trade["sz"], trade["balance_after"]))

                # Insertar Stats
                stats = user.get("stats", {})
                cursor.execute('''
                    INSERT OR IGNORE INTO user_stats (user_id, total_trades, winning_trades, losing_trades)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, stats.get("total_trades", 0), stats.get("winning_trades", 0), stats.get("losing_trades", 0)))

            conn.commit()
            print("✅ Migración de users_db.json completada.")

    # 2. Migrar paper_portfolio.json (Caso especial: Usuario 'default')
    if os.path.exists("paper_portfolio.json"):
        with open("paper_portfolio.json", "r") as f:
            p_data = json.load(f)

        user_id = "default_user"
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR IGNORE INTO users (user_id, cash_balance, realized_pnl, initial_balance, peak_balance)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, p_data.get("cash_balance", 10000.0), p_data.get("realized_pnl", 0.0),
                  p_data.get("initial_balance", 10000.0), p_data.get("peak_balance", 10000.0)))

            # Posiciones
            positions = p_data.get("positions", {})
            for pos_key, pos in positions.items():
                cursor.execute('''
                    INSERT OR IGNORE INTO positions
                    (user_id, pos_key, trader_name, trader_addr, coin, size, entry_px, side, leverage, open_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, pos_key, pos["trader_name"], pos["trader_addr"],
                      pos["coin"], pos["size"], pos["entry_px"], pos["side"], pos["leverage"], pos["open_time"]))

            # Historial
            for trade in p_data.get("trade_history", []):
                cursor.execute('''
                    INSERT INTO trade_history (user_id, time, trader, coin, dir, px, sz, balance_after)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, trade["time"], trade["trader"], trade["coin"], trade["dir"],
                      trade["px"], trade["sz"], trade["balance_after"]))

            # Stats
            stats = p_data.get("stats", {})
            cursor.execute('''
                INSERT OR IGNORE INTO user_stats (user_id, total_trades, winning_trades, losing_trades)
                VALUES (?, ?, ?, ?)
            ''', (user_id, stats.get("total_trades", 0), stats.get("winning_trades", 0), stats.get("losing_trades", 0)))

            conn.commit()
            print("✅ Migración de paper_portfolio.json completada.")

if __name__ == "__main__":
    init_db()
    migrate_from_json()
