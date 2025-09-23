import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { createAndBuy } from "../create-and-buy.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";
import * as solanaService from "../../solana/index.ts";
import * as logging from "../../../utils/logging.ts";
import {
  Keypair,
  PublicKey,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";

export interface TestToken {
  mint: Keypair;
  curve: BondingCurveAccount;
  pumpLink: string;
  transactionResult: VersionedTransactionResponse;
}

export interface WalletInfo {
  keypair: Keypair;
  publicKey: PublicKey;
  solBalance: number;
}

let cachedTestToken: TestToken | null = null;

export async function createTestToken(useCache = true): Promise<TestToken> {
  if (useCache && cachedTestToken) {
    logging.info("test-fixtures", "Using cached test token", {
      mint: cachedTestToken.mint.publicKey.toString(),
      pumpLink: cachedTestToken.pumpLink,
    });
    return cachedTestToken;
  }

  logging.info("test-fixtures", "Creating new test token");
  const env = await loadEnv();
  assertExists(
    env.PUMP_FUN_WALLET_PRIVATE_KEY,
    "PUMP_FUN_WALLET_PRIVATE_KEY should be configured",
  );
  assertExists(env.RPC_URL, "RPC_URL should be configured");

  const creator = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
  assertExists(creator, "Creator keypair should be created from private key");

  const meta = {
    name: "Test Token",
    symbol: "TEST",
    description: "A test token for testing purposes",
    file: new Blob(),
  } as CreateTokenMetadata;

  const buyAmountSol = 0.01;

  const [result, error] = await createAndBuy(creator, meta, buyAmountSol);
  if (error) {
    throw new Error(`createAndBuy failed with error: ${error}`);
  }

  assertExists(result, "Result should be returned on success");
  assertExists(result.transactionResult, "Transaction result should exist");
  assertExists(result.mint, "Mint should exist");
  assertExists(result.curve, "Curve should exist");
  assertExists(result.pumpLink, "Pump link should exist");

  const testToken = {
    mint: result.mint,
    curve: result.curve,
    pumpLink: result.pumpLink,
    transactionResult: result.transactionResult,
  };

  cachedTestToken = testToken;
  logging.info("test-fixtures", "Cached new test token", {
    mint: testToken.mint.publicKey.toString(),
    pumpLink: testToken.pumpLink,
  });

  return testToken;
}

export async function getWalletInfo(): Promise<WalletInfo> {
  const env = await loadEnv();
  const keypair = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
  assertExists(keypair, "Keypair should be created from private key");

  const balance = await solanaService.getSolBalance(keypair.publicKey);
  const solBalance = solanaService.lamportsToSol(balance);

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
