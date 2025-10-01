import { getClient } from "../client.ts";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as logging from "../../utils/logging.ts";
import type { BindValue } from "../types.ts";
export interface WalletStats {
  total_wallets: number;
  total_sol_balance: string;
  total_wsol_balance: string;
}

export enum BalanceStatus {
  FRESH = "FRESH",
  STALE = "STALE",
  UNKNOWN = "UNKNOWN",
}

export interface DbKeypair {
  id: number;
  public_key: string;
  secret_key: string;
  created_at: string;
  updated_at: string;
  label?: string;
  sol_balance?: number;
  wsol_balance?: number;
  last_balance_update?: string;
  balance_status: BalanceStatus;
  owner_user_id: string;
}

export interface UpdateBalanceParams {
  sol_balance?: number;
  wsol_balance?: number;
  last_balance_update?: Date;
  balance_status?: BalanceStatus;
}

export async function create(
  keypair: Keypair,
  ownerUserId: string,
  label?: string,
  requestId: string = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    const stmt = client.prepare(`
      INSERT INTO keypairs (
        public_key,
        secret_key,
        label,
        balance_status,
        owner_user_id
      ) VALUES (?, ?, ?, ?, ?)
    `);

    await stmt.run(
      keypair.publicKey.toString(),
      bs58.encode(keypair.secretKey),
      label ?? null,
      BalanceStatus.UNKNOWN,
      ownerUserId,
    );
    const newKeypair = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ?
    `).get(keypair.publicKey.toString()) as DbKeypair;

    return newKeypair;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to create keypair ${keypair.publicKey.toString()}`,
      error,
    );
    throw error;
  }
}

export async function findById(
  id: number,
  ownerUserId: string,
  requestId = "system",
): Promise<DbKeypair | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ? AND owner_user_id = ?
    `).get(id, ownerUserId) as DbKeypair | undefined;
    return result || null;
  } catch (error) {
    logging.error(requestId, `Failed to find keypair with id ${id}`, error);
    throw error;
  }
}

export async function findByPublicKey(
  publicKey: string,
  ownerUserId: string,
  requestId = "system",
): Promise<DbKeypair | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?
    `).get(publicKey, ownerUserId) as DbKeypair | undefined;
    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find keypair with public key ${publicKey}`,
      error,
    );
    throw error;
  }
}

export async function listAll(
  ownerUserId: string,
  requestId = "system",
): Promise<DbKeypair[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE owner_user_id = ? ORDER BY created_at DESC
    `).all(ownerUserId) as DbKeypair[];
    return result;
  } catch (error) {
    logging.error(requestId, "Failed to list keypairs", error);
    throw error;
  }
}

export async function deleteById(
  id: number,
  ownerUserId: string,
  requestId = "system",
): Promise<void> {
  const client = getClient();
  try {
    const keypair = await findById(id, requestId);
    if (!keypair) {
      throw new Error(`Keypair with id ${id} not found`);
    }

    if (keypair.owner_user_id !== ownerUserId) {
      throw new Error(
        `Access denied: User ${ownerUserId} does not own keypair ${id}`,
      );
    }

    await client.prepare(`
      DELETE FROM keypairs WHERE id = ? AND owner_user_id = ?
    `).run(id, ownerUserId);
    logging.info(
      requestId,
      `Deleted keypair with id ${id} by owner ${ownerUserId}`,
    );
  } catch (error) {
    logging.error(
      requestId,
      `Failed to delete keypair with id ${id}`,
      error,
    );
    throw error;
  }
}

export async function updateBalance(
  id: number,
  params: UpdateBalanceParams,
  ownerUserId: string,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    const updates: string[] = [];
    const values: BindValue[] = [];

    if (params.sol_balance !== undefined) {
      updates.push("sol_balance = ?");
      values.push(params.sol_balance);
    }

    if (params.wsol_balance !== undefined) {
      updates.push("wsol_balance = ?");
      values.push(params.wsol_balance);
    }

    if (params.last_balance_update) {
      updates.push("last_balance_update = ?");
      values.push(params.last_balance_update.toISOString());
    } else {
      updates.push("last_balance_update = CURRENT_TIMESTAMP");
    }

    if (params.balance_status) {
      updates.push("balance_status = ?");
      values.push(params.balance_status);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, ownerUserId);

    const sqlQuery = `
      UPDATE keypairs 
      SET ${updates.join(", ")}
      WHERE id = ? AND owner_user_id = ?
    `;

    await client.prepare(sqlQuery).run(...values);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ? AND owner_user_id = ?
    `).get(id, ownerUserId) as DbKeypair;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update balance for keypair with id ${id}`,
      error,
    );
    throw error;
  }
}

