-- Migration: 014_add_owner_user_id_to_bot_executions
-- Description: Add owner_user_id column to bot_executions table for ownership control

ALTER TABLE bot_executions ADD COLUMN owner_user_id VARCHAR(255) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_bot_executions_owner_user_id ON bot_executions(owner_user_id);