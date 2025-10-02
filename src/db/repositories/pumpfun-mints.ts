import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

export interface DbPumpfunMint {
  id: number;
  mint_public_key: string;
  telegram_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePumpfunMintParams {
  mint_public_key: string;
  telegram_user_id: string;
}

export async function create(
  params: CreatePumpfunMintParams,
  requestId = "system",
): Promise<DbPumpfunMint> {
  const client = getClient();
  try {
    const stmt = client.prepare(`
      INSERT INTO pumpfun_mints (
        mint_public_key,
        telegram_user_id
      ) VALUES (?, ?)
    `);

    await stmt.run(
      params.mint_public_key,
      params.telegram_user_id,
    );

    const newMint = await client.prepare(`
      SELECT * FROM pumpfun_mints WHERE id = last_insert_rowid()
    `).get() as DbPumpfunMint;

    logging.info(
      requestId,
      `Created pumpfun mint ${params.mint_public_key} for user ${params.telegram_user_id}`,
    );

    return newMint;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to create pumpfun mint for ${params.mint_public_key}`,
      error,
    );
    throw error;
  }
}

export async function findByMintPublicKey(
  mintPublicKey: string,
  requestId = "system",
): Promise<DbPumpfunMint | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM pumpfun_mints WHERE mint_public_key = ?
    `).get(mintPublicKey) as DbPumpfunMint | undefined;
    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find pumpfun mint with public key ${mintPublicKey}`,
      error,
    );
    throw error;
  }
}

export async function listByTelegramUserId(
  telegramUserId: string,
  requestId = "system",
): Promise<DbPumpfunMint[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM pumpfun_mints 
      WHERE telegram_user_id = ? 
      ORDER BY created_at DESC
    `).all(telegramUserId) as DbPumpfunMint[];
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to list pumpfun mints for user ${telegramUserId}`,
      error,
    );
    throw error;
  }
}

export async function deleteByMintPublicKey(
  mintPublicKey: string,
  telegramUserId: string,
  requestId = "system",
): Promise<void> {
  const client = getClient();
  try {
    const mint = await findByMintPublicKey(mintPublicKey, requestId);
    if (!mint) {
      throw new Error(
        `Pumpfun mint with public key ${mintPublicKey} not found`,
      );
    }

    if (mint.telegram_user_id !== telegramUserId) {
      throw new Error(
        `Access denied: User ${telegramUserId} does not own mint ${mintPublicKey}`,
      );
    }

    await client.prepare(`
      DELETE FROM pumpfun_mints WHERE mint_public_key = ? AND telegram_user_id = ?
    `).run(mintPublicKey, telegramUserId);

    logging.info(
      requestId,
      `Deleted pumpfun mint ${mintPublicKey} by user ${telegramUserId}`,
    );
  } catch (error) {
    logging.error(
      requestId,
      `Failed to delete pumpfun mint ${mintPublicKey}`,
      error,
    );
    throw error;
  }
}

export default {
  create,
  findByMintPublicKey,
  listByTelegramUserId,
  deleteByMintPublicKey,
};
