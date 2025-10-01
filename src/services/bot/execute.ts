import * as logging from "../../utils/logging.ts";
import { BotType } from "./_types.ts";
import { BOT_ERRORS } from "./_errors.ts";
import { executeBotFromRegistry } from "./bot-executor.ts";
import { validateWalletAndGetKeypair } from "../wallet/_utils.ts";
import { Keypair, PublicKey } from "@solana/web3.js";
import * as botExecutionRepo from "../../db/repositories/bot-executions.ts";
import { BotExecutionStatus } from "../../db/repositories/bot-executions.ts";
import { getConfig } from "../../utils/env.ts";

interface BotExecutionParameters {
  walletId: number;
  mintPublicKey: string;
  volumeAmountSol: number;
  blocksToWaitBeforeSell: number;
  executionConfig: {
    repeatCount: number;
    intervalSeconds: number;
  };
}

export async function startBotExecution(
  botType: BotType,
  parameters: BotExecutionParameters,
  ownerUserId: string,
  requestId: string,
): Promise<[number, null] | [null, string]> {
  logging.info(requestId, "Bot execution requested", {
    botType,
    walletId: parameters.walletId,
  });

  const activeCount = await botExecutionRepo.countActiveExecutions(requestId);

  if (activeCount >= getConfig().MAX_CONCURRENT_BOTS) {
    logging.warn(requestId, "Maximum concurrent bots reached", {
      activeCount,
      maxConcurrent: getConfig().MAX_CONCURRENT_BOTS,
    });
    return [null, "Maximum concurrent bots reached. Please try again later."];
  }

  const [validation, validationError] = await validateWalletAndGetKeypair(
    parameters.walletId,
    ownerUserId,
    requestId,
  );
  if (validationError) {
    logging.error(requestId, "Wallet validation failed", {
      walletId: parameters.walletId,
      error: validationError,
    });
    return [null, validationError];
  }

  try {
    const execution = await botExecutionRepo.create({
      bot_type: botType,
      bot_params: JSON.stringify(parameters),
      wallet_id: parameters.walletId,
    }, requestId);

    logging.info(requestId, "Created bot execution record", {
      executionId: execution.id,
      botType,
    });

    executeAsync(
      execution.id,
      botType,
      parameters,
      validation!.keypair,
      requestId,
    );

    return [execution.id, null];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logging.error(requestId, "Failed to start bot execution", error);
    return [null, errorMessage];
  }
}

async function executeAsync(
  executionId: number,
  botType: BotType,
  parameters: BotExecutionParameters,
  wallet: Keypair,
  requestId: string,
): Promise<void> {
  const startTime = Date.now();

  try {
    await botExecutionRepo.update(executionId, {
      status: BotExecutionStatus.RUNNING,
      started_at: new Date(),
    }, requestId);

    logging.info(requestId, "Starting async bot execution", {
      executionId,
      botType,
    });

    const mintPublicKeyObj = new PublicKey(parameters.mintPublicKey);
    const mintKeypair = { publicKey: mintPublicKeyObj } as Keypair;

    const botParams = {
      wallet,
      mint: mintKeypair,
      volumeAmountSol: parameters.volumeAmountSol,
      blocksToWaitBeforeSell: parameters.blocksToWaitBeforeSell,
    };

    const [result, error] = await executeBotFromRegistry({
      botType,
      botParams,
      executionConfig: parameters.executionConfig,
    });

    const executionTime = Date.now() - startTime;

    if (error) {
      let errorMessage: string;
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = (error as any).message || JSON.stringify(error);
      } else {
        errorMessage = JSON.stringify(error);
      }

      logging.error(requestId, "Bot execution failed", {
        executionId,
        error: errorMessage,
      });

      await botExecutionRepo.update(executionId, {
        status: BotExecutionStatus.FAILED,
        execution_time_ms: executionTime,
        errors: errorMessage,
        completed_at: new Date(),
      }, requestId);
    } else {
      logging.info(requestId, "Bot execution completed successfully", {
        executionId,
        success: result!.success,
        totalCycles: result!.totalCycles,
        successfulCycles: result!.successfulCycles,
        failedCycles: result!.failedCycles,
      });

      await botExecutionRepo.update(executionId, {
        status: BotExecutionStatus.COMPLETED,
        total_cycles: result!.totalCycles,
        successful_cycles: result!.successfulCycles,
        failed_cycles: result!.failedCycles,
        execution_time_ms: executionTime,
        bot_specific_results: JSON.stringify(result!.botSpecificResults),
        errors: result!.errors.length > 0
          ? JSON.stringify(result!.errors)
          : undefined,
        completed_at: new Date(),
      }, requestId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const executionTime = Date.now() - startTime;

    logging.error(requestId, "Bot execution error", errorMessage);

    await botExecutionRepo.update(executionId, {
      status: BotExecutionStatus.FAILED,
      execution_time_ms: executionTime,
      errors: errorMessage,
      completed_at: new Date(),
    }, requestId);
  }
}

export async function getBotExecution(
  executionId: number,
  requestId: string,
): Promise<[botExecutionRepo.DbBotExecution, null] | [null, string]> {
  try {
    const execution = await botExecutionRepo.findById(executionId, requestId);
    if (!execution) {
      return [null, "Bot execution not found"];
    }
    return [execution, null];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logging.error(requestId, "Failed to get bot execution", error);
    return [null, errorMessage];
  }
}

export async function listBotExecutions(
  walletId?: number,
  botId?: number,
  requestId: string = "system",
): Promise<[botExecutionRepo.DbBotExecution[], null] | [null, string]> {
  try {
    let executions: botExecutionRepo.DbBotExecution[];

    if (botId) {
      const [execution, error] = await getBotExecution(botId, requestId);
      if (error) {
        return [null, error];
      }
      executions = execution ? [execution] : [];
    } else if (walletId) {
      executions = await botExecutionRepo.listByWalletId(walletId, requestId);
    } else {
      executions = await botExecutionRepo.listRecent(50, requestId);
    }

    return [executions, null];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logging.error(requestId, "Failed to list bot executions", error);
    return [null, errorMessage];
  }
}

export function getMaxConcurrentBots(): number {
  return getConfig().MAX_CONCURRENT_BOTS;
}
