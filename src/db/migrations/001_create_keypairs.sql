-- Migration: 001_create_keypairs
-- Description: Create keypairs table with all necessary columns and indexes

CREATE TABLE IF NOT EXISTS keypairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_key VARCHAR(44) NOT NULL UNIQUE,
  secret_key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  label VARCHAR(255),
  is_active BOOLEAN DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_keypairs_public_key ON keypairs(public_key);
CREATE INDEX IF NOT EXISTS idx_keypairs_is_active ON keypairs(is_active);
