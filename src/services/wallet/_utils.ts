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

  // Handle 32-bit integer overflow issue with SQLite driver
  let wsolValue = 0;
  if (wsolBalance !== null && wsolBalance !== undefined) {
    if (wsolBalance < 0) {
      // This is likely a 32-bit overflow, convert back to positive
      wsolValue = (Number(wsolBalance) + 0x100000000) / 1e9;
    } else {
      wsolValue = Number(wsolBalance) / 1e9;
    }
  }

  return solValue + wsolValue;
}

export function mapWalletFromDb(dbKeypair: DbKeypair): Wallet {
  // Handle 32-bit integer overflow issue with SQLite driver
  // The driver returns BIGINT values as 32-bit signed integers, causing overflow
  const solValue = dbKeypair.sol_balance
    ? Number(dbKeypair.sol_balance) / 1e9
    : undefined;

  // Fix for wsol_balance overflow: if negative, it's likely an overflow
  let wsolValue: number | undefined;
  if (dbKeypair.wsol_balance !== null && dbKeypair.wsol_balance !== undefined) {
    if (dbKeypair.wsol_balance < 0) {
      // This is likely a 32-bit overflow, convert back to positive
      // The overflow value -1294967296 represents 3000000000 in 32-bit overflow
      wsolValue = (dbKeypair.wsol_balance + 0x100000000) / 1e9;
    } else {
      wsolValue = Number(dbKeypair.wsol_balance) / 1e9;
    }
  }

  return {
    id: dbKeypair.id,
    publicKey: dbKeypair.public_key,
    label: dbKeypair.label ?? undefined,
    createdAt: new Date(dbKeypair.created_at),
    solBalance: solValue,
    wsolBalance: wsolValue,
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
    label: dbKeypair.label ?? undefined,
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
  ownerUserId: string,
  requestId: string,
): Promise<[WalletValidationData, null] | [null, string]> {
  const wallet = await keypairRepo.findById(walletId, ownerUserId, requestId);
  if (!wallet) {
    logging.error(
      requestId,
      `Wallet with ID ${walletId} not found`,
      new Error("Wallet not found"),
    );
    return [null, "Wallet not found"];
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
