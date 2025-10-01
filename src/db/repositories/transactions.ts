import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import type { BindValue } from "../types.ts";

export enum TransactionStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
}

export interface DbTransaction {
  id: number;
  signature: string;
  sender_wallet_id?: number;
  sender_public_key: string;
  status: TransactionStatus;
  slot?: number;
  priority_fee_unit_limit?: number;
  priority_fee_unit_price_lamports?: number;
  slippage_bps?: number;
  confirmed_at?: string;
  confirmation_slot?: number;
  commitment_level?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionParams {
  signature?: string;
  sender_wallet_id?: number;
  sender_public_key: string;
  status?: TransactionStatus;
  slot?: number;
  priority_fee_unit_limit?: number;
  priority_fee_unit_price_lamports?: number;
  slippage_bps?: number;
  confirmed_at?: Date;
  confirmation_slot?: number;
  commitment_level?: string;
  error_message?: string;
}

export interface UpdateTransactionParams {
  signature?: string;
  status?: TransactionStatus;
  slot?: number;
  priority_fee_unit_limit?: number;
  priority_fee_unit_price_lamports?: number;
  slippage_bps?: number;
  confirmed_at?: Date;
  confirmation_slot?: number;
  commitment_level?: string;
  error_message?: string;
}

export async function create(
  params: CreateTransactionParams,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();
  try {
    const stmt = client.prepare(`
      INSERT INTO transactions (
        signature,
        sender_wallet_id,
        sender_public_key,
        status,
        slot,
        priority_fee_unit_limit,
        priority_fee_unit_price_lamports,
        slippage_bps,
        confirmed_at,
        confirmation_slot,
        commitment_level,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      params.signature || null,
      params.sender_wallet_id || null,
      params.sender_public_key,
      params.status || TransactionStatus.PENDING,
      params.slot || null,
      params.priority_fee_unit_limit || null,
      params.priority_fee_unit_price_lamports || null,
      params.slippage_bps || null,
      params.confirmed_at?.toISOString() || null,
      params.confirmation_slot || null,
      params.commitment_level || null,
      params.error_message || null,
    );

    const newTransaction = await client.prepare(`
      SELECT * FROM transactions WHERE id = last_insert_rowid()
    `).get() as DbTransaction;

    return newTransaction;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to create transaction for ${params.sender_public_key}`,
      error,
    );
    throw error;
  }
}

export async function update(
  id: number,
  params: UpdateTransactionParams,
  requestId = "system",
): Promise<DbTransaction> {
  const client = getClient();
  try {
    const updates: string[] = [];
    const values: BindValue[] = [];

    if (params.signature !== undefined) {
      updates.push("signature = ?");
      values.push(params.signature);
    }

    if (params.status !== undefined) {
      updates.push("status = ?");
      values.push(params.status);
    }

    if (params.slot !== undefined) {
      updates.push("slot = ?");
      values.push(params.slot);
    }

    if (params.priority_fee_unit_limit !== undefined) {
      updates.push("priority_fee_unit_limit = ?");
      values.push(params.priority_fee_unit_limit);
    }

    if (params.priority_fee_unit_price_lamports !== undefined) {
      updates.push("priority_fee_unit_price_lamports = ?");
      values.push(params.priority_fee_unit_price_lamports);
    }

    if (params.slippage_bps !== undefined) {
      updates.push("slippage_bps = ?");
      values.push(params.slippage_bps);
    }

    if (params.confirmed_at !== undefined) {
      updates.push("confirmed_at = ?");
      values.push(params.confirmed_at.toISOString());
    }

    if (params.confirmation_slot !== undefined) {
      updates.push("confirmation_slot = ?");
      values.push(params.confirmation_slot);
    }

    if (params.commitment_level !== undefined) {
      updates.push("commitment_level = ?");
      values.push(params.commitment_level);
    }

    if (params.error_message !== undefined) {
      updates.push("error_message = ?");
      values.push(params.error_message);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const sqlQuery = `
      UPDATE transactions 
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    await client.prepare(sqlQuery).run(...values);

    const result = await client.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(id) as DbTransaction;
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update transaction with id ${id}`,
      error,
    );
    throw error;
  }
}

export default {
  create,
  update,
};
