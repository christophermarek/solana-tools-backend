import { initializeDb } from "./client.ts";
import {
  executeMigrationFile,
  getExecutedMigrations,
  getMigrationFiles,
  recordMigration,
} from "./repositories/migrations.ts";
import * as logging from "../utils/logging.ts";

export async function migrate() {
  await initializeDb();
  const requestId = "migration";

  try {
    const executedMigrations = await getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map((m) => m.name));
    const migrationFiles = await getMigrationFiles();

    for (const filename of migrationFiles) {
      const migrationName = filename.replace(".sql", "");
      if (!executedNames.has(migrationName)) {
        logging.info(requestId, `Running migration: ${migrationName}`);
        await executeMigrationFile(filename);
        await recordMigration(migrationName);
        logging.info(requestId, `Completed migration: ${migrationName}`);
      }
    }
  } catch (error) {
    logging.error(requestId, "Migration failed", error);
    throw error;
  }
}

if (import.meta.main) {
  migrate().catch((error) =>
    logging.error("migration", "Migration command failed", error)
  );
}
