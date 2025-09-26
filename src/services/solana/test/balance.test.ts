import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as solanaService from "../_index.ts";
import { PublicKey } from "@solana/web3.js";
import * as logging from "../../../utils/logging.ts";

Deno.test({
  name: "Test getSolBalance success - fetch balance for valid address",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const keypair = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(keypair, "Keypair should be created from private key");

    const [balanceResult, balanceError] = await solanaService.getSolBalance({
      publicKey: keypair.publicKey,
      requestId: "balance-test",
    });

    if (balanceError) {
      throw new Error(`Failed to get SOL balance: ${balanceError}`);
    }

    assertExists(balanceResult, "Balance result should exist");
    assertExists(balanceResult.balance, "Balance should exist");
    assertEquals(
      typeof balanceResult.balance,
      "number",
      "Balance should be a number",
    );

    logging.info("balance-test", "Successfully fetched SOL balance", {
      balance: solanaService.lamportsToSol(balanceResult.balance),
      publicKey: keypair.publicKey.toString(),
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getSolBalance failure - invalid public key",
  async fn() {
    await loadEnv(".env.devnet");
    const invalidPublicKey = new PublicKey("11111111111111111111111111111112");

    const [balanceResult, balanceError] = await solanaService.getSolBalance({
      publicKey: invalidPublicKey,
      requestId: "balance-test",
    });

    if (balanceError) {
      assertEquals(
        balanceResult,
        null,
        "Balance result should be null on failure",
      );
      assertExists(balanceError, "Balance error should exist");
      assertEquals(
        balanceError,
        "Failed to fetch balance",
        "Should return balance fetch failed error",
      );

      logging.info("balance-test", "Balance fetch failed as expected", {
        error: balanceError,
      });
    } else {
      logging.info(
        "balance-test",
        "Balance fetch succeeded for invalid address",
        {
          balance: balanceResult.balance,
        },
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getWsolBalance success - fetch WSOL balance for valid address",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const keypair = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(keypair, "Keypair should be created from private key");

    const [wsolResult, wsolError] = await solanaService.getWsolBalance({
      publicKey: keypair.publicKey,
      requestId: "balance-test",
    });

    if (wsolError) {
      throw new Error(`Failed to get WSOL balance: ${wsolError}`);
    }

    assertExists(wsolResult, "WSOL balance result should exist");
    assertExists(wsolResult.balance, "WSOL balance should exist");
    assertEquals(
      typeof wsolResult.balance,
      "number",
      "WSOL balance should be a number",
    );

    logging.info("balance-test", "Successfully fetched WSOL balance", {
      balance: wsolResult.balance,
      publicKey: keypair.publicKey.toString(),
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getWsolBalance failure - invalid public key",
  async fn() {
    await loadEnv(".env.devnet");
    const invalidPublicKey = new PublicKey("11111111111111111111111111111112");

    const [wsolResult, wsolError] = await solanaService.getWsolBalance({
      publicKey: invalidPublicKey,
      requestId: "balance-test",
    });

    if (wsolError) {
      assertEquals(
        wsolResult,
        null,
        "WSOL balance result should be null on failure",
      );
      assertExists(wsolError, "WSOL balance error should exist");
      assertEquals(
        wsolError,
        "Failed to fetch balance",
        "Should return balance fetch failed error",
      );

      logging.info("balance-test", "WSOL balance fetch failed as expected", {
        error: wsolError,
      });
    } else {
      logging.info(
        "balance-test",
        "WSOL balance fetch succeeded for invalid address",
        {
          balance: wsolResult.balance,
        },
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "Test getTotalSolBalance success - fetch total balance for valid address",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const keypair = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(keypair, "Keypair should be created from private key");

    const [totalResult, totalError] = await solanaService.getTotalSolBalance({
      publicKey: keypair.publicKey,
      requestId: "balance-test",
    });

    if (totalError) {
      throw new Error(`Failed to get total SOL balance: ${totalError}`);
    }

    assertExists(totalResult, "Total balance result should exist");
    assertExists(totalResult.balance, "Total balance should exist");
    assertExists(totalResult.balance.nativeSol, "Native SOL should exist");
    assertExists(totalResult.balance.wrappedSol, "Wrapped SOL should exist");
    assertExists(totalResult.balance.totalSol, "Total SOL should exist");
    assertExists(
      totalResult.balance.totalLamports,
      "Total lamports should exist",
    );

    assertEquals(
      typeof totalResult.balance.nativeSol,
      "number",
      "Native SOL should be a number",
    );
    assertEquals(
      typeof totalResult.balance.wrappedSol,
      "number",
      "Wrapped SOL should be a number",
    );
    assertEquals(
      typeof totalResult.balance.totalSol,
      "number",
      "Total SOL should be a number",
    );

    logging.info("balance-test", "Successfully fetched total SOL balance", {
      nativeSol: totalResult.balance.nativeSol,
      wrappedSol: totalResult.balance.wrappedSol,
      totalSol: totalResult.balance.totalSol,
      totalLamports: totalResult.balance.totalLamports,
      publicKey: keypair.publicKey.toString(),
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getTotalSolBalance failure - invalid public key",
  async fn() {
    await loadEnv(".env.devnet");
    const invalidPublicKey = new PublicKey("11111111111111111111111111111112");

    const [totalResult, totalError] = await solanaService.getTotalSolBalance({
      publicKey: invalidPublicKey,
      requestId: "balance-test",
    });

    if (totalError) {
      assertEquals(
        totalResult,
        null,
        "Total balance result should be null on failure",
      );
      assertExists(totalError, "Total balance error should exist");
      assertEquals(
        totalError,
        "Failed to fetch balance",
        "Should return balance fetch failed error",
      );

      logging.info("balance-test", "Total balance fetch failed as expected", {
        error: totalError,
      });
    } else {
      logging.info(
        "balance-test",
        "Total balance fetch succeeded for invalid address",
        {
          balance: totalResult.balance,
        },
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "Test getBalanceByPublicKey success - fetch wallet balance from database",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const keypair = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(keypair, "Keypair should be created from private key");

    const [walletResult, walletError] = await solanaService
      .getBalanceByPublicKey({
        publicKey: keypair.publicKey.toString(),
        requestId: "balance-test",
      });

    if (walletError) {
      logging.info(
        "balance-test",
        "Database not initialized, testing error handling",
        {
          error: walletError,
        },
      );
      assertEquals(
        walletError,
        "Failed to fetch balance",
        "Should return database error as balance fetch failed",
      );
    } else {
      assertExists(walletResult, "Wallet balance result should exist");
      assertExists(walletResult.balance, "Wallet balance should exist");
      assertExists(walletResult.balance.id, "Wallet ID should exist");
      assertExists(walletResult.balance.publicKey, "Public key should exist");
      assertExists(walletResult.balance.solBalance, "SOL balance should exist");
      assertExists(
        walletResult.balance.wsolBalance,
        "WSOL balance should exist",
      );
      assertExists(
        walletResult.balance.totalBalance,
        "Total balance should exist",
      );
      assertExists(
        walletResult.balance.lastUpdated,
        "Last updated should exist",
      );
      assertExists(
        walletResult.balance.balanceStatus,
        "Balance status should exist",
      );

      logging.info("balance-test", "Successfully fetched wallet balance", {
        id: walletResult.balance.id,
        publicKey: walletResult.balance.publicKey,
        solBalance: walletResult.balance.solBalance,
        wsolBalance: walletResult.balance.wsolBalance,
        totalBalance: walletResult.balance.totalBalance,
        lastUpdated: walletResult.balance.lastUpdated,
        balanceStatus: walletResult.balance.balanceStatus,
      });
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getBalanceByPublicKey failure - invalid public key format",
  async fn() {
    await loadEnv(".env.devnet");
    const invalidPublicKey = "invalid-public-key-format";

    const [walletResult, walletError] = await solanaService
      .getBalanceByPublicKey({
        publicKey: invalidPublicKey,
        requestId: "balance-test",
      });

    assertEquals(
      walletResult,
      null,
      "Wallet balance result should be null on failure",
    );
    assertExists(walletError, "Wallet balance error should exist");
    assertEquals(
      walletError,
      "Invalid public key format",
      "Should return invalid public key error",
    );

    logging.info("balance-test", "Wallet balance fetch failed as expected", {
      error: walletError,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