export async function updateBalanceByPublicKey(
  publicKey: string,
  params: UpdateBalanceParams,
  ownerUserId: string,
  _requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();

  const updates: string[] = [];
  const values: (string | number | Date)[] = [];

  if (params.sol_balance !== undefined) {
    updates.push("sol_balance = ?");
    values.push(params.sol_balance);
  }

  if (params.wsol_balance !== undefined) {
    updates.push("wsol_balance = ?");
    values.push(params.wsol_balance);
  }

  if (params.last_balance_update) {
    updates.push("last_balance_update = ?");
    values.push(params.last_balance_update.toISOString());
  } else {
    updates.push("last_balance_update = CURRENT_TIMESTAMP");
  }

  if (params.balance_status) {
    updates.push("balance_status = ?");
    values.push(params.balance_status);
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(publicKey, ownerUserId);

  const sqlQuery = `
    UPDATE keypairs 
    SET ${updates.join(", ")}
    WHERE public_key = ? AND owner_user_id = ?
  `;

  await client.prepare(sqlQuery).run(...values);

  const result = await client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?
  `).get(publicKey, ownerUserId) as DbKeypair;
  return result;
}

export function toKeypair(secretKey: string): Keypair | null {
  try {
    const secretKeyBytes = bs58.decode(secretKey);
    return Keypair.fromSecretKey(secretKeyBytes);
  } catch (error) {
    logging.error("keypair", "Failed to convert secret key to keypair", {
      error,
    });
    return null;
  }
}

export async function updateLabel(
  id: number,
  label: string,
  ownerUserId: string,
  requestId = "system",
): Promise<DbKeypair | null> {
  const client = getClient();
  try {
    const keypair = await findById(id, requestId);
    if (!keypair) {
      throw new Error(`Keypair with id ${id} not found`);
    }

    if (keypair.owner_user_id !== ownerUserId) {
      throw new Error(
        `Access denied: User ${ownerUserId} does not own keypair ${id}`,
      );
    }

    await client.prepare(`
      UPDATE keypairs 
      SET 
        label = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_user_id = ?
    `).run(label ?? null, id, ownerUserId);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ?
    `).get(id) as DbKeypair | undefined;
    return result || null;
  } catch (error) {
    logging.error(requestId, `Failed to update label for keypair ${id}`, error);
    throw error;
  }
}

export async function importWallet(
  secretKey: string,
  ownerUserId: string,
  label?: string,
  _requestId = "system",
): Promise<[DbKeypair, null] | [null, string]> {
  try {
    const client = getClient();

    const keyArray = bs58.decode(secretKey);
    const keypair = Keypair.fromSecretKey(keyArray);
    const publicKey = keypair.publicKey.toString();

    const existingWallet = await client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?
  `).get(publicKey, ownerUserId) as DbKeypair | undefined;

    if (existingWallet) {
      return [existingWallet, null];
    }

    const stmt = client.prepare(`
    INSERT INTO keypairs (
      public_key,
      secret_key,
      label,
      balance_status,
      owner_user_id
    ) VALUES (?, ?, ?, ?, ?)
  `);

    await stmt.run(
      publicKey,
      secretKey,
      label ?? null,
      BalanceStatus.UNKNOWN,
      ownerUserId,
    );
    const newWallet = await client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ?
    `).get(publicKey) as DbKeypair;
    return [newWallet, null];
  } catch (error) {
    logging.error("keypair", `Failed to import wallet`, error);
    return [null, "Failed to import wallet"];
  }
}

export default {
  create,
  findById,
  findByPublicKey,
  listAll,
  deleteById,
  updateBalance,
  updateBalanceByPublicKey,
  toKeypair,
  updateLabel,
  importWallet,
};
