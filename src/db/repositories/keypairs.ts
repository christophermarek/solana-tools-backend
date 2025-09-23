import { getClient } from "../client.ts";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as logging from "../../utils/logging.ts";

export type BalanceStatus = 'FRESH' | 'STALE' | 'UNKNOWN';

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
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    const stmt = client.prepare(`
      INSERT INTO keypairs (
        public_key,
        secret_key,
        label
      ) VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(keypair.publicKey.toString(), bs58.encode(keypair.secretKey), label);
    const insertedId = result.lastInsertRowid;
    const newKeypair = client.prepare(`
      SELECT * FROM keypairs WHERE id = ?
    `).get(insertedId) as DbKeypair;
    
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
    const result = client.prepare(`
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
    const result = client.prepare(`
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
    const result = client.prepare(`
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
    client.prepare(`
      UPDATE keypairs SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);
    
    const result = client.prepare(`
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
    client.prepare(`
      UPDATE keypairs SET is_active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);
    
    const result = client.prepare(`
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
    const values: any[] = [];

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

    client.prepare(sqlQuery).run(...values);
    
    const result = client.prepare(`
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
  const values: any[] = [];

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

  client.prepare(sqlQuery).run(...values);
  
  const result = client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ?
  `).get(publicKey) as DbKeypair;
  return result;
}

export function toKeypair(dbKeypair: DbKeypair): Keypair {
  const secretKey = bs58.decode(dbKeypair.secret_key);
  return Keypair.fromSecretKey(secretKey);
}

export async function listAll(): Promise<DbKeypair[]> {
  const client = getClient();
  const result = client.prepare(`
    SELECT * FROM keypairs ORDER BY created_at DESC
  `).all() as DbKeypair[];
  return result;
}

export async function searchWallets(
  searchTerm: string,
  includeInactive = false,
): Promise<DbKeypair[]> {
  const client = getClient();
  const searchPattern = `%${searchTerm}%`;

  let result;
  if (includeInactive) {
    result = client.prepare(`
      SELECT * FROM keypairs 
      WHERE public_key LIKE ? OR label LIKE ?
      ORDER BY created_at DESC
    `).all(searchPattern, searchPattern) as DbKeypair[];
  } else {
    result = client.prepare(`
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
  client.prepare(`
    UPDATE keypairs 
    SET 
      label = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(label, id);
  
  const result = client.prepare(`
    SELECT * FROM keypairs WHERE id = ?
  `).get(id) as DbKeypair | undefined;
  return result || null;
}

export async function findByIdIncludingInactive(
  id: number,
): Promise<DbKeypair | null> {
  const client = getClient();
  const result = client.prepare(`
    SELECT * FROM keypairs WHERE id = ?
  `).get(id) as DbKeypair | undefined;
  return result || null;
}

export async function deactivateById(id: number): Promise<void> {
  const client = getClient();
  client.prepare(`
    UPDATE keypairs 
    SET 
      is_active = 0, 
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
}

export async function reactivateById(id: number): Promise<void> {
  const client = getClient();
  client.prepare(`
    UPDATE keypairs 
    SET 
      is_active = 1, 
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);
}

export async function getWalletStats(): Promise<{
  total_wallets: number;
  active_wallets: number;
  inactive_wallets: number;
  total_sol_balance: string;
  total_wsol_balance: string;
}> {
  const client = getClient();

  const totalResult = client.prepare(`
    SELECT COUNT(*) as count FROM keypairs
  `).get() as { count: number };

  const activeResult = client.prepare(`
    SELECT COUNT(*) as count FROM keypairs WHERE is_active = 1
  `).get() as { count: number };

  const solResult = client.prepare(`
    SELECT COALESCE(SUM(sol_balance), 0) as balance 
    FROM keypairs 
    WHERE is_active = 1
  `).get() as { balance: number };

  const wsolResult = client.prepare(`
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
): Promise<DbKeypair> {
  const client = getClient();

  // Convert the base58 secret key to a Keypair
  const keyArray = bs58.decode(secretKey);
  const keypair = Keypair.fromSecretKey(keyArray);
  const publicKey = keypair.publicKey.toString();

  // Check if wallet already exists
  const existingWallet = client.prepare(`
    SELECT * FROM keypairs WHERE public_key = ?
  `).get(publicKey) as DbKeypair | undefined;

  if (existingWallet) {
    // If wallet exists but is inactive, reactivate it
    if (!existingWallet.is_active) {
      client.prepare(`
        UPDATE keypairs 
        SET 
          is_active = 1, 
          label = COALESCE(?, label),
          updated_at = CURRENT_TIMESTAMP
        WHERE public_key = ?
      `).run(label, publicKey);
      
      const result = client.prepare(`
        SELECT * FROM keypairs WHERE public_key = ?
      `).get(publicKey) as DbKeypair;
      return result;
    }
    // If wallet exists and is active, just return it
    return existingWallet;
  }

  // If wallet doesn't exist, create it
  const stmt = client.prepare(`
    INSERT INTO keypairs (
      public_key,
      secret_key,
      label
    ) VALUES (?, ?, ?)
  `);
  
  const result = stmt.run(publicKey, secretKey, label);
  const insertedId = result.lastInsertRowid;
  const newWallet = client.prepare(`
    SELECT * FROM keypairs WHERE id = ?
  `).get(insertedId) as DbKeypair;
  return newWallet;
}

export async function markWalletAsStale(
  id: number,
  requestId = "system",
): Promise<DbKeypair> {
  const client = getClient();
  try {
    client.prepare(`
      UPDATE keypairs
      SET balance_status = 'STALE', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    const result = client.prepare(`
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
    client.prepare(`
      UPDATE keypairs
      SET balance_status = 'STALE', updated_at = CURRENT_TIMESTAMP
      WHERE public_key = ?
    `).run(publicKey);
    
    const result = client.prepare(`
      SELECT * FROM keypairs WHERE public_key = ?
    `).get(publicKey) as DbKeypair;
    
    logging.info(requestId, `Marked wallet ${publicKey} as STALE`);
    return result;
  } catch (error) {
    logging.error(requestId, `Failed to mark wallet ${publicKey} as STALE`, error);
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
    const placeholders = ids.map(() => '?').join(',');
    client.prepare(`
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
