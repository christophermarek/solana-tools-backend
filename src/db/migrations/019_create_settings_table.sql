-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  field TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default SOL_PER_CREDIT setting
INSERT OR IGNORE INTO settings (field, description, value) VALUES 
('SOL_PER_CREDIT', 'Amount of SOL required per credit day', '0.1');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_field ON settings(field);