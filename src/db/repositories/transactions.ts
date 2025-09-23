import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

export interface DbTransaction {
  id: number;
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  external_destination: string | null;
  amount: number;
  fee_amount: number | null;
  token_type: string; // 'SOL' | 'WSOL' | etc
  status: string; // 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'FAILED'
  signature: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
  is_external: number;
  transaction_data: string | null;
}

export interface CreateTransactionParams {
  from_wallet_id: number | null;
  to_wallet_id: number | null;
  external_destination?: string | null;
  amount: number;
  fee_amount?: number | null;
  token_type: string;
  status: string;
  signature?: string | null;
  error_message?: string | null;
  is_external?: boolean;
  transaction_data?: Record<string, unknown> | null;
}

export async function createTransaction(
  params: CreateTransactionParams,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();

  try {
    const amount = params.amount;
    const fee_amount = params.fee_amount;

    const stmt = client.prepare(`
      INSERT INTO transactions (
        from_wallet_id,
        to_wallet_id,
        external_destination,
        amount,
        fee_amount,
        token_type,
        status,
        signature,
        error_message,
        is_external,
        transaction_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      params.from_wallet_id,
      params.to_wallet_id,
      params.external_destination ?? null,
      amount,
      fee_amount ?? null,
      params.token_type,
      params.status,
      params.signature ?? null,
      params.error_message ?? null,
      params.is_external === undefined ? 0 : (params.is_external ? 1 : 0),
      params.transaction_data ? JSON.stringify(params.transaction_data) : null
    );

    const insertedId = result.lastInsertRowid;
    const newTransaction = client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(insertedId) as DbTransaction;

    return newTransaction;
  } catch (error) {
    logging.error(requestId, "Failed to create transaction", error);
    throw error;
  }
}

export async function getTransactionById(
  id: number,
  requestId = "system",
): Promise<DbTransaction | null> {
  const client = getClient();
  try {
    const result = client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(id) as DbTransaction | undefined;

    return result || null;
  } catch (error) {
    logging.error(requestId, `Failed to get transaction with ID ${id}`, error);
    throw error;
  }
}

export async function getTransactionBySignature(
  signature: string,
  requestId = "system",
): Promise<DbTransaction | null> {
  const client = getClient();
  try {
    const result = client.prepare(`
      SELECT * FROM transactions WHERE signature = ?
    `).get(signature) as DbTransaction | undefined;

    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction with signature ${signature}`,
      error,
    );
    throw error;
  }
}

export async function updateTransactionStatus(
  id: number,
  status: string,
  signature?: string | null,
  errorMessage?: string | null,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();

  try {
    const updates: string[] = ["status = ?", "updated_at = CURRENT_TIMESTAMP"];
    const values: any[] = [status];

    if (signature !== undefined) {
      updates.push("signature = ?");
      values.push(signature);
    }

    if (errorMessage !== undefined) {
      updates.push("error_message = ?");
      values.push(errorMessage);
    }

    values.push(id);

    const query = `
      UPDATE transactions 
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    client.prepare(query).run(...values);
    
    const result = client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(id) as DbTransaction;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update status for transaction with ID ${id}`,
      error,
    );
    throw error;
  }
}

export async function updateTransactionFee(
  id: number,
  feeAmount: number,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();

  try {
    const fee_amount = feeAmount;

    client.prepare(`
      UPDATE transactions 
      SET fee_amount = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fee_amount, id);

    const result = client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(id) as DbTransaction;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update fee for transaction with ID ${id}`,
      error,
    );
    throw error;
  }
}

export async function getWalletTransactions(
  walletId: number,
  limit = 20,
  offset = 0,
  requestId = "system",
): Promise<DbTransaction[]> {
  const client = getClient();
  try {
    const result = client.prepare(`
      SELECT * FROM transactions 
      WHERE from_wallet_id = ? OR to_wallet_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(walletId, walletId, limit, offset) as DbTransaction[];

    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transactions for wallet with ID ${walletId}`,
      error,
    );
    throw error;
  }
}

export async function listTransactions(
  options: {
    status?: string;
    tokenType?: string;
    limit?: number;
    offset?: number;
  } = {},
  requestId = "system",
): Promise<DbTransaction[]> {
  const client = getClient();

  try {
    let query = `SELECT * FROM transactions WHERE 1=1`;
    const values: any[] = [];

    if (options.status) {
      query += ` AND status = ?`;
      values.push(options.status);
    }

    if (options.tokenType) {
      query += ` AND token_type = ?`;
      values.push(options.tokenType);
    }

    query += ` ORDER BY created_at DESC`;

    if (options.limit) {
      query += ` LIMIT ?`;
      values.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET ?`;
      values.push(options.offset);
    }

    const result = client.prepare(query).all(...values) as DbTransaction[];
    return result;
  } catch (error) {
    logging.error(requestId, "Failed to list transactions", error);
    throw error;
  }
}

export async function getWalletTransactionCount(
  walletId: number,
  requestId = "system",
): Promise<number> {
  const client = getClient();
  try {
    const result = client.prepare(`
      SELECT COUNT(*) as count FROM transactions 
      WHERE from_wallet_id = ? OR to_wallet_id = ?
    `).get(walletId, walletId) as { count: number };

    return result?.count || 0;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction count for wallet with ID ${walletId}`,
      error,
    );
    throw error;
  }
}

export async function updateTransactionData(
  id: number,
  data: Record<string, unknown>,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();

  try {
    client.prepare(`
      UPDATE transactions 
      SET transaction_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(data), id);

    const result = client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(id) as DbTransaction;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update data for transaction with ID ${id}`,
      error,
    );
    throw error;
  }
}
