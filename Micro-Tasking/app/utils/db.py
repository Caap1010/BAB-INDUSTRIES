import sqlite3
from pathlib import Path


def get_connection(db_path):
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def _ensure_column(conn, table_name, column_name, definition):
    existing_columns = {
        row[1]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in existing_columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def initialize_database(db_path):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with get_connection(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                platform TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Medium',
                estimated_time_minutes INTEGER NOT NULL DEFAULT 30,
                estimated_pay REAL NOT NULL DEFAULT 0,
                task_url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                due_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS earnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                payout_method TEXT NOT NULL DEFAULT 'PayPal',
                reference TEXT,
                earned_on TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS productivity_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_type TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS withdrawal_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL NOT NULL,
                provider TEXT NOT NULL DEFAULT 'PayPal',
                paypal_email TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Requested',
                note TEXT,
                external_batch_id TEXT,
                external_payout_item_id TEXT,
                processor_message TEXT,
                processed_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

        _ensure_column(conn, "withdrawal_requests", "external_batch_id", "TEXT")
        _ensure_column(conn, "withdrawal_requests", "external_payout_item_id", "TEXT")
        _ensure_column(conn, "withdrawal_requests", "processor_message", "TEXT")
        _ensure_column(conn, "withdrawal_requests", "processed_at", "TEXT")
        conn.commit()
