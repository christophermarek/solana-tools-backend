import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

function rowToDbUserPaymentHistory(
  row: Record<string, unknown>,
): DbUserPaymentHistory {
  return {
    id: row.id as number,
    telegram_id: row.telegram_id as string,
    amount_in_sol: row.amount_in_sol as number,
    signature: row.signature as string,
    deposited_at: row.deposited_at as string,
    processed_at: row.processed_at as string,
  };
}

export interface DbUserPaymentHistory {
  id: number;
  telegram_id: string;
  amount_in_sol: number;
  signature: string;
  deposited_at: string;
  processed_at: string;
}

export interface CreateUserPaymentHistoryParams {
  telegram_id: string;
  amount_in_sol: number;
  signature: string;
  deposited_at: Date;
}

export async function create(
  params: CreateUserPaymentHistoryParams,
  requestId = "system",
): Promise<[DbUserPaymentHistory, null] | [null, string]> {
  const client = getClient();
  try {
    await client.execute({
      sql: `
        INSERT INTO user_payment_history (
          telegram_id,
          amount_in_sol,
          signature,
          deposited_at,
          processed_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        params.telegram_id,
        params.amount_in_sol,
        params.signature,
        params.deposited_at.toISOString(),
        null, // processed_at
      ],
    });

    const result = await client.execute({
      sql: "SELECT * FROM user_payment_history WHERE signature = ?",
      args: [params.signature],
    });

    return [rowToDbUserPaymentHistory(result.rows[0]), null];
  } catch (error) {
    const errorMessage =
      `Failed to create user payment history for telegram_id ${params.telegram_id}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function listByTelegramUserId(
  telegramUserId: string,
  requestId = "system",
): Promise<[DbUserPaymentHistory[], null] | [null, string]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM user_payment_history 
        WHERE telegram_id = ? 
        ORDER BY deposited_at DESC
      `,
      args: [telegramUserId],
    });

    return [result.rows.map(rowToDbUserPaymentHistory), null];
  } catch (error) {
    const errorMessage =
      `Failed to list payment history for user ${telegramUserId}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function getUnprocessedPayments(
  telegramUserId: string,
  requestId = "system",
): Promise<[DbUserPaymentHistory[], null] | [null, string]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM user_payment_history 
        WHERE telegram_id = ? AND processed_at IS NULL
        ORDER BY deposited_at ASC
      `,
      args: [telegramUserId],
    });

    return [result.rows.map(rowToDbUserPaymentHistory), null];
  } catch (error) {
    const errorMessage =
      `Failed to get unprocessed payments for user ${telegramUserId}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function markAsProcessed(
  paymentId: number,
  requestId = "system",
): Promise<[null, null] | [null, string]> {
  const client = getClient();
  try {
    await client.execute({
      sql: `
        UPDATE user_payment_history 
        SET processed_at = ?
        WHERE id = ?
      `,
      args: [new Date().toISOString(), paymentId],
    });

    logging.info(requestId, "Marked payment as processed", {
      paymentId,
    });

    return [null, null];
  } catch (error) {
    const errorMessage = `Failed to mark payment ${paymentId} as processed`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export default {
  create,
  listByTelegramUserId,
  getUnprocessedPayments,
  markAsProcessed,
};
