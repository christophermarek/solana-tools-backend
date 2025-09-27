import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";
import type { BindValue } from "../types.ts";

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
    const stmt = client.prepare(`
      INSERT INTO bot_executions (
        bot_type,
        bot_params,
        wallet_id,
        status
      ) VALUES (?, ?, ?, ?)
    `);

    await stmt.run(
      params.bot_type,
      params.bot_params,
      params.wallet_id,
      BotExecutionStatus.PENDING,
    );

    const newExecution = await client.prepare(`
      SELECT * FROM bot_executions 
      WHERE wallet_id = ? AND bot_type = ? AND status = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(
      params.wallet_id,
      params.bot_type,
      BotExecutionStatus.PENDING,
    ) as DbBotExecution;

    logging.info(requestId, "Created bot execution", {
      id: newExecution.id,
      botType: newExecution.bot_type,
      walletId: newExecution.wallet_id,
    });

    return newExecution;
  } catch (error) {
    logging.error(requestId, "Failed to create bot execution", error);
    throw error;
  }
}

export async function findById(
  id: number,
  requestId: string = "system",
): Promise<DbBotExecution | null> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_executions WHERE id = ?
    `).get(id) as DbBotExecution | undefined;
    return result || null;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to find bot execution with id ${id}`,
      error,
    );
    throw error;
  }
}

export async function update(
  id: number,
  params: UpdateBotExecutionParams,
  requestId: string = "system",
): Promise<DbBotExecution> {
  const client = getClient();
  try {
    const updates: string[] = [];
    const values: BindValue[] = [];

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
    values.push(id);

    const sqlQuery = `
      UPDATE bot_executions 
      SET ${updates.join(", ")}
      WHERE id = ?
    `;

    await client.prepare(sqlQuery).run(...values);

    const result = await client.prepare(`
      SELECT * FROM bot_executions WHERE id = ?
    `).get(id) as DbBotExecution | undefined;

    if (!result) {
      throw new Error(`Bot execution with id ${id} not found after update`);
    }

    logging.info(requestId, "Updated bot execution", {
      id,
      status: result.status,
    });

    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to update bot execution with id ${id}`,
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
    const result = await client.prepare(`
      SELECT * FROM bot_executions 
      WHERE status = ? 
      ORDER BY created_at DESC
    `).all(status) as DbBotExecution[];
    return result;
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
  requestId: string = "system",
): Promise<DbBotExecution[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_executions 
      WHERE wallet_id = ? 
      ORDER BY created_at DESC
    `).all(walletId) as DbBotExecution[];
    return result;
  } catch (error) {
    logging.error(
      requestId,
      `Failed to list bot executions for wallet ${walletId}`,
      error,
    );
    throw error;
  }
}

export async function listRecent(
  limit: number = 50,
  requestId: string = "system",
): Promise<DbBotExecution[]> {
  const client = getClient();
  try {
    const result = await client.prepare(`
      SELECT * FROM bot_executions 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit) as DbBotExecution[];
    return result;
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
    const result = await client.prepare(`
      SELECT COUNT(*) as count FROM bot_executions WHERE status = ?
    `).get(status) as { count: number };
    return result.count;
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
    const result = await client.prepare(`
      SELECT COUNT(*) as count FROM bot_executions 
      WHERE status IN (?, ?)
    `).get(BotExecutionStatus.PENDING, BotExecutionStatus.RUNNING) as {
      count: number;
    };
    return result.count;
  } catch (error) {
    logging.error(
      requestId,
      "Failed to count active bot executions",
      error,
    );
    throw error;
  }
}
