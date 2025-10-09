import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

function rowToDbCreditRedemptionHistory(
  row: Record<string, unknown>,
): DbCreditRedemptionHistory {
  return {
    id: row.id as number,
    telegram_id: row.telegram_id as string,
    payment_id: row.payment_id as number,
    redeemed_at: row.redeemed_at as string,
    days_purchased: row.days_purchased as number,
    sol_spent: row.sol_spent as number,
  };
}

export interface DbCreditRedemptionHistory {
  id: number;
  telegram_id: string;
  payment_id: number;
  redeemed_at: string;
  days_purchased: number;
  sol_spent: number;
}

export interface CreateCreditRedemptionHistoryParams {
  telegram_id: string;
  payment_id: number;
  days_purchased: number;
  sol_spent: number;
}

export async function create(
  params: CreateCreditRedemptionHistoryParams,
  requestId = "system",
): Promise<[DbCreditRedemptionHistory, null] | [null, string]> {
  const client = getClient();
  try {
    await client.execute({
      sql: `
        INSERT INTO credit_redemption_history (
          telegram_id,
          payment_id,
          redeemed_at,
          days_purchased,
          sol_spent
        ) VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        params.telegram_id,
        params.payment_id,
        params.days_purchased,
        params.sol_spent,
        new Date().toISOString(),
      ],
    });

    const result = await client.execute({
      sql:
        "SELECT * FROM credit_redemption_history WHERE id = last_insert_rowid()",
    });

    const newRedemption = rowToDbCreditRedemptionHistory(result.rows[0]);

    logging.info(requestId, "Created credit redemption history", {
      id: newRedemption.id,
      telegramId: newRedemption.telegram_id,
      paymentId: newRedemption.payment_id,
      daysPurchased: newRedemption.days_purchased,
      solSpent: newRedemption.sol_spent,
    });

    return [newRedemption, null];
  } catch (error) {
    const errorMessage =
      `Failed to create credit redemption history for telegram_id ${params.telegram_id}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function listByTelegramUserId(
  telegramUserId: string,
  requestId = "system",
): Promise<[DbCreditRedemptionHistory[], null] | [null, string]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM credit_redemption_history 
        WHERE telegram_id = ? 
        ORDER BY redeemed_at DESC
      `,
      args: [telegramUserId],
    });

    return [result.rows.map(rowToDbCreditRedemptionHistory), null];
  } catch (error) {
    const errorMessage =
      `Failed to list credit redemption history for user ${telegramUserId}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export default {
  create,
  listByTelegramUserId,
};
