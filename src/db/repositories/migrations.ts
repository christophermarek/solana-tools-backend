import { getClient } from "../client.ts";
import { join } from "std/path/mod.ts";
import * as logging from "../../utils/logging.ts";

export interface Migration {
  id: number;
  name: string;
  executed_at: string;
}

export async function getExecutedMigrations(): Promise<Migration[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM migrations ORDER BY id ASC
    `).all() as Migration[];
    return result;
  } catch (_error) {
    logging.info(
      "migration",
      "Migrations table doesn't exist yet, returning empty array",
    );
    return [];
  }
}

export async function recordMigration(name: string): Promise<void> {
  const client = getClient();
  await client.prepare(`
    INSERT INTO migrations (name) VALUES (?)
  `).run(name);
}

export async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = join(Deno.cwd(), "src", "db", "migrations");
  const files: string[] = [];

  try {
    for await (const dirEntry of Deno.readDir(migrationsDir)) {
      if (dirEntry.isFile && dirEntry.name.endsWith(".sql")) {
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
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        await client.exec(statement);
      }
    }

    logging.info("migration", `Executed migration file: ${filename}`);
  } catch (error) {
    logging.error(
      "migration",
      `Failed to execute migration file: ${filename}`,
      error,
    );
    throw error;
  }
}
