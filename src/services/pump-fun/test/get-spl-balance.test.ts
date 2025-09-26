import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { getSPLBalance } from "../get-spl-balance.ts";
import { buy } from "../buy.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { createTestToken, logWalletInfo } from "./fixtures.ts";
import * as logging from "../../../utils/logging.ts";
import { PublicKey } from "@solana/web3.js";

Deno.test({
  name:
    "Test getSPLBalance success - create token, buy more, check balance increase",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv(".env.devnet");
    const wallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet, "Wallet keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("balance-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const initialBalance = await getSPLBalance(
      wallet.publicKey,
      testToken.mint.publicKey,
    );
    if (initialBalance[0] === null) {
      throw new Error(`Failed to get initial balance: ${initialBalance[1]}`);
    }

    logging.info("balance-test", "Initial balance", {
      balance: initialBalance[0],
    });

    const buyAmountSol = 0.005;
    const [buyResult, buyError] = await buy(
      wallet,
      testToken.mint,
      buyAmountSol,
    );

    if (buyError) {
      throw new Error(`Buy failed with error: ${buyError}`);
    }

    assertExists(buyResult, "Buy result should exist");
    logging.info("balance-test", "Buy successful", { buyAmountSol });

    const finalBalance = await getSPLBalance(
      wallet.publicKey,
      testToken.mint.publicKey,
    );
    if (finalBalance[0] === null) {
      throw new Error(`Failed to get final balance: ${finalBalance[1]}`);
    }

    logging.info("balance-test", "Final balance", { balance: finalBalance[0] });
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
  name: "Test getSPLBalance failure - check balance on non-existent token",
  async fn() {
    await logWalletInfo();

    const env = await loadEnv(".env.devnet");
    const wallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet, "Wallet keypair should be created from private key");

    const fakeMint = new PublicKey("11111111111111111111111111111111");

    const [balance, error] = await getSPLBalance(wallet.publicKey, fakeMint);

    assertEquals(balance, null, "Balance should be null for invalid mint");
    assertExists(error, "Error should exist for invalid mint");
    assertEquals(
      error,
      "Error getting SPL token balance",
      "Should return SPL balance error",
    );

    logging.info("balance-test", "Balance check on non-existent token", {
      balance,
      error,
      mint: fakeMint.toString(),
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
