import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import type { DbUser } from "./users.ts";
import { getUserOrCreate } from "./users.ts";

export async function getWhitelist(
  requestId = "system",
): Promise<DbUser[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql:
        "SELECT id, telegram_id, created_at, updated_at FROM whitelisted_telegram_users ORDER BY created_at DESC",
    });

    return result.rows.map((row) => ({
      id: row.id as string,
      telegram_id: row.telegram_id as string,
      role_id: "", // Not available in whitelist table
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }));
  } catch (error) {
    logging.error(requestId, "Failed to get whitelist", error);
    throw error;
  }
}

export async function isTelegramUserWhitelisted(
  telegramId: string,
  requestId = "system",
): Promise<boolean> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql:
        "SELECT COUNT(*) as count FROM whitelisted_telegram_users WHERE telegram_id = ?",
      args: [telegramId],
    });

    const row = result.rows[0];
    return (row.count as number) > 0;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to check if telegram user ${telegramId} is whitelisted`,
      error,
    );
    throw error;
  }
}

export async function removeTelegramUserFromWhitelist(
  telegramId: string,
  requestId = "system",
): Promise<void> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "DELETE FROM whitelisted_telegram_users WHERE telegram_id = ?",
      args: [telegramId],
    });

    if (result.rowsAffected === 0) {
      logging.warn(
        requestId,
        `No whitelisted user found with telegram_id ${telegramId} to remove`,
      );
    } else {
      logging.info(
        requestId,
        `Removed telegram user ${telegramId} from whitelist`,
      );
    }
  } catch (error) {
    logging.error(
      requestId,
      `Failed to remove telegram user ${telegramId} from whitelist`,
      error,
    );
    throw error;
  }
}

export async function addTelegramUserToWhitelist(
  telegramId: string,
  requestId = "system",
): Promise<DbUser> {
  const client = getClient();
  try {
    await getUserOrCreate(telegramId, requestId);

    const isAlreadyWhitelisted = await isTelegramUserWhitelisted(
      telegramId,
      requestId,
    );
    if (isAlreadyWhitelisted) {
      const existingResult = await client.execute({
        sql: "SELECT * FROM whitelisted_telegram_users WHERE telegram_id = ?",
        args: [telegramId],
      });

      const row = existingResult.rows[0];
      const existingUser: DbUser = {
        id: row.id as string,
        telegram_id: row.telegram_id as string,
        role_id: "",
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
      };
      logging.info(
        requestId,
        `Telegram user ${telegramId} is already whitelisted`,
      );
      return existingUser;
    }

    const id = crypto.randomUUID();
    await client.execute({
      sql: `
        INSERT INTO whitelisted_telegram_users (
          id,
          telegram_id
        ) VALUES (?, ?)
      `,
      args: [id, telegramId],
    });

    const newResult = await client.execute({
      sql: "SELECT * FROM whitelisted_telegram_users WHERE id = ?",
      args: [id],
    });

    const row = newResult.rows[0];
    const newWhitelistedUser: DbUser = {
      id: row.id as string,
      telegram_id: row.telegram_id as string,
      role_id: "", // Not available in whitelist table
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    logging.info(requestId, `Added telegram user ${telegramId} to whitelist`);
    return newWhitelistedUser;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to add telegram user ${telegramId} to whitelist`,
      error,
    );
    throw error;
  }
}

export default {
  getWhitelist,
  isTelegramUserWhitelisted,
  removeTelegramUserFromWhitelist,
  addTelegramUserToWhitelist,
};
