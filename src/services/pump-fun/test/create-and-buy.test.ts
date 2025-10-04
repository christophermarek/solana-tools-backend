import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { createAndBuy } from "../create-and-buy.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";
import logging from "../../../utils/logging.ts";

Deno.test({
  name: "Test createAndBuy with TEST_WALLET_PRIVATE_KEY as creator",
  async fn() {
    const env = await loadEnv(".env.devnet");
    assertExists(
      env.TEST_WALLET_PRIVATE_KEY,
      "TEST_WALLET_PRIVATE_KEY should be configured",
    );
    assertExists(env.RPC_URL, "RPC_URL should be configured");

    const creator = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(creator, "Creator keypair should be created from private key");

    const meta = {
      name: "Test Token",
      symbol: "TEST",
      description: "A test token for testing purposes",
      file: new Blob(),
    } as CreateTokenMetadata;

    const buyAmountSol = 0.01;
    const testTelegramUserId = "test-user-123";

    const [result, error] = await createAndBuy(
      creator,
      meta,
      buyAmountSol,
      testTelegramUserId,
    );
    if (result !== null) {
      logging.info(
        "createAndBuy",
        logging.safeStringify({
          creator: creator.publicKey.toString(),
          meta,
          buyAmountSol,
          curve: result.curve,
          mint: result.mint.publicKey.toString(),
          pumpLink: result.pumpLink,
          amountBought: result.amountBought,
          totalSolSpent: result.totalSolSpent,
        }),
      );
    }

    if (error) {
      throw new Error(`createAndBuy failed with error: ${error}`);
    }

    assertExists(result, "Result should be returned on success");
    assertExists(result.transactionResult, "Transaction result should exist");
    assertExists(result.mint, "Mint should exist");
    assertExists(result.curve, "Curve should exist");
    assertExists(result.pumpLink, "Pump link should exist");
    assertExists(result.amountBought, "Amount bought should exist");
    assertExists(result.totalSolSpent, "Total SOL spent should exist");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
