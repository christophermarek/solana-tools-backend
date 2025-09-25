import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import {
  clearJitoService,
  getJitoService,
  isJitoServiceInitialized,
} from "../_index.ts";
import * as logging from "../../../utils/logging.ts";

Deno.test({
  name: "Test Jito service initialization",
  async fn() {
    const env = await loadEnv();
    assertExists(env.RPC_URL, "RPC_URL should be configured");

    clearJitoService();

    const [service, error] = getJitoService();

    if (error) {
      throw new Error(
        `Jito service initialization failed with error: ${error}`,
      );
    }

    assertExists(service, "Jito service should be returned on success");
    assertExists(service.client, "Jito client should exist");
    assertExists(
      service.isInitialized,
      "Service should be marked as initialized",
    );

    const isInitialized = isJitoServiceInitialized();
    assertExists(isInitialized, "Service should be marked as initialized");

    logging.info("jito-init-test", "Jito service initialized successfully", {
      isInitialized: service.isInitialized,
      hasClient: !!service.client,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
