import { getClient } from "../client.ts";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as logging from "../../utils/logging.ts";
import type { BindValue } from "../types.ts";
export interface WalletStats {
  total_wallets: number;
  active_wallets: number;
  inactive_wallets: number;
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
  is_active: number;
  sol_balance?: number;
  wsol_balance?: number;
  last_balance_update?: string;
  balance_status: BalanceStatus;
}

export interface UpdateBalanceParams {
  sol_balance?: number;
  wsol_balance?: number;
  last_balance_update?: Date;
  balance_status?: BalanceStatus;
}

export async function create(
  keypair: Keypair,
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
        balance_status
      ) VALUES (?, ?, ?, ?)
    `);

    await stmt.run(
      keypair.publicKey.toString(),
      bs58.encode(keypair.secretKey),
      label ?? null,
      BalanceStatus.UNKNOWN,
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
  requestId = "system",
): Promise<DbKeypair | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ? AND is_active = 1
    `).get(id) as DbKeypair | undefined;
    return result || null;
  } catch (error) {
    logging.error(requestId, `Failed to find keypair with id ${id}`, error);
    throw error;
  }
}

export async function findByPublicKey(
  publicKey: string,
  requestId = "system",
): Promise<DbKeypair | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ? AND is_active = 1
    `).get(publicKey) as DbKeypair | undefined;
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

export async function listActive(requestId = "system"): Promise<DbKeypair[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE is_active = 1 ORDER BY created_at DESC
    `).all() as DbKeypair[];
    return result;
  } catch (error) {
    logging.error(requestId, "Failed to list active keypairs", error);
    throw error;
  }
}

export async function deactivate(
  publicKey: string,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    await client.prepare(`
      UPDATE keypairs SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ?
    `).get(publicKey) as DbKeypair;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to deactivate keypair ${publicKey}`,
      error,
    );
    throw error;
  }
}

export async function reactivate(
  publicKey: string,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    await client.prepare(`
      UPDATE keypairs SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ?
    `).get(publicKey) as DbKeypair;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to reactivate keypair ${publicKey}`,
      error,
    );
    throw error;
  }
}

export async function updateBalance(
  id: number,
  params: UpdateBalanceParams,
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
    values.push(id);

    const sqlQuery = `
      UPDATE keypairs 
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    await client.prepare(sqlQuery).run(...values);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ?
    `).get(id) as DbKeypair;
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
  values.push(publicKey);

  const sqlQuery = `
    UPDATE keypairs 
    SET ${updates.join(", ")}
    WHERE public_key = ?
  `;

  await client.prepare(sqlQuery).run(...values);

  const result = await client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ?
  `).get(publicKey) as DbKeypair;
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

export async function listAll(): Promise<DbKeypair[]> {
  const client = getClient();
  const result = await client.prepare(`
    SELECT * FROM keypairs ORDER BY created_at DESC
  `).all() as DbKeypair[];
  return result;
}

export async function searchWallets(
  searchTerm: string,
  includeInactive: boolean = false,
): Promise<DbKeypair[]> {
  const client = getClient();
  const searchPattern = `%${searchTerm}%`;

  let result;
  if (includeInactive) {
    result = await client.prepare(`
      SELECT * FROM keypairs 
      WHERE public_key LIKE ? OR label LIKE ?
      ORDER BY created_at DESC
    `).all(searchPattern, searchPattern) as DbKeypair[];
  } else {
    result = await client.prepare(`
      SELECT * FROM keypairs 
      WHERE (public_key LIKE ? OR label LIKE ?)
        AND is_active = 1
      ORDER BY created_at DESC
    `).all(searchPattern, searchPattern) as DbKeypair[];
  }

  return result;
}

export async function createMultiple(
  count: number,
  label?: string,
): Promise<DbKeypair[]> {
  const wallets: DbKeypair[] = [];

  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    const wallet = await create(keypair, label);
    wallets.push(wallet);
  }

  return wallets;
}

export async function updateLabel(
  id: number,
  label: string,
): Promise<DbKeypair | null> {
  const client = getClient();
  await client.prepare(`
    UPDATE keypairs 
    SET 
      label = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(label ?? null, id);

  const result = await client.prepare(`
    SELECT * FROM keypairs WHERE id = ?
  `).get(id) as DbKeypair | undefined;
  return result || null;
}

export async function findByIdIncludingInactive(
  id: number,
): Promise<DbKeypair | null> {
  const client = getClient();
  const result = await client.prepare(`
    SELECT * FROM keypairs WHERE id = ?
  `).get(id) as DbKeypair | undefined;
  return result || null;
}

