import { initializeDb } from "./client.ts";
import {
  getExecutedMigrations,
  initializeMigrationTable,
  recordMigration,
  removeMigration,
  getMigrationFiles,
  executeMigrationFile,
  rollbackMigration,
} from "./repositories/migrations.ts";
import * as logging from "../utils/logging.ts";

export async function migrate(direction: "up" | "down" = "up") {
  const _client = await initializeDb();
  const requestId = "migration";

  try {
    await initializeMigrationTable();

    const executedMigrations = await getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map((m) => m.name));
    const migrationFiles = await getMigrationFiles();

    if (direction === "up") {
      for (const filename of migrationFiles) {
        const migrationName = filename.replace('.sql', '');
        if (!executedNames.has(migrationName)) {
          logging.info(requestId, `Running migration: ${migrationName}`);
          await executeMigrationFile(filename);
          await recordMigration(migrationName);
          logging.info(requestId, `Completed migration: ${migrationName}`);
        }
      }
    } else {
      const reversedFiles = [...migrationFiles].reverse();

      for (const filename of reversedFiles) {
        const migrationName = filename.replace('.sql', '');
        if (executedNames.has(migrationName)) {
          logging.info(requestId, `Rolling back migration: ${migrationName}`);
          try {
            await rollbackMigration(filename);
            await removeMigration(migrationName);
            logging.info(requestId, `Rolled back migration: ${migrationName}`);
          } catch (error) {
            logging.error(
              requestId,
              `Error rolling back migration ${migrationName}`,
              error,
            );
            const message = error instanceof Error
              ? error.message
              : String(error);

            if (
              message.includes("depend on it") ||
              message.includes("foreign key constraint")
            ) {
              logging.error(
                requestId,
                `
This error occurred because tables are being dropped in the wrong order.
The rollback functions should drop dependent tables first.
Check if there are any tables with foreign keys referencing the table you're trying to drop.
              `,
                new Error("Foreign key constraint violation"),
              );
            }

            const answer = prompt("Continue with other migrations? (y/n)");
            if (answer?.toLowerCase() !== "y") {
              throw new Error("Migration rollback aborted by user");
            }
          }
        }
      }
    }
  } catch (error) {
    logging.error(requestId, "Migration failed", error);
    throw error;
  }
}

if (import.meta.main) {
  const direction = Deno.args[0] as "up" | "down" || "up";
  migrate(direction).catch((error) =>
    logging.error("migration", "Migration command failed", error)
  );
}
