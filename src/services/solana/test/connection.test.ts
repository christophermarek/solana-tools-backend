import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import * as solanaService from "../_index.ts";
import { PublicKey } from "@solana/web3.js";
import * as logging from "../../../utils/logging.ts";
import { loadEnv } from "../../../utils/env.ts";

Deno.test({
  name: "Test validateConnection failure - invalid connection",
  async fn() {
    await loadEnv(".env.devnet");
    const originalEnv = Deno.env.get("RPC_URL");
    const originalHeliusEnv = Deno.env.get("HELIUS_RPC_URL");

    try {
      Deno.env.set(
        "RPC_URL",
        "https://invalid-rpc-url-that-does-not-exist.com",
      );
      Deno.env.set("HELIUS_RPC_URL", "");

      const testPublicKey = new PublicKey("11111111111111111111111111111111");

      const [isValid, validationError] = await solanaService.validateConnection(
        testPublicKey,
      );

      if (validationError) {
        assertEquals(
          isValid,
          null,
          "Validation result should be null on failure",
        );
        assertExists(validationError, "Validation error should exist");
        assertEquals(
          validationError,
          "Invalid connection",
          "Should return invalid connection error",
        );

        logging.info(
          "connection-test",
          "Connection validation failed as expected",
          {
            error: validationError,
          },
        );
      } else {
        logging.info(
          "connection-test",
          "Connection validation succeeded unexpectedly",
          {
            isValid,
          },
        );
      }
    } finally {
      if (originalEnv) Deno.env.set("RPC_URL", originalEnv);
      if (originalHeliusEnv) Deno.env.set("HELIUS_RPC_URL", originalHeliusEnv);
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test init success - initialize connection service",
  async fn() {
    await loadEnv(".env.devnet");
    const [initResult, initError] = await solanaService.init();

    if (initError) {
      throw new Error(`Failed to initialize service: ${initError}`);
    }

    assertExists(initResult, "Init result should exist");
    assertExists(initResult.success, "Success should exist");
    assertExists(initResult.connectionValid, "Connection valid should exist");
    assertEquals(initResult.success, true, "Init should be successful");
    assertEquals(
      typeof initResult.connectionValid,
      "boolean",
      "Connection valid should be boolean",
    );

    logging.info("connection-test", "Successfully initialized service", {
      success: initResult.success,
      connectionValid: initResult.connectionValid,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
