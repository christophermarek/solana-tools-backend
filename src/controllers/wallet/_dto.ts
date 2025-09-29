import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import type {
  Wallet,
  WalletWithBalance,
} from "../../services/wallet/_types.ts";
import type { WalletErrors } from "../../services/wallet/_errors.ts";

export const createWalletsRequestDto = z.object({
  count: z.number().int().positive().default(1),
  label: z.string().optional(),
});

export type CreateWalletsPayload = z.infer<typeof createWalletsRequestDto>;

export const importWalletRequestDto = z.object({
  secretKey: z.string()
    .min(87, "Invalid secret key format")
    .max(88, "Invalid secret key format")
    .regex(/^[1-9A-HJ-NP-Za-km-z]{87,88}$/, "Invalid secret key format"),
  label: z.string().optional(),
});

export type ImportWalletPayload = z.infer<typeof importWalletRequestDto>;

export const walletParamRequestDto = z.object({
  publicKey: z.string()
    .length(44, "Invalid public key format - must be exactly 44 characters")
    .regex(
      /^[1-9A-HJ-NP-Za-km-z]{44}$/,
      "Invalid public key format - must be base58 encoded",
    ),
});

export type WalletParamPayload = z.infer<typeof walletParamRequestDto>;

export const bulkEditWalletsRequestDto = z.object({
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

export type BulkEditWalletsPayload = z.infer<typeof bulkEditWalletsRequestDto>;

export const refreshWalletBalancesRequestDto = z.object({
  walletIds: z.array(z.number().int().positive())
    .min(1, "At least one wallet ID is required")
    .max(100, "Maximum of 100 wallet IDs allowed at once"),
});

export type RefreshWalletBalancesPayload = z.infer<
  typeof refreshWalletBalancesRequestDto
>;

export interface CreateWalletsResponse {
  wallets: WalletWithBalance[];
  meta: {
    requested: number;
    created: number;
    errorCount: number;
    errors: Array<{ index: number; error: WalletErrors }>;
  };
}

export interface ImportWalletResponse {
  wallet: Wallet;
}

export interface GetWalletResponse {
  wallet: Wallet;
}

/**
 * Response for listing wallets endpoint
 */
export interface ListWalletsResponse {
  wallets: Wallet[];
  meta: {
    totalWallets: number;
    activeWallets: number;
    inactiveWallets: number;
    walletsWithNullBalance: number;
    refreshed: boolean;
    activeOnly: boolean;
  };
}

export interface BulkEditWalletsResponse {
  results: {
    total: number;
    successful: number;
    failed: number;
    successfulWallets: Array<{
      id: number;
      publicKey: string;
      wallet: Wallet;
    }>;
    failedWallets: Array<{ id: number; error: WalletErrors }>;
  };
}

export interface RefreshWalletBalancesResponse {
  meta: {
    refreshed: number;
    failed: number;
    total: number;
  };
  wallets: Array<{
    id: number;
    publicKey: string;
    label?: string;
    success: boolean;
    error?: string;
    balance?: {
      solBalance: number;
      wsolBalance: number;
      totalBalance: number;
      lastBalanceUpdate: Date;
      balanceStatus: string;
    };
  }>;
}
