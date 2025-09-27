import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { createAndBuy } from "../../pump-fun/create-and-buy.ts";
import { sell } from "../../pump-fun/sell.ts";
import { getSPLBalance } from "../../pump-fun/get-spl-balance.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";
import * as solanaService from "../../solana/_index.ts";
import * as logging from "../../../utils/logging.ts";
import {
  Keypair,
  PublicKey,
  type VersionedTransactionResponse,
} from "@solana/web3.js";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { initializeDb } from "../../../db/client.ts";

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

export interface BotTestContext {
  wallet: Keypair;
  testToken: TestToken;
  initialSolBalance: number;
}

let cachedTestToken: TestToken | null = null;

export async function createTestToken(useCache = true): Promise<TestToken> {
  if (useCache && cachedTestToken) {
    logging.info("bot-test-fixtures", "Using cached test token", {
      mint: cachedTestToken.mint.publicKey.toString(),
      pumpLink: cachedTestToken.pumpLink,
    });
    return cachedTestToken;
  }

  logging.info("bot-test-fixtures", "Creating new test token");
  const env = await loadEnv(".env.devnet");
  await initializeDb();
  assertExists(
    env.TEST_WALLET_PRIVATE_KEY,
    "TEST_WALLET_PRIVATE_KEY should be configured",
  );
  assertExists(env.RPC_URL, "RPC_URL should be configured");

  const creator = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
  assertExists(creator, "Creator keypair should be created from private key");

  const meta = {
    name: "Bot Test Token",
    symbol: "BTT",
    description: "A test token for bot testing purposes",
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
  logging.info("bot-test-fixtures", "Cached new test token", {
    mint: testToken.mint.publicKey.toString(),
    pumpLink: testToken.pumpLink,
  });

  return testToken;
}

export async function getWalletInfo(): Promise<WalletInfo> {
  const env = await loadEnv(".env.devnet");
  await initializeDb();
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
  logging.info("bot-test-fixtures", "Wallet SOL balance", {
    balance: walletInfo.solBalance,
    publicKey: walletInfo.publicKey.toString(),
  });
}

export async function setupBotTestContext(): Promise<BotTestContext> {
  logging.info("bot-test-fixtures", "Setting up bot test context");

  await logWalletInfo();

  const walletInfo = await getWalletInfo();
  const testToken = await createTestToken();

  logging.info("bot-test-fixtures", "Bot test context ready", {
    wallet: walletInfo.publicKey.toString(),
    mint: testToken.mint.publicKey.toString(),
    initialSolBalance: walletInfo.solBalance,
    pumpLink: testToken.pumpLink,
  });

  return {
    wallet: walletInfo.keypair,
    testToken,
    initialSolBalance: walletInfo.solBalance,
  };
}

export async function cleanupBotTest(context: BotTestContext): Promise<void> {
  logging.info("bot-test-fixtures", "Starting bot test cleanup", {
    wallet: context.wallet.publicKey.toString(),
    mint: context.testToken.mint.publicKey.toString(),
  });

  try {
    const [splBalance, splBalanceError] = await getSPLBalance(
      context.wallet.publicKey,
      context.testToken.mint.publicKey,
    );

    if (splBalanceError) {
      logging.warn(
        "bot-test-fixtures",
        "Failed to get SPL balance for cleanup",
        {
          error: splBalanceError,
        },
      );
      return;
    }

    if (splBalance && splBalance > 0) {
      logging.info(
        "bot-test-fixtures",
        "Selling remaining tokens for cleanup",
        {
          balance: splBalance,
          mint: context.testToken.mint.publicKey.toString(),
        },
      );

      const sellAmountSol = Math.min(splBalance, 0.01);
      const [sellResult, sellError] = await sell(
        context.wallet,
        context.testToken.mint,
        {
          sellAmountSol: sellAmountSol,
        },
      );

      if (sellError) {
        logging.warn(
          "bot-test-fixtures",
          "Failed to sell tokens during cleanup",
          {
            error: sellError,
          },
        );
      } else {
        logging.info(
          "bot-test-fixtures",
          "Successfully sold tokens during cleanup",
          {
            sellResult,
          },
        );
      }
    } else {
      logging.info("bot-test-fixtures", "No tokens to sell during cleanup");
    }

    const finalWalletInfo = await getWalletInfo();
    logging.info("bot-test-fixtures", "Cleanup completed", {
      initialBalance: context.initialSolBalance,
      finalBalance: finalWalletInfo.solBalance,
      balanceChange: finalWalletInfo.solBalance - context.initialSolBalance,
    });
  } catch (error) {
    logging.error("bot-test-fixtures", "Error during cleanup", error);
  }
}

export async function withBotTestCleanup<T>(
  testFn: (context: BotTestContext) => Promise<T>,
): Promise<T> {
  const context = await setupBotTestContext();

  try {
    const result = await testFn(context);
    return result;
  } finally {
    await cleanupBotTest(context);
  }
}
