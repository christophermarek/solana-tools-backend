-- Migration: 011_add_owner_user_id_to_keypairs
-- Description: Add owner_user_id column to keypairs table for ownership control

-- Add owner_user_id column to keypairs table
ALTER TABLE keypairs ADD COLUMN owner_user_id VARCHAR(255) NOT NULL DEFAULT '';

-- Create index for owner_user_id
CREATE INDEX IF NOT EXISTS idx_keypairs_owner_user_id ON keypairs(owner_user_id);
