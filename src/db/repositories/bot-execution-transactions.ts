import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

function rowToDbBotExecutionTransaction(
  row: Record<string, unknown>,
): DbBotExecutionTransaction {
  return {
    id: row.id as number,
    bot_execution_id: row.bot_execution_id as number,
    transaction_id: row.transaction_id as number,
    pump_fun_transaction_type: row
      .pump_fun_transaction_type as PumpFunTransactionType,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

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
    await client.execute({
      sql: `
        INSERT INTO bot_execution_transactions (
          bot_execution_id,
          transaction_id,
          pump_fun_transaction_type
        ) VALUES (?, ?, ?)
      `,
      args: [
        params.bot_execution_id,
        params.transaction_id,
        params.pump_fun_transaction_type,
      ],
    });

    const newResult = await client.execute({
      sql:
        "SELECT * FROM bot_execution_transactions WHERE id = last_insert_rowid()",
    });

    const newTransaction = rowToDbBotExecutionTransaction(newResult.rows[0]);

    logging.info(requestId, "Created bot execution transaction", {
      id: newTransaction.id,
      botExecutionId: newTransaction.bot_execution_id,
      transactionId: newTransaction.transaction_id,
      type: newTransaction.pump_fun_transaction_type,
    });

    return newTransaction;
  } catch (error) {
    logging.error(
      requestId,
      "Failed to create bot execution transaction",
      error,
    );
    throw error;
  }
}

export async function findByBotExecutionId(
  botExecutionId: number,
  requestId: string = "system",
): Promise<DbBotExecutionTransaction[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM bot_execution_transactions 
        WHERE bot_execution_id = ? 
        ORDER BY created_at ASC
      `,
      args: [botExecutionId],
    });

    return result.rows.map(rowToDbBotExecutionTransaction);
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
    const result = await client.execute({
      sql: "SELECT * FROM bot_execution_transactions WHERE transaction_id = ?",
      args: [transactionId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return rowToDbBotExecutionTransaction(result.rows[0]);
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
    const result = await client.execute({
      sql: `
        SELECT * FROM bot_execution_transactions 
        WHERE pump_fun_transaction_type = ? 
        ORDER BY created_at DESC
      `,
      args: [type],
    });

    return result.rows.map(rowToDbBotExecutionTransaction);
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
    const result = await client.execute({
      sql: `
        SELECT COUNT(*) as count FROM bot_execution_transactions 
        WHERE bot_execution_id = ?
      `,
      args: [botExecutionId],
    });

    const row = result.rows[0];
    return row.count as number;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to count bot execution transactions for execution ${botExecutionId}`,
      error,
    );
    throw error;
  }
}
