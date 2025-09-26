import { PublicKey } from "@solana/web3.js";

export interface BalanceResult {
  nativeSol: number;
  wrappedSol: number;
  totalLamports: number;
  totalSol: number;
}

export interface WalletBalance {
  id: number;
  publicKey: string;
  label?: string;
  solBalance: number;
  wsolBalance: number;
  totalBalance: number;
  lastUpdated: Date;
  balanceStatus: string;
}

export interface GetBalanceParams {
  publicKey: string;
  requestId?: string;
}

export interface GetBalanceResult {
  balance: WalletBalance | null;
}

export interface GetSolBalanceParams {
  publicKey: PublicKey;
  requestId?: string;
}

export interface GetSolBalanceResult {
  balance: number;
}

export interface GetWsolBalanceParams {
  publicKey: PublicKey;
  requestId?: string;
}

export interface GetWsolBalanceResult {
  balance: number;
}

export interface GetTotalSolBalanceParams {
  publicKey: PublicKey;
  requestId?: string;
}

export interface GetTotalSolBalanceResult {
  balance: BalanceResult;
}

export interface RateLimitResult {
  canMakeRequest: boolean;
  waitTimeMs: number;
}

export interface ServiceInitResult {
  success: boolean;
  connectionValid: boolean;
  error?: string;
}

export interface BlockWaitResult {
  success: boolean;
  blocksWaited: number;
  error?: string;
}
