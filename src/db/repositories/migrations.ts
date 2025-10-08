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
    const result = await client.execute({
      sql: "SELECT * FROM migrations ORDER BY id ASC",
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      name: row.name as string,
      executed_at: row.executed_at as string,
    }));
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
  await client.execute({
    sql: "INSERT INTO migrations (name) VALUES (?)",
    args: [name],
  });
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
        await client.execute({ sql: statement });
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
