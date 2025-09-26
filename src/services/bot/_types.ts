export enum BotType {
  VOLUME_BOT_1 = "volume-bot-1",
}

export interface BotExecutorConfig<TBotParams> {
  botType: BotType;
  botParams: TBotParams;
  executionConfig: {
    repeatCount: number;
    intervalSeconds: number;
  };
}

export interface BotExecutorResult<TBotResults = Record<string, never>> {
  success: boolean;
  totalCycles: number;
  successfulCycles: number;
  failedCycles: number;
  errors: string[];
  executionTimeMs: number;
  botSpecificResults: TBotResults;
}

export interface BotCycleResult<TMetrics = Record<string, never>> {
  success: boolean;
  error?: string;
  transactionSignatures?: string[];
  metrics: TMetrics;
}

export type BotValidator<TParams> = (
  params: TParams,
) => Promise<[true, null] | [false, string]>;
export type BotCyclePreparator<TParams, TCycleParams> = (
  params: TParams,
  cycleIndex: number,
) => TCycleParams;
export type BotCycleExecutor<
  TCycleParams,
  TCycleResult extends BotCycleResult<Record<string, unknown>>,
> = (params: TCycleParams) => Promise<[TCycleResult, null] | [null, string]>;
export type BotResultAggregator<
  TCycleResult extends BotCycleResult<Record<string, unknown>>,
  TResults,
> = (results: TCycleResult[]) => TResults;

export interface Bot<
  TBotParams,
  TBotCycleParams,
  TBotCycleResult extends BotCycleResult<Record<string, unknown>>,
  TBotResults,
> {
  readonly botType: BotType;
  validateParams: BotValidator<TBotParams>;
  prepareCycleParams: BotCyclePreparator<TBotParams, TBotCycleParams>;
  executeCycle: BotCycleExecutor<TBotCycleParams, TBotCycleResult>;
  aggregateResults: BotResultAggregator<TBotCycleResult, TBotResults>;
}
