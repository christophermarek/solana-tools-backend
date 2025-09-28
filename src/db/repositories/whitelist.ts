import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import { getUserOrCreate } from "./users.ts";

export async function getWhitelist(
  requestId = "system",
): Promise<DbWhitelistedUser[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT id, telegram_id, created_at, updated_at FROM whitelisted_telegram_users ORDER BY created_at DESC
    `).all() as DbWhitelistedUser[];

    return result;
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
    const result = await client.prepare(`
      SELECT COUNT(*) as count FROM whitelisted_telegram_users WHERE telegram_id = ?
    `).get(telegramId) as { count: number };

    return result.count > 0;
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
    const changes = await client.prepare(`
      DELETE FROM whitelisted_telegram_users WHERE telegram_id = ?
    `).run(telegramId);

    if (changes === 0) {
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
): Promise<DbWhitelistedUser> {
  const client = getClient();
  try {
    await getUserOrCreate(telegramId, requestId);

    const isAlreadyWhitelisted = await isTelegramUserWhitelisted(
      telegramId,
      requestId,
    );
    if (isAlreadyWhitelisted) {
      const existingUser = await client.prepare(`
        SELECT * FROM whitelisted_telegram_users WHERE telegram_id = ?
      `).get(telegramId) as DbWhitelistedUser;
      logging.info(
        requestId,
        `Telegram user ${telegramId} is already whitelisted`,
      );
      return existingUser;
    }

    const id = crypto.randomUUID();
    const stmt = client.prepare(`
      INSERT INTO whitelisted_telegram_users (
        id,
        telegram_id
      ) VALUES (?, ?)
    `);

    stmt.run(id, telegramId);

    const newWhitelistedUser = await client.prepare(`
      SELECT * FROM whitelisted_telegram_users WHERE id = ?
    `).get(id) as DbWhitelistedUser;

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
