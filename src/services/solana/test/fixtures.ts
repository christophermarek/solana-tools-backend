import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as solanaService from "../_index.ts";
import * as logging from "../../../utils/logging.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

export interface WalletInfo {
  keypair: Keypair;
  publicKey: PublicKey;
  solBalance: number;
}

export async function getWalletInfo(): Promise<WalletInfo> {
  const env = await loadEnv(".env.devnet");
  const keypair = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
  assertExists(keypair, "Keypair should be created from private key");

  const [balance, balanceError] = await solanaService.getSolBalance({
    publicKey: keypair.publicKey,
  });
  if (balanceError) {
    throw new Error(`Failed to get SOL balance: ${balanceError}`);
  }
  const solBalance = solanaService.lamportsToSol(balance.balance);

  return {
    keypair,
    publicKey: keypair.publicKey,
    solBalance,
  };
}

export async function getWalletSolBalance(): Promise<number> {
  const walletInfo = await getWalletInfo();
  return walletInfo.solBalance;
}

export async function logWalletInfo(): Promise<void> {
  const walletInfo = await getWalletInfo();
  logging.info("test-fixtures", "Wallet SOL balance", {
    balance: walletInfo.solBalance,
    publicKey: walletInfo.publicKey.toString(),
  });
}
