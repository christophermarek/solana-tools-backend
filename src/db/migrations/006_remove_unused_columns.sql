-- Migration: 006_remove_unused_columns
-- Description: Remove unused block_time and fee_lamports columns from transactions table

ALTER TABLE transactions DROP COLUMN block_time;
ALTER TABLE transactions DROP COLUMN fee_lamports;
