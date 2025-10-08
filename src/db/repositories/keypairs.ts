import { getClient } from "../client.ts";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import * as logging from "../../utils/logging.ts";
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
    await client.execute({
      sql: `
        INSERT INTO keypairs (
          public_key,
          secret_key,
          label,
          balance_status,
          owner_user_id
        ) VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        keypair.publicKey.toString(),
        bs58.encode(keypair.secretKey),
        label ?? null,
        BalanceStatus.UNKNOWN,
        ownerUserId,
      ],
    });

    const result = await client.execute({
      sql: "SELECT * FROM keypairs WHERE public_key = ?",
      args: [keypair.publicKey.toString()],
    });

    const row = result.rows[0];
    return {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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
    const result = await client.execute({
      sql: "SELECT * FROM keypairs WHERE id = ? AND owner_user_id = ?",
      args: [id, ownerUserId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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
    const result = await client.execute({
      sql: "SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?",
      args: [publicKey, ownerUserId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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
    const result = await client.execute({
      sql:
        "SELECT * FROM keypairs WHERE owner_user_id = ? ORDER BY created_at DESC",
      args: [ownerUserId],
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    }));
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
    const keypair = await findById(id, ownerUserId, requestId);
    if (!keypair) {
      throw new Error(`Keypair with id ${id} not found`);
    }

    if (keypair.owner_user_id !== ownerUserId) {
      throw new Error(
        `Access denied: User ${ownerUserId} does not own keypair ${id}`,
      );
    }

    await client.execute({
      sql: "DELETE FROM keypairs WHERE id = ? AND owner_user_id = ?",
      args: [id, ownerUserId],
    });
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
    values.push(id, ownerUserId);

    const sqlQuery = `
      UPDATE keypairs 
      SET ${updates.join(", ")}
      WHERE id = ? AND owner_user_id = ?
    `;

    await client.execute({
      sql: sqlQuery,
      args: values,
    });

    const result = await client.execute({
      sql: "SELECT * FROM keypairs WHERE id = ? AND owner_user_id = ?",
      args: [id, ownerUserId],
    });

    const row = result.rows[0];
    return {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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

  await client.execute({
    sql: sqlQuery,
    args: values,
  });

  const result = await client.execute({
    sql: "SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?",
    args: [publicKey, ownerUserId],
  });

  const row = result.rows[0];
  return {
    id: row.id as number,
    public_key: row.public_key as string,
    secret_key: row.secret_key as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    label: row.label as string | undefined,
    sol_balance: row.sol_balance as number | undefined,
    wsol_balance: row.wsol_balance as number | undefined,
    last_balance_update: row.last_balance_update as string | undefined,
    balance_status: row.balance_status as BalanceStatus,
    owner_user_id: row.owner_user_id as string,
  };
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
    const keypair = await findById(id, ownerUserId, requestId);
    if (!keypair) {
      throw new Error(`Keypair with id ${id} not found`);
    }

    if (keypair.owner_user_id !== ownerUserId) {
      throw new Error(
        `Access denied: User ${ownerUserId} does not own keypair ${id}`,
      );
    }

    await client.execute({
      sql: `
        UPDATE keypairs 
        SET 
          label = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND owner_user_id = ?
      `,
      args: [label ?? null, id, ownerUserId],
    });

    const result = await client.execute({
      sql: "SELECT * FROM keypairs WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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

    const existingResult = await client.execute({
      sql: "SELECT * FROM keypairs WHERE public_key = ? AND owner_user_id = ?",
      args: [publicKey, ownerUserId],
    });

    if (existingResult.rows.length > 0) {
      const row = existingResult.rows[0];
      const existingWallet: DbKeypair = {
        id: row.id as number,
        public_key: row.public_key as string,
        secret_key: row.secret_key as string,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        label: row.label as string | undefined,
        sol_balance: row.sol_balance as number | undefined,
        wsol_balance: row.wsol_balance as number | undefined,
        last_balance_update: row.last_balance_update as string | undefined,
        balance_status: row.balance_status as BalanceStatus,
        owner_user_id: row.owner_user_id as string,
      };
      return [existingWallet, null];
    }

    await client.execute({
      sql: `
        INSERT INTO keypairs (
          public_key,
          secret_key,
          label,
          balance_status,
          owner_user_id
        ) VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        publicKey,
        secretKey,
        label ?? null,
        BalanceStatus.UNKNOWN,
        ownerUserId,
      ],
    });

    const newResult = await client.execute({
      sql: "SELECT * FROM keypairs WHERE public_key = ?",
      args: [publicKey],
    });

    const row = newResult.rows[0];
    const newWallet: DbKeypair = {
      id: row.id as number,
      public_key: row.public_key as string,
      secret_key: row.secret_key as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      label: row.label as string | undefined,
      sol_balance: row.sol_balance as number | undefined,
      wsol_balance: row.wsol_balance as number | undefined,
      last_balance_update: row.last_balance_update as string | undefined,
      balance_status: row.balance_status as BalanceStatus,
      owner_user_id: row.owner_user_id as string,
    };
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
