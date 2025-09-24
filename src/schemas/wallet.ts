import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ===== Wallet Management Schemas =====

/**
 * Schema for creating wallets
 */
export const createWalletsSchema = z.object({
  count: z.number().int().positive().default(1),
  label: z.string().optional(),
});

export type CreateWalletsPayload = z.infer<typeof createWalletsSchema>;

/**
 * Schema for importing existing wallets
 */
export const importWalletSchema = z.object({
  secretKey: z.string()
    .min(87, "Invalid secret key format")
    .max(88, "Invalid secret key format")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid secret key format"),
  label: z.string().optional(),
});

export type ImportWalletPayload = z.infer<typeof importWalletSchema>;

/**
 * Schema for wallet public key parameter
 */
export const walletParamSchema = z.object({
  publicKey: z.string()
    .length(44, "Invalid public key format - must be exactly 44 characters")
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{44}$/,
      "Invalid public key format - must be base58 encoded",
    ),
});

export type WalletParamPayload = z.infer<typeof walletParamSchema>;

/**
 * Schema for bulk editing multiple wallets
 */
export const bulkEditWalletsSchema = z.object({
  walletIds: z.array(z.number().int().positive())
    .min(1, "At least one wallet ID is required")
    .max(50, "Maximum of 50 wallet IDs allowed at once"),
  updates: z.object({
    label: z.string().optional(),
    isActive: z.boolean().optional(),
  }).refine((data) => data.label !== undefined || data.isActive !== undefined, {
    message: "At least one update field (label or isActive) must be provided",
  }),
});

export type BulkEditWalletsPayload = z.infer<typeof bulkEditWalletsSchema>;

/**
 * Schema for refreshing wallet balances
 */
export const refreshWalletBalancesSchema = z.object({
  walletIds: z.array(z.number().int().positive())
    .min(1, "At least one wallet ID is required")
    .max(100, "Maximum of 100 wallet IDs allowed at once"),
});

export type RefreshWalletBalancesPayload = z.infer<
  typeof refreshWalletBalancesSchema
>;
