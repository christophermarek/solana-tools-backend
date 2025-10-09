-- Add credits_expire_at column to users table
ALTER TABLE users ADD COLUMN credits_expire_at DATETIME;

-- Create credit redemption history table
CREATE TABLE IF NOT EXISTS credit_redemption_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL,
  payment_id INTEGER NOT NULL,
  redeemed_at DATETIME NOT NULL,
  days_purchased INTEGER NOT NULL,
  sol_spent REAL NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES user_payment_history(id)
);

-- Create indexes for credit redemption history
CREATE INDEX IF NOT EXISTS idx_credit_redemption_history_telegram_id ON credit_redemption_history(telegram_id);
CREATE INDEX IF NOT EXISTS idx_credit_redemption_history_payment_id ON credit_redemption_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_credit_redemption_history_redeemed_at ON credit_redemption_history(redeemed_at);