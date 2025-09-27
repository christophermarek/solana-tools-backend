import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { getTipAccounts } from "../tip-accounts.ts";
import * as logging from "../../../utils/logging.ts";

Deno.test({
  name: "Test Jito tip accounts with timeout",
  async fn() {
    const env = await loadEnv(".env.testnet");
    assertExists(env.RPC_URL, "RPC_URL should be configured");

    logging.info("tip-accounts-test", "Testing tip accounts with timeout");

    const startTime = Date.now();
    const [result, error] = await getTipAccounts(15000);

    const duration = Date.now() - startTime;
    logging.info("tip-accounts-test", "Tip accounts test completed", {
      duration,
      success: !!result,
      error: typeof error === "string"
        ? error
        : (error as Error)?.message || String(error),
    });

    if (error) {
      console.error("Full error object in test:", error);
      console.error(
        "Error stringified in test:",
        JSON.stringify(error, null, 2),
      );

      logging.error("tip-accounts-test", "Tip accounts failed", {
        error: typeof error === "string"
          ? error
          : (error as Error)?.message || String(error),
        errorType: typeof error,
        errorDetails: JSON.stringify(error, null, 2),
        duration,
      });
      throw new Error(
        `Tip accounts failed: ${
          typeof error === "string"
            ? error
            : (error as Error)?.message || String(error)
        }`,
      );
    } else {
      logging.info("tip-accounts-test", "Tip accounts succeeded", {
        count: result?.tipAccounts.length || 0,
        duration,
      });
      assertExists(result, "Result should exist");
      assertExists(result.tipAccounts, "Tip accounts should exist");
      assertEquals(
        result.tipAccounts.length > 0,
        true,
        "Should have at least one tip account",
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
