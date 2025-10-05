import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import type { BindValue } from "../types.ts";

export enum PumpFunTransactionType {
  BUY = "buy",
  SELL = "sell",
  CREATE_AND_BUY = "create-and-buy",
}

export interface DbBotExecutionTransaction {
  id: number;
  bot_execution_id: number;
  transaction_id: number;
  pump_fun_transaction_type: PumpFunTransactionType;
  created_at: string;
  updated_at: string;
}

export interface CreateBotExecutionTransactionParams {
  bot_execution_id: number;
  transaction_id: number;
  pump_fun_transaction_type: PumpFunTransactionType;
}

export async function create(
  params: CreateBotExecutionTransactionParams,
  requestId: string = "system",
): Promise<DbBotExecutionTransaction> {
  const client = getClient();
  try {
    const stmt = client.prepare(`
      INSERT INTO bot_execution_transactions (
        bot_execution_id,
        transaction_id,
        pump_fun_transaction_type
      ) VALUES (?, ?, ?)
    `);

    await stmt.run(
      params.bot_execution_id,
      params.transaction_id,
      params.pump_fun_transaction_type,
    );

    const newTransaction = await client.prepare(`
      SELECT * FROM bot_execution_transactions WHERE id = last_insert_rowid()
    `).get() as DbBotExecutionTransaction;

    logging.info(requestId, "Created bot execution transaction", {
      id: newTransaction.id,
      botExecutionId: newTransaction.bot_execution_id,
      transactionId: newTransaction.transaction_id,
      type: newTransaction.pump_fun_transaction_type,
    });

    return newTransaction;
  } catch (error) {
    logging.error(requestId, "Failed to create bot execution transaction", error);
    throw error;
  }
}

export async function findByBotExecutionId(
  botExecutionId: number,
  requestId: string = "system",
): Promise<DbBotExecutionTransaction[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_execution_transactions 
      WHERE bot_execution_id = ? 
      ORDER BY created_at ASC
    `).all(botExecutionId) as DbBotExecutionTransaction[];
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find bot execution transactions for execution ${botExecutionId}`,
      error,
    );
    throw error;
  }
}

export async function findByTransactionId(
  transactionId: number,
  requestId: string = "system",
): Promise<DbBotExecutionTransaction | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_execution_transactions WHERE transaction_id = ?
    `).get(transactionId) as DbBotExecutionTransaction | undefined;
    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find bot execution transaction for transaction ${transactionId}`,
      error,
    );
    throw error;
  }
}

export async function listByType(
  type: PumpFunTransactionType,
  requestId: string = "system",
): Promise<DbBotExecutionTransaction[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_execution_transactions 
      WHERE pump_fun_transaction_type = ? 
      ORDER BY created_at DESC
    `).all(type) as DbBotExecutionTransaction[];
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to list bot execution transactions by type ${type}`,
      error,
    );
    throw error;
  }
}

export async function countByBotExecutionId(
  botExecutionId: number,
  requestId: string = "system",
): Promise<number> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT COUNT(*) as count FROM bot_execution_transactions 
      WHERE bot_execution_id = ?
    `).get(botExecutionId) as { count: number };
    return result.count;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to count bot execution transactions for execution ${botExecutionId}`,
      error,
    );
    throw error;
  }
}
