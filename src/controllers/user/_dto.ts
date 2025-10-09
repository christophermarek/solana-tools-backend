import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const paymentHistoryItemSchema = z.object({
  id: z.number(),
  telegramId: z.string(),
  amountInSol: z.number(),
  signature: z.string(),
  depositedAt: z.string(),
  processedAt: z.string().nullable(),
});

export const paymentHistoryResponseSchema = z.object({
  paymentHistory: z.array(paymentHistoryItemSchema),
});

export const redeemCreditsRequestSchema = z.object({
  daysToRedeem: z.number().int().positive(
    "Days to redeem must be a positive integer",
  ).max(
    365,
    "Cannot redeem more than 365 days at once",
  ),
});

export const redeemCreditsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  creditsExpireAt: z.string().nullable(),
  totalDaysRedeemed: z.number(),
  totalSolSpent: z.number(),
  paymentsProcessed: z.number(),
});

export const accountDataResponseSchema = z.object({
  account: z.object({
    id: z.string(),
    telegramId: z.string(),
    creditsExpireAt: z.string().nullable(),
    createdAt: z.string(),
  }),
});

export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;
export type PaymentHistoryResponse = z.infer<
  typeof paymentHistoryResponseSchema
>;
export type RedeemCreditsRequest = z.infer<typeof redeemCreditsRequestSchema>;
export type RedeemCreditsResponse = z.infer<typeof redeemCreditsResponseSchema>;
export type AccountDataResponse = z.infer<typeof accountDataResponseSchema>;
