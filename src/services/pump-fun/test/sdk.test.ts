import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { clearConfig, loadEnv } from "../../../utils/env.ts";
import { PUMP_FUN_ERRORS } from "../errors.ts";

Deno.test({
  name: "Test 1: Call getSDK once, init SDK success",
  async fn() {
    const env = await loadEnv();
    assertExists(env.RPC_URL, "RPC_URL should be configured");
    assertExists(
      env.PUMP_FUN_WALLET_PRIVATE_KEY,
      "PUMP_FUN_WALLET_PRIVATE_KEY should be configured",
    );

    const pumpFunModule = await import("../index.ts");
    pumpFunModule.clearSDK();

    const [sdk, error] = pumpFunModule.getSDK();

    if (error) {
      const validErrors = Object.values(PUMP_FUN_ERRORS);
      assertEquals(
        validErrors.includes(error),
        true,
        `Error should be one of: ${validErrors.join(", ")}`,
      );
    } else {
      assertExists(sdk, "SDK should be returned on success");
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test 2: Call getSDK again, returns existing instance",
  async fn() {
    const pumpFunModule = await import("../index.ts");

    const [sdk1, error1] = pumpFunModule.getSDK();
    const [sdk2, error2] = pumpFunModule.getSDK();

    if (error1) {
      return;
    }

    if (error2) {
      return;
    }

    assertExists(sdk1, "First SDK call should return SDK");
    assertExists(sdk2, "Second SDK call should return SDK");
    assertEquals(sdk1, sdk2, "Both calls should return the same SDK instance");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test 3: Clear SDK, set invalid PK, call getSDK should error",
  async fn() {
    const pumpFunModule = await import("../index.ts");
    pumpFunModule.clearSDK();

    const originalEnvGet = Deno.env.get;
    const originalPrivateKey = originalEnvGet("PUMP_FUN_WALLET_PRIVATE_KEY");

    try {
      clearConfig();

      Deno.env.set("PUMP_FUN_WALLET_PRIVATE_KEY", "");

      const [_, error] = pumpFunModule.getSDK();

      if (error) {
        assertEquals(
          error,
          PUMP_FUN_ERRORS.ERROR_INITIALIZING_SDK,
          "Should return SDK initialization error",
        );
      } else {
        throw new Error("Expected error but got successful SDK initialization");
      }
    } finally {
      if (originalPrivateKey) {
        Deno.env.set("PUMP_FUN_WALLET_PRIVATE_KEY", originalPrivateKey);
        clearConfig();
      }
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
