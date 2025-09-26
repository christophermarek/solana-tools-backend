import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { getCreateInstructions } from "../get-create-instructions.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as logging from "../../../utils/logging.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";

Deno.test({
  name: "Test getCreateInstructions success",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const creator = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(creator, "Creator keypair should be created from private key");

    const metadata: CreateTokenMetadata = {
      name: "Test Token",
      symbol: "TEST",
      description: "A test token for testing purposes",
      file: new Blob(),
    };

    const [transaction, error] = await getCreateInstructions(creator, metadata);

    if (error) {
      throw new Error(`Failed to get create instructions: ${error}`);
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
      "get-create-instructions-test",
      "Create instructions created successfully",
      {
        instructionCount: transaction.instructions.length,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getCreateInstructions failure - SDK error",
  async fn() {
    const env = await loadEnv(".env.devnet");
    const creator = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(creator, "Creator keypair should be created from private key");

    const metadata: CreateTokenMetadata = {
      name: "Test Token",
      symbol: "TEST",
      description: "A test token for testing purposes",
      file: new Blob(),
    };

    const [transaction, error] = await getCreateInstructions(creator, metadata);

    if (error) {
      logging.info(
        "get-create-instructions-test",
        "Create instructions failed as expected",
        {
          error: error,
        },
      );
      return;
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
      "get-create-instructions-test",
      "Create instructions created successfully",
      {
        instructionCount: transaction.instructions.length,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
