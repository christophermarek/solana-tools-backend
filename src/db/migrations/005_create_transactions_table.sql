-- Migration: 005_create_transactions_table
-- Description: Create transactions table to track all blockchain transactions

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signature VARCHAR(88) UNIQUE,
  sender_wallet_id INTEGER,
  sender_public_key VARCHAR(44) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  slot INTEGER,
  priority_fee_unit_limit INTEGER,
  priority_fee_unit_price_lamports INTEGER,
  slippage_bps INTEGER,
  confirmed_at DATETIME,
  confirmation_slot INTEGER,
  commitment_level VARCHAR(20),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_wallet_id) REFERENCES keypairs(id)
);
