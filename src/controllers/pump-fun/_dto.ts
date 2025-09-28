import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const createAndBuySchema = z.object({
  walletId: z.number().int().positive("Wallet ID must be a positive integer"),
  tokenMeta: z.object({
    name: z.string().min(1, "Token name is required").max(
      32,
      "Token name must be 32 characters or less",
    ),
    symbol: z.string().min(1, "Token symbol is required").max(
      10,
      "Token symbol must be 10 characters or less",
    ),
    uri: z.string().url("Token URI must be a valid URL").max(
      200,
      "Token URI must be 200 characters or less",
    ),
    description: z.string().optional(),
  }),
  buyAmountSol: z.number().positive("Buy amount must be positive").max(
    1000,
    "Buy amount cannot exceed 1000 SOL",
  ),
});

export type CreateAndBuyPayload = z.infer<typeof createAndBuySchema>;

export const buyTokenSchema = z.object({
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
  buyAmountSol: z.number().positive("Buy amount must be positive").max(
    1000,
    "Buy amount cannot exceed 1000 SOL",
  ),
});

export type BuyTokenPayload = z.infer<typeof buyTokenSchema>;

export const sellTokenSchema = z.object({
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
  sellAmountSol: z.number().positive("Sell amount must be positive").max(
    1000,
    "Sell amount cannot exceed 1000 SOL",
  ).optional(),
  sellAmountSPL: z.number().positive("Sell amount must be positive").max(
    1000000000,
    "Sell amount cannot exceed 1 billion tokens",
  ).optional(),
}).refine(
  (data) =>
    (data.sellAmountSol !== undefined) !== (data.sellAmountSPL !== undefined),
  {
    message:
      "Either sellAmountSol or sellAmountSPL must be provided, but not both",
    path: ["sellAmountSol", "sellAmountSPL"],
  },
);

export type SellTokenPayload = z.infer<typeof sellTokenSchema>;

export const getTokenBalanceSchema = z.object({
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
});

export type GetTokenBalancePayload = z.infer<typeof getTokenBalanceSchema>;
