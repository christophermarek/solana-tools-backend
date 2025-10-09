CREATE TABLE IF NOT EXISTS user_payment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  amount_in_sol REAL NOT NULL,
  signature TEXT NOT NULL,
  deposited_at DATETIME NOT NULL,
  processed_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_user_payment_history_telegram_id ON user_payment_history(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_history_signature ON user_payment_history(signature);