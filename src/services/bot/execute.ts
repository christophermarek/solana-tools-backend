import * as logging from "../../utils/logging.ts";
import type { BotExecutionTransaction, BotType } from "./_types.ts";
import { executeBotFromRegistry } from "./bot-executor.ts";
import { validateWalletAndGetKeypair } from "../wallet/_utils.ts";
import { type Keypair, PublicKey } from "@solana/web3.js";
import * as botExecutionRepo from "../../db/repositories/bot-executions.ts";
import { BotExecutionStatus } from "../../db/repositories/bot-executions.ts";
import * as botExecutionTransactionRepo from "../../db/repositories/bot-execution-transactions.ts";
import * as transactionRepo from "../../db/repositories/transactions.ts";
import { getConfig } from "../../utils/env.ts";
import { BOT_ERRORS, type BotErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";

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
      owner_user_id: ownerUserId,
    }, requestId);

    logging.info(requestId, "Created bot execution record", {
      executionId: execution.id,
      botType,
    });

    if (!validation) {
      return [null, "Wallet validation failed"];
    }

    executeAsync(
      execution.id,
      botType,
      parameters,
      validation.keypair,
      ownerUserId,
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
  ownerUserId: string,
  requestId: string,
): Promise<void> {
  const startTime = Date.now();

  try {
    await botExecutionRepo.update(
      executionId,
      {
        status: BotExecutionStatus.RUNNING,
        started_at: new Date(),
      },
      ownerUserId,
      requestId,
    );

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
      botExecutionId: executionId,
      ownerUserId,
      requestId,
    });

    const executionTime = Date.now() - startTime;

    if (error) {
      let errorMessage: string;
      if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object" && "message" in error) {
        errorMessage = (error as { message: string }).message ||
          JSON.stringify(error);
      } else {
        errorMessage = JSON.stringify(error);
      }

      logging.error(requestId, "Bot execution failed", {
        executionId,
        error: errorMessage,
      });

      await botExecutionRepo.update(
        executionId,
        {
          status: BotExecutionStatus.FAILED,
          execution_time_ms: executionTime,
          errors: errorMessage,
          completed_at: new Date(),
        },
        ownerUserId,
        requestId,
      );
    } else if (result) {
      logging.info(requestId, "Bot execution completed successfully", {
        executionId,
        success: result.success,
        totalCycles: result.totalCycles,
        successfulCycles: result.successfulCycles,
        failedCycles: result.failedCycles,
      });

      await botExecutionRepo.update(
        executionId,
        {
          status: BotExecutionStatus.COMPLETED,
          total_cycles: result.totalCycles,
          successful_cycles: result.successfulCycles,
          failed_cycles: result.failedCycles,
          execution_time_ms: executionTime,
          bot_specific_results: JSON.stringify(result.botSpecificResults),
          errors: result.errors.length > 0
            ? JSON.stringify(result.errors)
            : undefined,
          completed_at: new Date(),
        },
        ownerUserId,
        requestId,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const executionTime = Date.now() - startTime;

    logging.error(requestId, "Bot execution error", errorMessage);

    await botExecutionRepo.update(
      executionId,
      {
        status: BotExecutionStatus.FAILED,
        execution_time_ms: executionTime,
        errors: errorMessage,
        completed_at: new Date(),
      },
      ownerUserId,
      requestId,
    );
  }
}

export async function getBotExecution(
  executionId: number,
  ownerUserId: string,
  requestId: string,
): Promise<[botExecutionRepo.DbBotExecution, null] | [null, string]> {
  try {
    const execution = await botExecutionRepo.findById(
      executionId,
      ownerUserId,
      requestId,
    );
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
  ownerUserId: string,
  walletId?: number,
  botId?: number,
  requestId: string = "system",
): Promise<[botExecutionRepo.DbBotExecution[], null] | [null, string]> {
  try {
    let executions: botExecutionRepo.DbBotExecution[];

    if (botId) {
      const [execution, error] = await getBotExecution(
        botId,
        ownerUserId,
        requestId,
      );
      if (error) {
        return [null, error];
      }
      executions = execution ? [execution] : [];
    } else if (walletId) {
      executions = await botExecutionRepo.listByWalletId(
        walletId,
        ownerUserId,
        requestId,
      );
    } else {
      executions = await botExecutionRepo.listRecent(
        ownerUserId,
        50,
        requestId,
      );
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

export function calculateTotalFees(
  transactions: BotExecutionTransaction[],
): number {
  if (transactions.length === 0) {
    return 0;
  }

  const totalFees = transactions.reduce((sum, transaction) => {
    if (transaction.transactionFeeSol) {
      return sum + transaction.transactionFeeSol;
    }
    return sum;
  }, 0);

  logging.info(TAG, "Total fees calculated", {
    transactionCount: transactions.length,
    totalFeesSol: totalFees,
  });

  return totalFees;
}

export async function getBotExecutionTransactions(
  executionId: number,
  ownerUserId: string,
  requestId: string,
): Promise<[BotExecutionTransaction[], null] | [null, BotErrors]> {
  try {
    logging.info(TAG, "Getting bot execution transactions", {
      executionId,
      ownerUserId,
    });

    const execution = await botExecutionRepo.findById(
      executionId,
      ownerUserId,
      requestId,
    );
    if (!execution) {
      logging.error(TAG, "Bot execution not found", {
        executionId,
        ownerUserId,
      });
      return [null, BOT_ERRORS.ERROR_BOT_EXECUTION_NOT_FOUND];
    }

    const botExecutionTransactions = await botExecutionTransactionRepo
      .findByBotExecutionId(
        executionId,
        requestId,
      );

    const transactionIds = botExecutionTransactions.map((t) =>
      t.transaction_id
    );

    if (transactionIds.length === 0) {
      logging.info(TAG, "No transactions found for bot execution", {
        executionId,
      });
      return [[], null];
    }

    const transactions = await Promise.all(
      transactionIds.map(async (transactionId) => {
        const transaction = await transactionRepo.findById(transactionId);
        if (transaction) {
          const botExecutionTransaction = botExecutionTransactions.find(
            (t) => t.transaction_id === transactionId,
          );
          return {
            id: transaction.id,
            signature: transaction.signature,
            senderPublicKey: transaction.sender_public_key,
            status: transaction.status,
            slot: transaction.slot,
            priorityFeeUnitLimit: transaction.priority_fee_unit_limit,
            priorityFeeUnitPriceLamports:
              transaction.priority_fee_unit_price_lamports,
            slippageBps: transaction.slippage_bps,
            confirmedAt: transaction.confirmed_at,
            confirmationSlot: transaction.confirmation_slot,
            commitmentLevel: transaction.commitment_level,
            errorMessage: transaction.error_message,
            transactionFeeSol: transaction.transaction_fee_sol,
            createdAt: transaction.created_at,
            updatedAt: transaction.updated_at,
            pumpFunTransactionType:
              botExecutionTransaction?.pump_fun_transaction_type || null,
          } as BotExecutionTransaction;
        }
        return null;
      }),
    );

    const validTransactions = transactions.filter((t) =>
      t !== null
    ) as BotExecutionTransaction[];

    logging.info(TAG, "Retrieved bot execution transactions", {
      executionId,
      transactionCount: validTransactions.length,
    });

    return [validTransactions, null];
  } catch (error) {
    logging.error(TAG, "Failed to get bot execution transactions", error);
    return [null, {
      type: "BOT_ERROR",
      message: BOT_ERRORS.ERROR_FAILED_TO_GET_TRANSACTIONS,
    }];
  }
}
