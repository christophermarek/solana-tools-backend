-- Migration: 009_create_user_roles_table
-- Description: Create user_roles table and add role_id column to users table

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO user_roles (id, name) VALUES 
  ('admin', 'admin'),
  ('user', 'user');

-- Add role_id column to users table with default to 'user' role
ALTER TABLE users ADD COLUMN role_id VARCHAR(255) DEFAULT 'user';

-- Create index for role_id
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

