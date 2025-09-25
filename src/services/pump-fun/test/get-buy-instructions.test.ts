import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { getBuyInstructionsBySolAmount } from "../get-buy-instructions.ts";
import { createTestToken } from "./fixtures.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as logging from "../../../utils/logging.ts";
import { PublicKey } from "@solana/web3.js";

Deno.test({
  name: "Test getBuyInstructionsBySolAmount success",
  async fn() {
    const env = await loadEnv();
    const buyer = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(buyer, "Buyer keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("get-buy-instructions-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const buyAmountSol = 0.002;
    const [transaction, error] = await getBuyInstructionsBySolAmount(
      buyer,
      testToken.mint.publicKey,
      buyAmountSol,
    );

    if (error) {
      throw new Error(`Failed to get buy instructions: ${error}`);
    }

    assertExists(transaction, "Transaction should exist");
    assertExists(
      transaction.instructions,
      "Transaction should have instructions",
    );
    assertEquals(
      transaction.instructions.length > 0,
      true,
      "Transaction should have at least one instruction",
    );

    logging.info(
      "get-buy-instructions-test",
      "Buy instructions created successfully",
      {
        instructionCount: transaction.instructions.length,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getBuyInstructionsBySolAmount failure - non-existent token",
  async fn() {
    const env = await loadEnv();
    const buyer = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    assertExists(buyer, "Buyer keypair should be created from private key");

    const fakeMint = new PublicKey("11111111111111111111111111111111");
    const buyAmountSol = 0.002;

    const [transaction, error] = await getBuyInstructionsBySolAmount(
      buyer,
      fakeMint,
      buyAmountSol,
    );

    assertEquals(transaction, null, "Transaction should be null on failure");
    assertExists(error, "Error should exist");
    assertExists(error, "Error should be defined");

    logging.info(
      "get-buy-instructions-test",
      "Buy instructions failed as expected",
      {
        error: error,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
