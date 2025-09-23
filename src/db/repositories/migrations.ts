import { getClient } from "../client.ts";
import { join } from "std/path/mod.ts";
import * as logging from "../../utils/logging.ts";

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

export async function initializeMigrationTable() {
  const client = getClient();
  client.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getExecutedMigrations(): Promise<Migration[]> {
  const client = getClient();
  const result = client.prepare(`
    SELECT * FROM migrations ORDER BY id ASC
  `).all() as Migration[];
  return result;
}

export async function recordMigration(name: string) {
  const client = getClient();
  client.prepare(`
    INSERT INTO migrations (name) VALUES (?)
  `).run(name);
}

export async function removeMigration(name: string) {
  const client = getClient();
  client.prepare(`
    DELETE FROM migrations WHERE name = ?
  `).run(name);
}

export async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = join(Deno.cwd(), "src", "db", "migrations");
  const files: string[] = [];
  
  try {
    for await (const dirEntry of Deno.readDir(migrationsDir)) {
      if (dirEntry.isFile && dirEntry.name.endsWith('.sql')) {
        files.push(dirEntry.name);
      }
    }
  } catch (error) {
    logging.error("migration", "Failed to read migrations directory", error);
    throw error;
  }
  
  return files.sort();
}

export async function executeMigrationFile(filename: string): Promise<void> {
  const migrationsDir = join(Deno.cwd(), "src", "db", "migrations");
  const filePath = join(migrationsDir, filename);
  
  try {
    const sql = await Deno.readTextFile(filePath);
    const client = getClient();
    
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        client.exec(statement);
      }
    }
    
    logging.info("migration", `Executed migration file: ${filename}`);
  } catch (error) {
    logging.error("migration", `Failed to execute migration file: ${filename}`, error);
    throw error;
  }
}

export async function rollbackMigration(filename: string): Promise<void> {
  const requestId = "migration";
  
  try {
    if (filename === "001_create_keypairs.sql") {
      const client = getClient();
      
      const checkTransactions = client.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'
      `).all() as { name: string }[];
      
      if (checkTransactions.length > 0) {
        logging.info(requestId, "Dropping transactions table first...");
        client.exec(`DROP TABLE IF EXISTS transactions`);
      }
      
      client.exec(`DROP TABLE IF EXISTS keypairs`);
      logging.info(requestId, `Rolled back migration: ${filename}`);
    } else if (filename === "002_create_transactions.sql") {
      const client = getClient();
      client.exec(`DROP TABLE IF EXISTS transactions`);
      logging.info(requestId, `Rolled back migration: ${filename}`);
    } else if (filename === "003_add_balance_columns.sql") {
      const client = getClient();
      client.exec(`
        ALTER TABLE keypairs DROP COLUMN sol_balance;
        ALTER TABLE keypairs DROP COLUMN wsol_balance;
        ALTER TABLE keypairs DROP COLUMN last_balance_update;
      `);
      logging.info(requestId, `Rolled back migration: ${filename}`);
    } else if (filename === "004_add_balance_status_column.sql") {
      const client = getClient();
      client.exec(`ALTER TABLE keypairs DROP COLUMN balance_status`);
      logging.info(requestId, `Rolled back migration: ${filename}`);
    } else {
      logging.warn(requestId, `No rollback defined for migration: ${filename}`);
    }
  } catch (error) {
    logging.error(requestId, `Failed to rollback migration: ${filename}`, error);
    throw error;
  }
}
