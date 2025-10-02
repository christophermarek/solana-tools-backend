-- Migration: 013_fix_pumpfun_mints_foreign_key
-- Description: Fix pumpfun_mints table by removing foreign key constraint

DROP TABLE IF EXISTS pumpfun_mints;

CREATE TABLE IF NOT EXISTS pumpfun_mints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint_public_key VARCHAR(44) NOT NULL UNIQUE,
  telegram_user_id VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pumpfun_mints_telegram_user_id ON pumpfun_mints(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_pumpfun_mints_mint_public_key ON pumpfun_mints(mint_public_key);
CREATE INDEX IF NOT EXISTS idx_pumpfun_mints_created_at ON pumpfun_mints(created_at);
