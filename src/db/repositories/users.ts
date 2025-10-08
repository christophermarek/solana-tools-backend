import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

function rowToDbUser(row: Record<string, unknown>): DbUser {
  return {
    id: row.id as string,
    telegram_id: row.telegram_id as string,
    role_id: row.role_id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

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
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE telegram_id = ?",
      args: [telegramId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return rowToDbUser(result.rows[0]);
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
    await client.execute({
      sql: `
        INSERT INTO users (
          id,
          telegram_id,
          role_id
        ) VALUES (?, ?, ?)
      `,
      args: [id, telegramId, roleId],
    });

    const result = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });

    const row = result.rows[0];
    const newUser: DbUser = {
      id: row.id as string,
      telegram_id: row.telegram_id as string,
      role_id: row.role_id as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

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
