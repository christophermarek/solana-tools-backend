import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { clearJitoService, getJitoService } from "../_index.ts";
import * as logging from "../../../utils/logging.ts";

Deno.test({
  name: "Test Jito service connection on testnet",
  async fn() {
    const env = await loadEnv();
    assertExists(env.RPC_URL, "RPC_URL should be configured");

    logging.info("jito-connection-test", "Testing Jito service connection");

    clearJitoService();

    const [service, error] = getJitoService();
    if (error) {
      throw new Error(`Jito service initialization failed: ${error}`);
    }

    assertExists(service, "Jito service should be created");
    assertExists(service.client, "Jito client should exist");
    assertExists(service.isInitialized, "Service should be initialized");

    logging.info(
      "jito-connection-test",
      "Jito service connected successfully",
      {
        isInitialized: service.isInitialized,
        hasClient: !!service.client,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
