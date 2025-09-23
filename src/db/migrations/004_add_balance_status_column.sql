-- Migration: 004_add_balance_status_column
-- Description: Add balance status tracking to keypairs table

-- Add balance_status column to keypairs table
ALTER TABLE keypairs ADD COLUMN balance_status VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN';
