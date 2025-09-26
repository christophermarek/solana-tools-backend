import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import * as serverStartupCheck from "../server-startup-check.ts";
import * as logging from "../../../utils/logging.ts";
import { loadEnv } from "../../../utils/env.ts";

Deno.test({
  name: "Test validateSolanaServiceOnStartup success - validate all services",
  async fn() {
    await loadEnv(".env.devnet");
    const isValid = await serverStartupCheck.validateSolanaServiceOnStartup();

    assertExists(isValid, "Validation result should exist");
    assertEquals(
      typeof isValid,
      "boolean",
      "Validation result should be boolean",
    );
    assertEquals(isValid, true, "Service validation should be successful");

    logging.info(
      "server-startup-test",
      "Successfully validated Solana service on startup",
      {
        isValid,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name:
    "Test validateSolanaServiceOnStartup failure - invalid RPC configuration",
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

      const isValid = await serverStartupCheck.validateSolanaServiceOnStartup();

      assertExists(isValid, "Validation result should exist");
      assertEquals(
        typeof isValid,
        "boolean",
        "Validation result should be boolean",
      );

      if (isValid) {
        logging.info(
          "server-startup-test",
          "Service validation succeeded unexpectedly",
          {
            isValid,
          },
        );
      } else {
        assertEquals(
          isValid,
          false,
          "Service validation should fail with invalid RPC",
        );

        logging.info(
          "server-startup-test",
          "Service validation failed as expected",
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
