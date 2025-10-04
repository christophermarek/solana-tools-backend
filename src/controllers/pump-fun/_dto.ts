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
    description: z.string().min(1, "Token description must not be empty").max(
      1000,
      "Token description must be 1000 characters or less",
    ).optional(),
    imageBase64: z.string().min(1, "Image file must not be empty").max(
      20971520,
      "Image file is too large (max 15MB)",
    ).optional(),
    twitter: z.string().url("Twitter URL must be a valid URL").max(
      200,
      "Twitter URL must be 200 characters or less",
    ).optional(),
    telegram: z.string().url("Telegram URL must be a valid URL").max(
      200,
      "Telegram URL must be 200 characters or less",
    ).optional(),
    website: z.string().url("Website URL must be a valid URL").max(
      200,
      "Website URL must be 200 characters or less",
    ).optional(),
  }),
  buyAmountSol: z.number().positive("Buy amount must be positive").max(
    1000,
    "Buy amount cannot exceed 1000 SOL",
  ),
  slippageBps: z.number().int().min(
    1,
    "Slippage must be at least 1 basis point",
  )
    .max(10000, "Slippage cannot exceed 10000 basis points (100%)")
    .optional(),
  priorityFee: z.object({
    unitLimit: z.number().int().positive("Unit limit must be positive")
      .max(1_400_000, "Unit limit cannot exceed 1,400,000"),
    unitPrice: z.number().int().positive("Unit price must be positive")
      .max(1_000_000, "Unit price cannot exceed 1,000,000 lamports"),
  }).optional(),
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

export interface PumpfunMintResponse {
  id: number;
  mint_public_key: string;
  telegram_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ListPumpfunMintsResponse {
  mints: PumpfunMintResponse[];
  meta: {
    total: number;
    count: number;
  };
}

export const trackMintSchema = z.object({
  mint_public_key: z.string()
    .length(
      44,
      "Invalid mint public key format - must be exactly 44 characters",
    )
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{44}$/,
      "Invalid mint public key format - must be base58 encoded",
    ),
});

export type TrackMintPayload = z.infer<typeof trackMintSchema>;

export interface TrackMintResponse {
  mint: PumpfunMintResponse;
  message: string;
}

export const untrackMintSchema = z.object({
  mint_public_key: z.string()
    .length(
      44,
      "Invalid mint public key format - must be exactly 44 characters",
    )
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{44}$/,
      "Invalid mint public key format - must be base58 encoded",
    ),
});

export type UntrackMintPayload = z.infer<typeof untrackMintSchema>;

export interface UntrackMintResponse {
  message: string;
}
