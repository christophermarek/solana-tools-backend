import { Database } from "@db/sqlite";
import { getConfig } from "../utils/env.ts";
import * as logging from "../utils/logging.ts";
import { ensureDir } from "std/fs/mod.ts";
import { migrate } from "./migrate.ts";

export type DatabaseClient = Database;

let client: DatabaseClient | null = null;

export async function initializeDb() {
  const requestId = "system";
  logging.info(requestId, "Starting database initialization...");

  if (client) {
    logging.info(
      requestId,
      "Client already exists, reusing existing connection",
    );
    return client;
  }

  const config = await getConfig();
  logging.info(requestId, "Loaded environment variables");

  try {
    const dbPath = config.DB_PATH;
    const dbDir = dbPath.substring(0, dbPath.lastIndexOf("/"));

    if (dbDir) {
      await ensureDir(dbDir);
      logging.info(requestId, `Created database directory: ${dbDir}`);
    }

    logging.info(requestId, `Opening SQLite database: ${dbPath}`);
    client = new Database(dbPath);

    client.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA cache_size = 1000;
      PRAGMA temp_store = MEMORY;
    `);

    logging.info(requestId, "Database connection established successfully");

    logging.info(requestId, "Checking for pending migrations...");
    try {
      await migrate();
      logging.info(requestId, "Database migrations completed successfully");
    } catch (error) {
      logging.error(requestId, "Failed to run migrations", error);
      throw error;
    }
  } catch (error) {
    logging.error(requestId, "Failed to connect to database", {
      path: config.DB_PATH,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return client;
}

export function getClient(): DatabaseClient {
  if (!client) {
    throw new Error("Database not initialized. Call initializeDb first.");
  }
  return client;
}

export function closeDb() {
  const requestId = "system";
  if (client) {
    logging.info(requestId, "Closing database connection...");
    try {
      client.close();
      logging.info(requestId, "Database connection closed");
    } catch (error) {
      logging.error(requestId, "Error closing client", error);
    } finally {
      client = null;
    }
  }
}
