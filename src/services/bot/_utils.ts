import * as logging from "../../utils/logging.ts";
import { TAG } from "./_constants.ts";
import {
  Bot,
  BotCycleExecutor,
  BotCyclePreparator,
  BotCycleResult,
  BotResultAggregator,
  BotType,
  BotValidator,
} from "./_types.ts";

export function waitForInterval(seconds: number): Promise<void> {
  if (seconds <= 0) {
    return Promise.resolve();
  }

  logging.info(TAG, "Waiting for interval", { seconds });

  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

export function createBotError(message: string, error?: Error): string {
  const errorMessage = error instanceof Error ? error.message : message;
  logging.error(TAG, message, error);
  return errorMessage;
}

export function createBot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
>(
  botType: BotType,
  validateParams: BotValidator<TBotParams>,
  prepareCycleParams: BotCyclePreparator<TBotParams, TBotCycleParams>,
  executeCycle: BotCycleExecutor<TBotCycleParams, TBotCycleResult>,
  aggregateResults: BotResultAggregator<TBotCycleResult, TBotResults>,
): Bot<TBotParams, TBotCycleParams, TBotCycleResult, TBotResults> {
  return {
    botType,
    validateParams,
    prepareCycleParams,
    executeCycle,
    aggregateResults,
  };
}
