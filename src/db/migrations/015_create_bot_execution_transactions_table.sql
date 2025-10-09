CREATE TABLE IF NOT EXISTS bot_execution_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_execution_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL,
  pump_fun_transaction_type TEXT NOT NULL CHECK (pump_fun_transaction_type IN ('buy', 'sell', 'create-and-buy')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_execution_id) REFERENCES bot_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bot_execution_transactions_bot_execution_id ON bot_execution_transactions(bot_execution_id);
CREATE INDEX IF NOT EXISTS idx_bot_execution_transactions_transaction_id ON bot_execution_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bot_execution_transactions_type ON bot_execution_transactions(pump_fun_transaction_type);