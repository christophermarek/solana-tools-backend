-- Migration: 002_create_transactions
-- Description: Create transactions table with foreign key references

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_wallet_id INTEGER REFERENCES keypairs(id),
  to_wallet_id INTEGER REFERENCES keypairs(id),
  external_destination VARCHAR(44),
  amount INTEGER NOT NULL,
  fee_amount INTEGER,
  token_type VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  signature VARCHAR(88),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  is_external BOOLEAN DEFAULT 0,
  transaction_data TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON transactions(signature);
