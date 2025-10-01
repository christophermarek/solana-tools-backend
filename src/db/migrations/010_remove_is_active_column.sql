-- Migration: 010_remove_is_active_column
-- Description: Remove is_active column from keypairs table and related indexes

-- Drop the index on is_active column
DROP INDEX IF EXISTS idx_keypairs_is_active;

-- Remove the is_active column from keypairs table
-- Note: SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
CREATE TABLE keypairs_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key VARCHAR(44) NOT NULL UNIQUE,
  secret_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  label VARCHAR(255),
  sol_balance BIGINT,
  wsol_balance BIGINT,
  last_balance_update DATETIME,
  balance_status VARCHAR(20) DEFAULT 'UNKNOWN'
);

-- Copy data from old table to new table
INSERT INTO keypairs_new (
  id, public_key, secret_key, created_at, updated_at, label,
  sol_balance, wsol_balance, last_balance_update, balance_status
)
SELECT 
  id, public_key, secret_key, created_at, updated_at, label,
  sol_balance, wsol_balance, last_balance_update, balance_status
FROM keypairs;

-- Drop the old table
DROP TABLE keypairs;

-- Rename the new table to the original name
ALTER TABLE keypairs_new RENAME TO keypairs;

-- Recreate the public_key index
CREATE INDEX IF NOT EXISTS idx_keypairs_public_key ON keypairs(public_key);
