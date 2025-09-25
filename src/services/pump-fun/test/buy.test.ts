import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { buy } from "../buy.ts";
import { getSPLBalance } from "../get-spl-balance.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { createTestToken, logWalletInfo } from "./fixtures.ts";
import { PUMP_FUN_ERRORS } from "../_errors.ts";
import * as logging from "../../../utils/logging.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

Deno.test({
  name: "Test buy success - create token, buy more, check balance",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv();
    const buyer = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(buyer, "Buyer keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("buy-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const initialBalance = await getSPLBalance(
      buyer.publicKey,
      testToken.mint.publicKey,
    );
    if (initialBalance[0] === null) {
      throw new Error(`Failed to get initial balance: ${initialBalance[1]}`);
    }

    logging.info("buy-test", "Initial balance", { balance: initialBalance[0] });

    const buyAmountSol = 0.005;
    const [buyResult, buyError] = await buy(
      buyer,
      testToken.mint,
      buyAmountSol,
    );

    if (buyError) {
      throw new Error(`Buy failed with error: ${buyError}`);
    }

    assertExists(buyResult, "Buy result should exist");
    assertExists(
      buyResult.transactionResult,
      "Transaction result should exist",
    );
    assertExists(buyResult.curve, "Curve should exist");

    logging.info("buy-test", "Buy successful", {
      buyAmountSol,
      transactionResult: buyResult.transactionResult,
    });

    const finalBalance = await getSPLBalance(
      buyer.publicKey,
      testToken.mint.publicKey,
    );
    if (finalBalance[0] === null) {
      throw new Error(`Failed to get final balance: ${finalBalance[1]}`);
    }

    logging.info("buy-test", "Final balance", { balance: finalBalance[0] });
    assertEquals(
      finalBalance[0] > initialBalance[0],
      true,
      "Final balance should be greater than initial balance",
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test buy failure - try to buy non-existent token",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv();
    const buyer = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(buyer, "Buyer keypair should be created from private key");

    const fakeMint = {
      publicKey: new PublicKey("11111111111111111111111111111111"),
    } as Keypair;

    const buyAmountSol = 0.005;

    const [buyResult, buyError] = await buy(buyer, fakeMint, buyAmountSol);

    assertEquals(buyResult, null, "Buy result should be null on failure");
    assertExists(buyError, "Buy error should exist");
    assertExists(buyError.type, "Error should have type");
    assertEquals(buyError.type, "SDK_ERROR", "Should return SDK error type");

    logging.info("buy-test", "Buy failed as expected", { error: buyError });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test buy with cached token - reuse existing token",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv();
    const buyer = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(buyer, "Buyer keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("buy-test", "Using cached test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const initialBalance = await getSPLBalance(
      buyer.publicKey,
      testToken.mint.publicKey,
    );
    if (initialBalance[0] === null) {
      throw new Error(`Failed to get initial balance: ${initialBalance[1]}`);
    }

    logging.info("buy-test", "Initial balance", { balance: initialBalance[0] });

    const buyAmountSol = 0.002;
    const [buyResult, buyError] = await buy(
      buyer,
      testToken.mint,
      buyAmountSol,
    );

    if (buyError) {
      throw new Error(`Buy failed with error: ${buyError}`);
    }

    assertExists(buyResult, "Buy result should exist");
    assertExists(
      buyResult.transactionResult,
      "Transaction result should exist",
    );
    assertExists(buyResult.curve, "Curve should exist");

    logging.info("buy-test", "Buy successful with cached token", {
      buyAmountSol,
      transactionResult: buyResult.transactionResult,
    });

    const finalBalance = await getSPLBalance(
      buyer.publicKey,
      testToken.mint.publicKey,
    );
    if (finalBalance[0] === null) {
      throw new Error(`Failed to get final balance: ${finalBalance[1]}`);
    }

    logging.info("buy-test", "Final balance", { balance: finalBalance[0] });
    assertEquals(
      finalBalance[0] > initialBalance[0],
      true,
      "Final balance should be greater than initial balance",
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