export async function deactivateById(id: number): Promise<void> {
  const client = getClient();
  await client.prepare(`
    UPDATE keypairs 
    SET 
      is_active = 0, 
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
}

export async function reactivateById(id: number): Promise<void> {
  const client = getClient();
  await client.prepare(`
    UPDATE keypairs 
    SET 
      is_active = 1, 
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
}

export async function getWalletStats(): Promise<WalletStats> {
  const client = getClient();

  const totalResult = await client.prepare(`
    SELECT COUNT(*) as count FROM keypairs
  `).get() as { count: number };

  const activeResult = await client.prepare(`
    SELECT COUNT(*) as count FROM keypairs WHERE is_active = 1
  `).get() as { count: number };

  const solResult = await client.prepare(`
    SELECT COALESCE(SUM(sol_balance), 0) as balance 
    FROM keypairs 
    WHERE is_active = 1
  `).get() as { balance: number };

  const wsolResult = await client.prepare(`
    SELECT COALESCE(SUM(wsol_balance), 0) as balance 
    FROM keypairs 
    WHERE is_active = 1
  `).get() as { balance: number };

  return {
    total_wallets: totalResult.count,
    active_wallets: activeResult.count,
    inactive_wallets: totalResult.count - activeResult.count,
    total_sol_balance: String(solResult.balance),
    total_wsol_balance: String(wsolResult.balance),
  };
}

export async function importWallet(
  secretKey: string,
  label?: string,
): Promise<[DbKeypair, null] | [null, string]> {
  try {
    const client = getClient();

    const keyArray = bs58.decode(secretKey);
    const keypair = Keypair.fromSecretKey(keyArray);
    const publicKey = keypair.publicKey.toString();

    const existingWallet = await client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ?
  `).get(publicKey) as DbKeypair | undefined;

    if (existingWallet) {
      if (!existingWallet.is_active) {
        await client.prepare(`
        UPDATE keypairs 
        SET 
          is_active = 1, 
          label = COALESCE(?, label),
          updated_at = CURRENT_TIMESTAMP
          balance_status = 'UNKNOWN'
        WHERE public_key = ?
      `).run(label ?? null, publicKey, BalanceStatus.UNKNOWN);

        const result = await client.prepare(`
        SELECT * FROM keypairs WHERE public_key = ?
      `).get(publicKey) as DbKeypair;
        return [result, null];
      }
      return [existingWallet, null];
    }

    const stmt = client.prepare(`
    INSERT INTO keypairs (
      public_key,
      secret_key,
      label,
      balance_status
    ) VALUES (?, ?, ?, ?)
  `);

    await stmt.run(
      publicKey,
      secretKey,
      label ?? null,
      BalanceStatus.UNKNOWN,
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

export async function markWalletAsStale(
  id: number,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    await client.prepare(`
      UPDATE keypairs
      SET balance_status = 'STALE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE id = ?
    `).get(id) as DbKeypair;

    logging.info(requestId, `Marked wallet ID ${id} as STALE`);
    return result;
  } catch (error) {
    logging.error(requestId, `Failed to mark wallet ID ${id} as STALE`, error);
    throw error;
  }
}

export async function markWalletAsStaleByPublicKey(
  publicKey: string,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    await client.prepare(`
      UPDATE keypairs
      SET balance_status = 'STALE', updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);

    const result = await client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ?
    `).get(publicKey) as DbKeypair;

    logging.info(requestId, `Marked wallet ${publicKey} as STALE`);
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to mark wallet ${publicKey} as STALE`,
      error,
    );
    throw error;
  }
}

export async function markWalletsAsStale(
  ids: number[],
  requestId = "system",
): Promise<void> {
  if (ids.length === 0) return;

  const client = getClient();
  try {
    const placeholders = ids.map(() => "?").join(",");
    await client.prepare(`
      UPDATE keypairs
      SET balance_status = 'STALE', updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `).run(...ids);
    logging.info(requestId, `Marked ${ids.length} wallets as STALE`);
  } catch (error) {
    logging.error(requestId, `Failed to mark wallets as STALE`, error);
    throw error;
  }
}

export default {
  create,
  findById,
  findByPublicKey,
  listActive,
  deactivate,
  updateBalance,
  updateBalanceByPublicKey,
  toKeypair,
  listAll,
  searchWallets,
  createMultiple,
  updateLabel,
  findByIdIncludingInactive,
  deactivateById,
  reactivateById,
  getWalletStats,
  importWallet,
  markWalletAsStale,
  markWalletAsStaleByPublicKey,
  markWalletsAsStale,
};
