import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const executeBotSchema = z.object({
  botType: z.enum(["volume-bot-1"], {
    errorMap: () => ({ message: "Bot type must be 'volume-bot-1'" }),
  }),
  parameters: z.object({
    walletId: z.number().int().positive("Wallet ID must be a positive integer"),
    mintPublicKey: z.string()
      .length(
        44,
        "Invalid mint public key format - must be exactly 44 characters",
      )
      .regex(
        /^[1-9A-HJ-NP-Za-km-z]{44}$/,
        "Invalid mint public key format - must be base58 encoded",
      ),
    volumeAmountSol: z.number().positive("Volume amount must be positive").max(
      1000,
      "Volume amount cannot exceed 1000 SOL",
    ),
    blocksToWaitBeforeSell: z.number().int().min(
      0,
      "Blocks to wait must be non-negative",
    ).max(
      1000,
      "Blocks to wait cannot exceed 1000",
    ),
    executionConfig: z.object({
      repeatCount: z.number().int().positive("Repeat count must be positive")
        .max(
          100,
          "Cannot repeat more than 100 times",
        ),
      intervalSeconds: z.number().int().min(0, "Interval must be non-negative")
        .max(
          3600,
          "Interval cannot exceed 1 hour",
        ),
    }),
  }),
});

export type ExecuteBotPayload = z.infer<typeof executeBotSchema>;

export const executeBotResponseSchema = z.object({
  executionId: z.number(),
  status: z.string(),
  message: z.string(),
});

export const transactionSchema = z.object({
  id: z.number(),
  signature: z.string().nullable(),
  senderPublicKey: z.string(),
  status: z.string(),
  slot: z.number().nullable(),
  priorityFeeUnitLimit: z.number().nullable(),
  priorityFeeUnitPriceLamports: z.number().nullable(),
  slippageBps: z.number().nullable(),
  confirmedAt: z.string().nullable(),
  confirmationSlot: z.number().nullable(),
  commitmentLevel: z.string().nullable(),
  errorMessage: z.string().nullable(),
  transactionFeeSol: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pumpFunTransactionType: z.string().nullable(),
});

export const botExecutionSchema = z.object({
  id: z.number(),
  botType: z.string(),
  botParams: z.record(z.any()),
  walletId: z.number(),
  status: z.string(),
  totalCycles: z.number().nullable(),
  successfulCycles: z.number().nullable(),
  failedCycles: z.number().nullable(),
  executionTimeMs: z.number().nullable(),
  botSpecificResults: z.record(z.any()).nullable(),
  errors: z.array(z.any()).nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  transactions: z.array(transactionSchema).optional(),
  totalFeesSol: z.number().optional(),
});

export const botExecutionStatusResponseSchema = botExecutionSchema;

export const listBotExecutionsResponseSchema = z.object({
  executions: z.array(botExecutionSchema.omit({
    botSpecificResults: true,
    errors: true,
    updatedAt: true,
  })),
});

export const listBotsResponseSchema = z.object({
  bots: z.array(z.object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
    parameters: z.object({
      botParameters: z.record(z.string()),
      executionParameters: z.record(z.string()),
    }),
  })),
});

export type ExecuteBotResponse = z.infer<typeof executeBotResponseSchema>;
export type BotExecution = z.infer<typeof botExecutionSchema>;
export type BotExecutionStatusResponse = z.infer<
  typeof botExecutionStatusResponseSchema
>;
export type ListBotExecutionsResponse = z.infer<
  typeof listBotExecutionsResponseSchema
>;
export type ListBotsResponse = z.infer<typeof listBotsResponseSchema>;

export interface AvailableBot {
  type: string;
  name: string;
  description: string;
  parameters: {
    botParameters: Record<string, string>;
    executionParameters: Record<string, string>;
  };
}
