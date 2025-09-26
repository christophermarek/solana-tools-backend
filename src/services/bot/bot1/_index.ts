import { createBot } from "../_utils.ts";
import { BotType } from "../_types.ts";
import { validateParams } from "./validate.ts";
import { executeCycle, prepareCycleParams } from "./cycle.ts";
import { aggregateResults } from "./aggregate-results.ts";

export const volumeBot1 = createBot(
  BotType.VOLUME_BOT_1,
  validateParams,
  prepareCycleParams,
  executeCycle,
  aggregateResults,
);
