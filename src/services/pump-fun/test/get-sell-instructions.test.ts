import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { getSellInstructionsByTokenAmount } from "../get-sell-instructions.ts";
import { createTestToken } from "./fixtures.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as logging from "../../../utils/logging.ts";
import { PublicKey } from "@solana/web3.js";

Deno.test({
  name: "Test getSellInstructionsByTokenAmount success",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const seller = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(seller, "Seller keypair should be created from private key");

    const testToken = await createTestToken();
    logging.info("get-sell-instructions-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const sellTokenAmount = 1000;
    const [transaction, error] = await getSellInstructionsByTokenAmount(
      seller,
      testToken.mint.publicKey,
      sellTokenAmount,
    );

    if (error) {
      throw new Error(`Failed to get sell instructions: ${error}`);
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
      "get-sell-instructions-test",
      "Sell instructions created successfully",
      {
        instructionCount: transaction.instructions.length,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getSellInstructionsByTokenAmount failure - non-existent token",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const seller = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(seller, "Seller keypair should be created from private key");

    const fakeMint = new PublicKey("11111111111111111111111111111111");
    const sellTokenAmount = 1000;

    const [transaction, error] = await getSellInstructionsByTokenAmount(
      seller,
      fakeMint,
      sellTokenAmount,
    );

    assertEquals(transaction, null, "Transaction should be null on failure");
    assertExists(error, "Error should exist");
    assertExists(error, "Error should be defined");

    logging.info(
      "get-sell-instructions-test",
      "Sell instructions failed as expected",
      {
        error: error,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
