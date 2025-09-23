-- Migration: 003_add_balance_columns
-- Description: Add balance tracking columns to keypairs table

-- Add balance columns to keypairs table
ALTER TABLE keypairs ADD COLUMN sol_balance INTEGER;
ALTER TABLE keypairs ADD COLUMN wsol_balance INTEGER;
ALTER TABLE keypairs ADD COLUMN last_balance_update DATETIME;
