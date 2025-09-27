CREATE TABLE IF NOT EXISTS bot_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_type TEXT NOT NULL,
  bot_params TEXT NOT NULL,
  wallet_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_cycles INTEGER DEFAULT 0,
  successful_cycles INTEGER DEFAULT 0,
  failed_cycles INTEGER DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,
  bot_specific_results TEXT,
  errors TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES keypairs(id)
);

CREATE INDEX IF NOT EXISTS idx_bot_executions_status ON bot_executions(status);
CREATE INDEX IF NOT EXISTS idx_bot_executions_wallet_id ON bot_executions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_bot_executions_created_at ON bot_executions(created_at);
