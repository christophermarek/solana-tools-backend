import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import * as botExecutionTransactionRepo from "./bot-execution-transactions.ts";
import type { PumpFunTransactionType } from "./bot-execution-transactions.ts";

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
  transaction_fee_sol?: number;
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
  transaction_fee_sol?: number;
  bot_execution_id?: number;
  pump_fun_transaction_type?: PumpFunTransactionType;
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
    await client.execute({
      sql: `
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
          error_message,
          transaction_fee_sol
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
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
        params.transaction_fee_sol || null,
      ],
    });

    const newResult = await client.execute({
      sql: "SELECT * FROM transactions WHERE id = last_insert_rowid()",
    });

    const row = newResult.rows[0];
    const newTransaction: DbTransaction = {
      id: row.id as number,
      signature: row.signature as string,
      sender_wallet_id: row.sender_wallet_id as number | undefined,
      sender_public_key: row.sender_public_key as string,
      status: row.status as TransactionStatus,
      slot: row.slot as number | undefined,
      priority_fee_unit_limit: row.priority_fee_unit_limit as
        | number
        | undefined,
      priority_fee_unit_price_lamports: row.priority_fee_unit_price_lamports as
        | number
        | undefined,
      slippage_bps: row.slippage_bps as number | undefined,
      confirmed_at: row.confirmed_at as string | undefined,
      confirmation_slot: row.confirmation_slot as number | undefined,
      commitment_level: row.commitment_level as string | undefined,
      error_message: row.error_message as string | undefined,
      transaction_fee_sol: row.transaction_fee_sol as number | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    if (params.bot_execution_id && params.pump_fun_transaction_type) {
      try {
        await botExecutionTransactionRepo.create({
          bot_execution_id: params.bot_execution_id,
          transaction_id: newTransaction.id,
          pump_fun_transaction_type: params.pump_fun_transaction_type,
        });
      } catch (error) {
        logging.warn(
          requestId,
          "Failed to create bot execution transaction record",
          error,
        );
      }
    }

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
    const values: (string | number | Date)[] = [];

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

    await client.execute({
      sql: sqlQuery,
      args: values,
    });

    const result = await client.execute({
      sql: "SELECT * FROM transactions WHERE id = ?",
      args: [id],
    });

    const row = result.rows[0];
    return {
      id: row.id as number,
      signature: row.signature as string,
      sender_wallet_id: row.sender_wallet_id as number | undefined,
      sender_public_key: row.sender_public_key as string,
      status: row.status as TransactionStatus,
      slot: row.slot as number | undefined,
      priority_fee_unit_limit: row.priority_fee_unit_limit as
        | number
        | undefined,
      priority_fee_unit_price_lamports: row.priority_fee_unit_price_lamports as
        | number
        | undefined,
      slippage_bps: row.slippage_bps as number | undefined,
      confirmed_at: row.confirmed_at as string | undefined,
      confirmation_slot: row.confirmation_slot as number | undefined,
      commitment_level: row.commitment_level as string | undefined,
      error_message: row.error_message as string | undefined,
      transaction_fee_sol: row.transaction_fee_sol as number | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update transaction with id ${id}`,
      error,
    );
    throw error;
  }
}

export async function findById(
  id: number,
  requestId: string = "system",
): Promise<DbTransaction | null> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM transactions WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      signature: row.signature as string,
      sender_wallet_id: row.sender_wallet_id as number | undefined,
      sender_public_key: row.sender_public_key as string,
      status: row.status as TransactionStatus,
      slot: row.slot as number | undefined,
      priority_fee_unit_limit: row.priority_fee_unit_limit as
        | number
        | undefined,
      priority_fee_unit_price_lamports: row.priority_fee_unit_price_lamports as
        | number
        | undefined,
      slippage_bps: row.slippage_bps as number | undefined,
      confirmed_at: row.confirmed_at as string | undefined,
      confirmation_slot: row.confirmation_slot as number | undefined,
      commitment_level: row.commitment_level as string | undefined,
      error_message: row.error_message as string | undefined,
      transaction_fee_sol: row.transaction_fee_sol as number | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find transaction with id ${id}`,
      error,
    );
    throw error;
  }
}

export default {
  create,
  update,
  findById,
};
