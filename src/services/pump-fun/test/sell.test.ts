import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { buy } from "../buy.ts";
import { sell } from "../sell.ts";
import { getSPLBalance } from "../getSPLBalance.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { createTestToken, logWalletInfo } from "./fixtures.ts";
import { PUMP_FUN_ERRORS } from "../errors.ts";
import * as logging from "../../../utils/logging.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

Deno.test({
  name: "Test sell success - create token, buy more, sell all, check balance",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv();
    const trader = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(trader, "Trader keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("sell-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const initialBalance = await getSPLBalance(
      trader.publicKey,
      testToken.mint.publicKey,
    );
    if (initialBalance[0] === null) {
      throw new Error(`Failed to get initial balance: ${initialBalance[1]}`);
    }

    logging.info("sell-test", "Initial balance", {
      balance: initialBalance[0],
    });

    const buyAmountSol = 0.005;
    const [buyResult, buyError] = await buy(
      trader,
      testToken.mint,
      buyAmountSol,
    );

    if (buyError) {
      throw new Error(`Buy failed with error: ${buyError}`);
    }

    assertExists(buyResult, "Buy result should exist");
    logging.info("sell-test", "Buy successful", { buyAmountSol });

    const afterBuyBalance = await getSPLBalance(
      trader.publicKey,
      testToken.mint.publicKey,
    );
    if (afterBuyBalance[0] === null) {
      throw new Error(`Failed to get after-buy balance: ${afterBuyBalance[1]}`);
    }

    logging.info("sell-test", "After buy balance", {
      balance: afterBuyBalance[0],
    });

    const sellAmountSol = 0.01;
    const [sellResult, sellError] = await sell(
      trader,
      testToken.mint,
      sellAmountSol,
    );

    if (sellError) {
      throw new Error(`Sell failed with error: ${sellError}`);
    }

    assertExists(sellResult, "Sell result should exist");
    assertExists(
      sellResult.transactionResult,
      "Transaction result should exist",
    );
    assertExists(sellResult.curve, "Curve should exist");

    logging.info("sell-test", "Sell successful", {
      sellAmountSol,
      transactionResult: sellResult.transactionResult,
    });

    const finalBalance = await getSPLBalance(
      trader.publicKey,
      testToken.mint.publicKey,
    );
    if (finalBalance[0] === null) {
      throw new Error(`Failed to get final balance: ${finalBalance[1]}`);
    }

    logging.info("sell-test", "Final balance", { balance: finalBalance[0] });
    assertEquals(
      finalBalance[0] < afterBuyBalance[0],
      true,
      "Final balance should be less than after-buy balance",
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test sell failure - try to sell non-existent token",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv();
    const seller = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(seller, "Seller keypair should be created from private key");

    const fakeMint = {
      publicKey: new PublicKey("11111111111111111111111111111111"),
    } as Keypair;
    const sellAmountSol = 0.005;

    const [sellResult, sellError] = await sell(seller, fakeMint, sellAmountSol);

    assertEquals(sellResult, null, "Sell result should be null on failure");
    assertExists(sellError, "Sell error should exist");
    assertEquals(
      sellError,
      PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN,
      "Should return selling token error",
    );

    logging.info("sell-test", "Sell failed as expected", { error: sellError });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
