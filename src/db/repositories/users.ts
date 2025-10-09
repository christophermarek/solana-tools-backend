import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import * as userPaymentHistoryRepository from "./user-payment-history.ts";
import type { DbUserPaymentHistory } from "./user-payment-history.ts";

function rowToDbUser(row: Record<string, unknown>): DbUser {
  return {
    id: row.id as string,
    telegram_id: row.telegram_id as string,
    role_id: row.role_id as string,
    credits_expire_at: row.credits_expire_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export interface DbUser {
  id: string;
  telegram_id: string;
  role_id: string;
  credits_expire_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUser(
  telegramId: string,
  requestId = "system",
): Promise<DbUser | null> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE telegram_id = ?",
      args: [telegramId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return rowToDbUser(result.rows[0]);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get user with telegram_id ${telegramId}`,
      error,
    );
    throw error;
  }
}

export async function createUser(
  telegramId: string,
  roleId: string = "user",
  requestId = "system",
): Promise<DbUser> {
  const client = getClient();
  try {
    const id = crypto.randomUUID();
    await client.execute({
      sql: `
        INSERT INTO users (
          id,
          telegram_id,
          role_id
        ) VALUES (?, ?, ?)
      `,
      args: [id, telegramId, roleId],
    });

    const result = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });

    const row = result.rows[0];
    const newUser: DbUser = {
      id: row.id as string,
      telegram_id: row.telegram_id as string,
      role_id: row.role_id as string,
      credits_expire_at: row.credits_expire_at as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };

    logging.info(
      requestId,
      `Created user with telegram_id ${telegramId} and role_id ${roleId}`,
    );
    return newUser;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to create user with telegram_id ${telegramId}`,
      error,
    );
    throw error;
  }
}

export async function getUserOrCreate(
  telegramId: string,
  requestId = "system",
): Promise<DbUser> {
  const existingUser = await getUser(telegramId, requestId);
  if (existingUser) {
    return existingUser;
  }
  return await createUser(telegramId, "user", requestId);
}

export interface UpdateUserParams {
  credits_expire_at?: Date | null;
}

export interface ProcessPaymentsParams {
  telegram_id: string;
  daysToRedeem: number;
  solPerDay: number;
}

export interface ProcessPaymentsResult {
  success: boolean;
  totalDaysRedeemed: number;
  totalSolSpent: number;
  paymentsProcessed: number;
  newExpiryDate: Date;
}

export async function processPayments(
  params: ProcessPaymentsParams,
  requestId = "system",
): Promise<[ProcessPaymentsResult, null] | [null, string]> {
  const client = getClient();

  try {
    const paymentsResult = await userPaymentHistoryRepository
      .getUnprocessedPayments(
        params.telegram_id,
        requestId,
      );

    if (paymentsResult[1]) {
      return [null, paymentsResult[1]];
    }

    if (!paymentsResult[0] || paymentsResult[0].length === 0) {
      return [null, "No unprocessed payments found to redeem"];
    }

    const unprocessedPayments = paymentsResult[0];
    const totalSolAvailable = unprocessedPayments.reduce(
      (sum, payment) => sum + payment.amount_in_sol,
      0,
    );

    const maxDaysFromAvailableSol = Math.floor(
      totalSolAvailable / params.solPerDay,
    );

    if (maxDaysFromAvailableSol < params.daysToRedeem) {
      return [
        null,
        `Insufficient SOL balance. Requested: ${params.daysToRedeem} days (${
          params.daysToRedeem * params.solPerDay
        } SOL). Available: ${totalSolAvailable} SOL (${maxDaysFromAvailableSol} days)`,
      ];
    }

    const daysToRedeem = params.daysToRedeem;

    const totalSolNeeded = daysToRedeem * params.solPerDay;
    let remainingSolNeeded = totalSolNeeded;
    const paymentsToProcess: Array<{
      payment: DbUserPaymentHistory;
      solToUse: number;
      daysFromThisPayment: number;
    }> = [];

    for (const payment of unprocessedPayments) {
      if (remainingSolNeeded <= 0) break;

      const solToUse = Math.min(payment.amount_in_sol, remainingSolNeeded);
      const daysFromThisPayment = Math.floor(solToUse / params.solPerDay);

      if (daysFromThisPayment > 0) {
        paymentsToProcess.push({
          payment,
          solToUse,
          daysFromThisPayment,
        });
        remainingSolNeeded -= daysFromThisPayment * params.solPerDay;
      }
    }

    let totalSolSpent = 0;
    let paymentsProcessed = 0;

    const batchOperations = [];

    for (
      const { payment, solToUse, daysFromThisPayment } of paymentsToProcess
    ) {
      batchOperations.push({
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
          payment.id,
          new Date().toISOString(),
          daysFromThisPayment,
          daysFromThisPayment * params.solPerDay,
        ],
      });

      if (solToUse < payment.amount_in_sol) {
        const remainingAmount = payment.amount_in_sol - solToUse;
        batchOperations.push({
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
            remainingAmount,
            `${payment.signature}_partial_${Date.now()}`,
            payment.deposited_at,
            null,
          ],
        });
      }

      batchOperations.push({
        sql: `
          UPDATE user_payment_history 
          SET processed_at = ?
          WHERE id = ?
        `,
        args: [new Date().toISOString(), payment.id],
      });
    }

    await client.batch(batchOperations);

    for (const { payment, daysFromThisPayment } of paymentsToProcess) {
      totalSolSpent += daysFromThisPayment * params.solPerDay;
      paymentsProcessed++;
    }

    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + daysToRedeem);

    const result: ProcessPaymentsResult = {
      success: true,
      totalDaysRedeemed: daysToRedeem,
      totalSolSpent,
      paymentsProcessed,
      newExpiryDate,
    };

    logging.info(requestId, "Processed payments successfully", {
      telegramId: params.telegram_id,
      daysRedeemed: daysToRedeem,
      totalSolSpent,
      paymentsProcessed,
      newExpiryDate: newExpiryDate.toISOString(),
    });

    return [result, null];
  } catch (error) {
    const errorMessage =
      `Failed to process payments for telegram_id ${params.telegram_id}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function updateUser(
  telegramId: string,
  params: UpdateUserParams,
  requestId = "system",
): Promise<[DbUser, null] | [null, string]> {
  const client = getClient();
  try {
    const updates: string[] = [];
    const values: (string | Date | null)[] = [];

    if (params.credits_expire_at !== undefined) {
      updates.push("credits_expire_at = ?");
      values.push(
        params.credits_expire_at
          ? params.credits_expire_at.toISOString()
          : null,
      );
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(telegramId);

    const sqlQuery = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE telegram_id = ?
    `;

    await client.execute({
      sql: sqlQuery,
      args: values,
    });

    const result = await client.execute({
      sql: "SELECT * FROM users WHERE telegram_id = ?",
      args: [telegramId],
    });

    if (result.rows.length === 0) {
      const errorMessage =
        `User with telegram_id ${telegramId} not found after update`;
      logging.error(requestId, errorMessage, new Error(errorMessage));
      return [null, errorMessage];
    }

    const updatedUser = rowToDbUser(result.rows[0]);

    logging.info(requestId, "Updated user", {
      telegramId,
      creditsExpireAt: updatedUser.credits_expire_at,
    });

    return [updatedUser, null];
  } catch (error) {
    const errorMessage = `Failed to update user with telegram_id ${telegramId}`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export default {
  getUser,
  createUser,
  getUserOrCreate,
  updateUser,
  processPayments,
};
