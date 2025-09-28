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

export interface AvailableBot {
  type: string;
  name: string;
  description: string;
  parameters: {
    botParameters: Record<string, string>;
    executionParameters: Record<string, string>;
  };
}
