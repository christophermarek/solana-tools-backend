import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

export interface DbUser {
  id: string;
  telegram_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}

export async function getUser(
  telegramId: string,
  requestId = "system",
): Promise<DbUser | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM users WHERE telegram_id = ?
    `).get(telegramId) as DbUser | undefined;
    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get user with telegram_id ${telegramId}`,
      error,
    );
    throw error;
  }
}

export async function createUser(
  telegramId: string,
  roleId: string = "user",
  requestId = "system",
): Promise<DbUser> {
  const client = getClient();
  try {
    const id = crypto.randomUUID();
    const stmt = client.prepare(`
      INSERT INTO users (
        id,
        telegram_id,
        role_id
      ) VALUES (?, ?, ?)
    `);

    stmt.run(id, telegramId, roleId);

    const newUser = await client.prepare(`
      SELECT * FROM users WHERE id = ?
    `).get(id) as DbUser;

    logging.info(
      requestId,
      `Created user with telegram_id ${telegramId} and role_id ${roleId}`,
    );
    return newUser;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to create user with telegram_id ${telegramId}`,
      error,
    );
    throw error;
  }
}

export async function getUserOrCreate(
  telegramId: string,
  requestId = "system",
): Promise<DbUser> {
  const existingUser = await getUser(telegramId, requestId);
  if (existingUser) {
    return existingUser;
  }
  return await createUser(telegramId, "user", requestId);
}

export default {
  getUser,
  createUser,
  getUserOrCreate,
};
