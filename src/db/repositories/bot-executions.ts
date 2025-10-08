import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

export enum BotExecutionStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface DbBotExecution {
  id: number;
  bot_type: string;
  bot_params: string;
  wallet_id: number;
  owner_user_id: string;
  status: BotExecutionStatus;
  total_cycles: number;
  successful_cycles: number;
  failed_cycles: number;
  execution_time_ms: number;
  bot_specific_results?: string;
  errors?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface CreateBotExecutionParams {
  bot_type: string;
  bot_params: string;
  wallet_id: number;
  owner_user_id: string;
}

export interface UpdateBotExecutionParams {
  status?: BotExecutionStatus;
  total_cycles?: number;
  successful_cycles?: number;
  failed_cycles?: number;
  execution_time_ms?: number;
  bot_specific_results?: string;
  errors?: string;
  started_at?: Date;
  completed_at?: Date;
}

export async function create(
  params: CreateBotExecutionParams,
  requestId: string = "system",
): Promise<DbBotExecution> {
  const client = getClient();
  try {
    await client.execute({
      sql: `
        INSERT INTO bot_executions (
          bot_type,
          bot_params,
          wallet_id,
          owner_user_id,
          status
        ) VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        params.bot_type,
        params.bot_params,
        params.wallet_id,
        params.owner_user_id,
        BotExecutionStatus.PENDING,
      ],
    });

    const result = await client.execute({
      sql: `
        SELECT * FROM bot_executions 
        WHERE wallet_id = ? AND bot_type = ? AND owner_user_id = ? AND status = ?
        ORDER BY created_at DESC 
        LIMIT 1
      `,
      args: [
        params.wallet_id,
        params.bot_type,
        params.owner_user_id,
        BotExecutionStatus.PENDING,
      ],
    });

    const row = result.rows[0];
    const newExecution: DbBotExecution = {
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    };

    logging.info(requestId, "Created bot execution", {
      id: newExecution.id,
      botType: newExecution.bot_type,
      walletId: newExecution.wallet_id,
      ownerUserId: newExecution.owner_user_id,
    });

    return newExecution;
  } catch (error) {
    logging.error(requestId, "Failed to create bot execution", error);
    throw error;
  }
}

export async function findById(
  id: number,
  ownerUserId: string,
  requestId: string = "system",
): Promise<DbBotExecution | null> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM bot_executions WHERE id = ? AND owner_user_id = ?",
      args: [id, ownerUserId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    };
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find bot execution with id ${id} for owner ${ownerUserId}`,
      error,
    );
    throw error;
  }
}

export async function update(
  id: number,
  params: UpdateBotExecutionParams,
  ownerUserId: string,
  requestId: string = "system",
): Promise<DbBotExecution> {
  const client = getClient();
  try {
    const updates: string[] = [];
    const values: (string | number | Date)[] = [];

    if (params.status !== undefined) {
      updates.push("status = ?");
      values.push(params.status);
    }

    if (params.total_cycles !== undefined) {
      updates.push("total_cycles = ?");
      values.push(params.total_cycles);
    }

    if (params.successful_cycles !== undefined) {
      updates.push("successful_cycles = ?");
      values.push(params.successful_cycles);
    }

    if (params.failed_cycles !== undefined) {
      updates.push("failed_cycles = ?");
      values.push(params.failed_cycles);
    }

    if (params.execution_time_ms !== undefined) {
      updates.push("execution_time_ms = ?");
      values.push(params.execution_time_ms);
    }

    if (params.bot_specific_results !== undefined) {
      updates.push("bot_specific_results = ?");
      values.push(params.bot_specific_results);
    }

    if (params.errors !== undefined) {
      updates.push("errors = ?");
      values.push(params.errors);
    }

    if (params.started_at) {
      updates.push("started_at = ?");
      values.push(params.started_at.toISOString());
    }

    if (params.completed_at) {
      updates.push("completed_at = ?");
      values.push(params.completed_at.toISOString());
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, ownerUserId);

    const sqlQuery = `
      UPDATE bot_executions 
      SET ${updates.join(", ")}
      WHERE id = ? AND owner_user_id = ?
    `;

    await client.execute({
      sql: sqlQuery,
      args: values,
    });

    const result = await client.execute({
      sql: "SELECT * FROM bot_executions WHERE id = ? AND owner_user_id = ?",
      args: [id, ownerUserId],
    });

    if (result.rows.length === 0) {
      throw new Error(`Bot execution with id ${id} not found after update`);
    }

    const row = result.rows[0];
    const updatedExecution: DbBotExecution = {
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    };

    logging.info(requestId, "Updated bot execution", {
      id,
      status: updatedExecution.status,
      ownerUserId,
    });

    return updatedExecution;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update bot execution with id ${id} for owner ${ownerUserId}`,
      error,
    );
    throw error;
  }
}

export async function listByStatus(
  status: BotExecutionStatus,
  requestId: string = "system",
): Promise<DbBotExecution[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM bot_executions 
        WHERE status = ? 
        ORDER BY created_at DESC
      `,
      args: [status],
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    }));
  } catch (error) {
    logging.error(
      requestId,
      `Failed to list bot executions with status ${status}`,
      error,
    );
    throw error;
  }
}

export async function listByWalletId(
  walletId: number,
  ownerUserId: string,
  requestId: string = "system",
): Promise<DbBotExecution[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM bot_executions 
        WHERE wallet_id = ? AND owner_user_id = ?
        ORDER BY created_at DESC
      `,
      args: [walletId, ownerUserId],
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    }));
  } catch (error) {
    logging.error(
      requestId,
      `Failed to list bot executions for wallet ${walletId} and owner ${ownerUserId}`,
      error,
    );
    throw error;
  }
}

export async function listRecent(
  ownerUserId: string,
  limit: number = 50,
  requestId: string = "system",
): Promise<DbBotExecution[]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT * FROM bot_executions 
        WHERE owner_user_id = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `,
      args: [ownerUserId, limit],
    });

    return result.rows.map((row) => ({
      id: row.id as number,
      bot_type: row.bot_type as string,
      bot_params: row.bot_params as string,
      wallet_id: row.wallet_id as number,
      owner_user_id: row.owner_user_id as string,
      status: row.status as BotExecutionStatus,
      total_cycles: row.total_cycles as number,
      successful_cycles: row.successful_cycles as number,
      failed_cycles: row.failed_cycles as number,
      execution_time_ms: row.execution_time_ms as number,
      bot_specific_results: row.bot_specific_results as string | undefined,
      errors: row.errors as string | undefined,
      created_at: row.created_at as string,
      started_at: row.started_at as string | undefined,
      completed_at: row.completed_at as string | undefined,
      updated_at: row.updated_at as string,
    }));
  } catch (error) {
    logging.error(requestId, "Failed to list recent bot executions", error);
    throw error;
  }
}

export async function countByStatus(
  status: BotExecutionStatus,
  requestId: string = "system",
): Promise<number> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT COUNT(*) as count FROM bot_executions WHERE status = ?",
      args: [status],
    });

    const row = result.rows[0];
    return row.count as number;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to count bot executions with status ${status}`,
      error,
    );
    throw error;
  }
}

export async function countActiveExecutions(
  requestId: string = "system",
): Promise<number> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: `
        SELECT COUNT(*) as count FROM bot_executions 
        WHERE status IN (?, ?)
      `,
      args: [BotExecutionStatus.PENDING, BotExecutionStatus.RUNNING],
    });

    const row = result.rows[0];
    return row.count as number;
  } catch (error) {
    logging.error(
      requestId,
      "Failed to count active bot executions",
      error,
    );
    throw error;
  }
}
