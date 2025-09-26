import * as logging from "../../utils/logging.ts";
import { TAG } from "./_constants.ts";
import {
  Bot,
  BotCycleResult,
  BotExecutorConfig,
  BotExecutorResult,
  BotType,
} from "./_types.ts";
import { BotErrors } from "./_errors.ts";
import { createBotError, waitForInterval } from "./_utils.ts";

const botRegistry = new Map<
  BotType,
  Bot<unknown, unknown, BotCycleResult<Record<string, unknown>>, unknown>
>();

export function registerBot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
>(
  bot: Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults>,
): void {
  botRegistry.set(
    bot.botType,
    bot as unknown as Bot<
      unknown,
      unknown,
      BotCycleResult<Record<string, unknown>>,
      unknown
    >,
  );
  logging.info(TAG, "Bot registered", { botType: bot.botType });
}

export function getBot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
>(
  botType: BotType,
): Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults> | undefined {
  return botRegistry.get(botType) as
    | Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults>
    | undefined;
}

export async function executeBot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
>(
  config: BotExecutorConfig<TBotParams>,
  bot: Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults>,
): Promise<[BotExecutorResult<TBotResults>, null] | [null, BotErrors]> {
  const { botType, botParams, executionConfig } = config;
  const { repeatCount, intervalSeconds } = executionConfig;

  const startTime = Date.now();

  logging.info(TAG, "Bot executor started", {
    botType,
    repeatCount,
    intervalSeconds,
  });

  const [isValid, validationError] = await bot.validateParams(botParams);
  if (!isValid) {
    const errorMsg = `Invalid bot parameters: ${validationError}`;
    logging.error(TAG, errorMsg, new Error(errorMsg));
    return [null, {
      type: "BOT_ERROR",
      message: errorMsg,
    }];
  }

  const result: BotExecutorResult<TBotResults> = {
    success: true,
    totalCycles: repeatCount,
    successfulCycles: 0,
    failedCycles: 0,
    errors: [],
    executionTimeMs: 0,
    botSpecificResults: {} as TBotResults,
  };

  const cycleResults: TBotCycleResult[] = [];

  try {
    for (let i = 0; i < repeatCount; i++) {
      logging.info(TAG, "Starting cycle", {
        cycle: i + 1,
        totalCycles: repeatCount,
        botType,
      });

      const cycleParams = bot.prepareCycleParams(botParams, i);
      const [cycleResult, cycleError] = await bot.executeCycle(cycleParams);

      if (cycleError) {
        const errorMsg = `Cycle ${i + 1} failed: ${cycleError}`;
        logging.error(TAG, errorMsg, new Error(errorMsg));
        result.errors.push(errorMsg);
        result.failedCycles++;
        result.success = false;
        continue;
      }

      if (cycleResult) {
        cycleResults.push(cycleResult);

        if (cycleResult.success) {
          result.successfulCycles++;
          logging.info(TAG, "Cycle completed successfully", {
            cycle: i + 1,
            transactionSignatures: cycleResult.transactionSignatures,
            metrics: cycleResult.metrics,
          });
        } else {
          result.failedCycles++;
          result.success = false;
          const errorMsg = `Cycle ${i + 1} failed: ${
            cycleResult.error || "Unknown error"
          }`;
          logging.error(TAG, errorMsg, new Error(errorMsg));
          result.errors.push(errorMsg);
        }
      }

      if (i < repeatCount - 1 && intervalSeconds > 0) {
        logging.info(TAG, "Waiting for interval before next cycle", {
          intervalSeconds,
          nextCycle: i + 2,
        });

        await waitForInterval(intervalSeconds);
      }

      logging.info(TAG, "Cycle summary", {
        cycle: i + 1,
        totalCycles: repeatCount,
        successfulCycles: result.successfulCycles,
        failedCycles: result.failedCycles,
        botType,
      });
    }

    result.botSpecificResults = bot.aggregateResults(cycleResults);
    result.executionTimeMs = Date.now() - startTime;

    logging.info(TAG, "Bot executor completed", {
      success: result.success,
      totalCycles: result.totalCycles,
      successfulCycles: result.successfulCycles,
      failedCycles: result.failedCycles,
      errorCount: result.errors.length,
      executionTimeMs: result.executionTimeMs,
      botType,
      botSpecificResults: result.botSpecificResults,
    });

    return [result, null];
  } catch (error) {
    logging.error(TAG, "Bot executor failed", error);
    const errorMessage = createBotError("Bot executor failed", error as Error);

    result.success = false;
    result.errors.push(errorMessage);
    result.executionTimeMs = Date.now() - startTime;

    return [null, {
      type: "BOT_ERROR",
      message: errorMessage,
    }];
  }
}

export function executeBotFromRegistry<
  TBotParams,
  TBotResults = Record<string, never>,
>(
  config: BotExecutorConfig<TBotParams>,
): Promise<[BotExecutorResult<TBotResults>, null] | [null, BotErrors]> {
  const { botType } = config;

  const bot = getBot(botType);
  if (!bot) {
    const errorMsg = `Unknown bot type: ${botType}`;
    logging.error(TAG, errorMsg, new Error(errorMsg));
    return Promise.resolve([null, {
      type: "BOT_ERROR",
      message: errorMsg,
    }]);
  }

  return executeBot(
    config,
    bot as Bot<
      TBotParams,
      unknown,
      BotCycleResult<Record<string, unknown>>,
      TBotResults
    >,
  );
}
