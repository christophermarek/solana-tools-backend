import { WalletErrors } from "./_errors.ts";

export interface Wallet {
  id: number;
  publicKey: string;
  label?: string;
  isActive: boolean;
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
}

export interface CreateWalletResult {
  wallets: WalletWithBalance[];
  errors: Array<{ index: number; error: WalletErrors }>;
}

export interface BulkEditParams {
  walletIds: number[];
  updates: {
    label?: string;
    isActive?: boolean;
  };
}

export interface BulkEditResult {
  successful: Array<{
    id: number;
    publicKey: string;
    wallet: Wallet;
  }>;
  failed: Array<{ id: number; error: WalletErrors }>;
}

export interface ListWalletsParams {
  activeOnly?: boolean;
  includeBalances?: boolean;
}

export interface ListWalletsResult {
  wallets: Wallet[];
  meta: {
    totalWallets: number;
    activeWallets: number;
    inactiveWallets: number;
    walletsWithNullBalance: number;
    refreshed: boolean;
  };
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
