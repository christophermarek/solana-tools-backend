import { WalletErrors } from "./_errors.ts";

export interface Wallet {
  id: number;
  publicKey: string;
  label?: string;
  createdAt: Date;
  solBalance?: number;
  wsolBalance?: number;
  totalBalance?: number;
  lastBalanceUpdate?: Date;
  balanceStatus?: string;
}

export interface WalletWithBalance extends Wallet {
  solBalance: number;
  wsolBalance: number;
  totalBalance: number;
  lastBalanceUpdate: Date;
  balanceStatus: string;
}

export interface CreateWalletParams {
  count?: number;
  label?: string;
  ownerUserId: string;
}

export interface CreateWalletResult {
  wallets: WalletWithBalance[];
  errors: Array<{ index: number; error: WalletErrors }>;
}

export interface BulkEditParams {
  walletIds: number[];
  updates?: {
    label?: string;
  };
  delete?: boolean;
  ownerUserId: string;
}

export interface BulkEditResult {
  successful: Array<{
    id: number;
    publicKey: string;
    wallet?: Wallet; // Only present for edit operations
  }>;
  failed: Array<{ id: number; error: WalletErrors }>;
  operation: "edit" | "delete";
}

export interface ListWalletsParams {
  includeBalances?: boolean;
  ownerUserId: string;
}

export interface ListWalletsResult {
  wallets: Wallet[];
  meta: {
    totalWallets: number;
    walletsWithNullBalance: number;
    refreshed: boolean;
  };
}

export interface RefreshBalancesParams {
  walletIds: number[];
  ownerUserId: string;
}

export interface RefreshBalancesResult {
  successful: number;
  failed: number;
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
