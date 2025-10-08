import { createClient } from "@libsql/client";
import { getConfig } from "../utils/env.ts";
import * as logging from "../utils/logging.ts";
import { migrate } from "./migrate.ts";

const TAG = "db/client";
export type DatabaseClient = ReturnType<typeof createClient>;

let client: DatabaseClient | null = null;

export async function initializeDb() {
  logging.info(TAG, "Starting database initialization...");

  if (client) {
    logging.info(TAG, "Client already exists, reusing existing connection");
    return client;
  }

  const config = getConfig();
  logging.info(TAG, "Loaded environment variables");

  try {
    logging.info(TAG, "Connecting to Turso database...");
    client = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
    });

    logging.info(TAG, "Database connection established successfully");

    logging.info(TAG, "Checking for pending migrations...");
    try {
      await migrate();
      logging.info(TAG, "Database migrations completed successfully");
    } catch (error) {
      logging.error(TAG, "Failed to run migrations", error);
      throw error;
    }
  } catch (error) {
    logging.error(TAG, "Failed to connect to database", error);
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
  if (client) {
    logging.info(TAG, "Closing database connection...");
    try {
      client.close();
      logging.info(TAG, "Database connection closed");
    } catch (error) {
      logging.error(TAG, "Error closing client", error);
    } finally {
      client = null;
    }
  }
}
