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
import { volumeBot1 } from "./_index.ts";
import {
  VolumeBot1AggregatedResults,
  VolumeBot1CycleParams,
  VolumeBot1CycleResult,
  VolumeBot1Params,
} from "./bot1/_types.ts";

type BotRegistryEntry = {
  type: "volume-bot-1";
  bot: Bot<
    VolumeBot1Params,
    VolumeBot1CycleParams,
    VolumeBot1CycleResult,
    VolumeBot1AggregatedResults
  >;
};

type GenericBot = Bot<
  Record<string, unknown>,
  Record<string, unknown>,
  BotCycleResult<Record<string, unknown>>,
  Record<string, unknown>
>;

const botRegistry = new Map<BotType, BotRegistryEntry>();

function initializeBotRegistry(): void {
  logging.info(TAG, "Initializing bot registry...");

  registerBot(volumeBot1);

  logging.info(TAG, "Bot registry initialization completed", {
    registeredBots: Array.from(botRegistry.keys()),
  });
}

initializeBotRegistry();

export function registerBot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
>(
  bot: Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults>,
): void {
  switch (bot.botType) {
    case "volume-bot-1":
      botRegistry.set(bot.botType, {
        type: "volume-bot-1",
        bot: bot as unknown as Bot<
          VolumeBot1Params,
          VolumeBot1CycleParams,
          VolumeBot1CycleResult,
          VolumeBot1AggregatedResults
        >,
      });
      break;
    default:
      throw new Error(`Unknown bot type: ${bot.botType}`);
  }

  logging.info(TAG, "Bot registered", { botType: bot.botType });
}

export function getBot(botType: BotType): GenericBot | undefined {
  const entry = botRegistry.get(botType);
  return entry?.bot as unknown as GenericBot;
}

export function getRegisteredBots(): BotType[] {
  return Array.from(botRegistry.keys());
}

export async function executeBot(
  config: BotExecutorConfig<Record<string, unknown>>,
  bot: GenericBot,
): Promise<
  [BotExecutorResult<Record<string, unknown>>, null] | [null, BotErrors]
> {
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

  const result: BotExecutorResult<Record<string, unknown>> = {
    success: true,
    totalCycles: repeatCount,
    successfulCycles: 0,
    failedCycles: 0,
    errors: [],
    executionTimeMs: 0,
    botSpecificResults: {} as Record<string, unknown>,
  };

  const cycleResults: BotCycleResult<Record<string, unknown>>[] = [];

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
    const errorMessage = createBotError("Bot executor failed", error as Error);
    logging.error(TAG, "Bot executor failed", {
      error: errorMessage,
      originalError: error instanceof Error ? error.message : String(error),
    });

    result.success = false;
    result.errors.push(errorMessage);
    result.executionTimeMs = Date.now() - startTime;

    return [null, {
      type: "BOT_ERROR",
      message: errorMessage,
    }];
  }
}

export function executeBotFromRegistry(
  config: BotExecutorConfig<Record<string, unknown>>,
): Promise<
  [BotExecutorResult<Record<string, unknown>>, null] | [null, BotErrors]
> {
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

  return executeBot(config, bot);
}
