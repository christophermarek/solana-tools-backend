import { BotResultAggregator } from "../_types.ts";
import {
  VolumeBot1AggregatedResults,
  VolumeBot1CycleResult,
} from "./_types.ts";

export const aggregateResults: BotResultAggregator<
  VolumeBot1CycleResult,
  VolumeBot1AggregatedResults
> = (results) => {
  const aggregated: VolumeBot1AggregatedResults = {
    totalBuyOperations: 0,
    totalSellOperations: 0,
    totalVolumeSol: 0,
  };

  for (const result of results) {
    if (result.buySuccess) {
      aggregated.totalBuyOperations++;
      aggregated.totalVolumeSol += result.volumeSol;
    }
    if (result.sellSuccess) {
      aggregated.totalSellOperations++;
    }
  }

  return aggregated;
};
