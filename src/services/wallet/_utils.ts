import { Wallet, WalletWithBalance } from "./_types.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { Keypair } from "@solana/web3.js";
import logging from "../../utils/logging.ts";

export interface BalanceData {
  id: number;
  publicKey: string;
  label?: string;
  solBalance: number;
  wsolBalance: number;
  totalBalance: number;
  lastUpdated: Date;
  balanceStatus: string;
}

export function calculateTotalBalance(
  solBalance: bigint | number | null | undefined,
  wsolBalance: bigint | number | null | undefined,
): number | undefined {
  if (solBalance === null && wsolBalance === null) return undefined;
  if (solBalance === undefined && wsolBalance === undefined) return undefined;

  const solValue = solBalance !== null && solBalance !== undefined
    ? Number(solBalance) / 1e9
    : 0;
  const wsolValue = wsolBalance !== null && wsolBalance !== undefined
    ? Number(wsolBalance) / 1e9
    : 0;

  return solValue + wsolValue;
}

export function mapWalletFromDb(dbKeypair: DbKeypair): Wallet {
  return {
    id: dbKeypair.id,
    publicKey: dbKeypair.public_key,
    label: dbKeypair.label,
    isActive: Boolean(dbKeypair.is_active),
    createdAt: new Date(dbKeypair.created_at),
    solBalance: dbKeypair.sol_balance
      ? Number(dbKeypair.sol_balance) / 1e9
      : undefined,
    wsolBalance: dbKeypair.wsol_balance
      ? Number(dbKeypair.wsol_balance) / 1e9
      : undefined,
    totalBalance: calculateTotalBalance(
      dbKeypair.sol_balance,
      dbKeypair.wsol_balance,
    ),
    lastBalanceUpdate: dbKeypair.last_balance_update
      ? new Date(dbKeypair.last_balance_update)
      : undefined,
    balanceStatus: dbKeypair.balance_status,
  };
}

export function mapWalletWithBalanceFromDb(
  dbKeypair: DbKeypair,
  balance: BalanceData,
): WalletWithBalance {
  return {
    id: dbKeypair.id,
    publicKey: dbKeypair.public_key,
    label: dbKeypair.label,
    isActive: Boolean(dbKeypair.is_active),
    createdAt: new Date(dbKeypair.created_at),
    solBalance: balance.solBalance,
    wsolBalance: balance.wsolBalance,
    totalBalance: balance.totalBalance,
    lastBalanceUpdate: balance.lastUpdated,
    balanceStatus: balance.balanceStatus,
  };
}

export interface WalletValidationData {
  wallet: DbKeypair;
  keypair: Keypair;
}

export async function validateWalletAndGetKeypair(
  walletId: number,
  requestId: string,
): Promise<[WalletValidationData, null] | [null, string]> {
  const wallet = await keypairRepo.findById(walletId, requestId);
  if (!wallet) {
    logging.error(
      requestId,
      `Wallet with ID ${walletId} not found`,
      new Error("Wallet not found"),
    );
    return [null, "Wallet not found"];
  }

  if (!wallet.is_active) {
    logging.error(
      requestId,
      `Wallet with ID ${walletId} is inactive`,
      new Error("Wallet is inactive"),
    );
    return [null, "Wallet is inactive"];
  }

  const keypair = keypairRepo.toKeypair(wallet.secret_key);
  if (!keypair) {
    logging.error(
      requestId,
      `Failed to convert wallet ${walletId} to keypair`,
      new Error("Failed to convert wallet to keypair"),
    );
    return [null, "Failed to convert wallet to keypair"];
  }

  return [{ wallet, keypair }, null];
}
