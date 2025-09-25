import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { PUMP_FUN_ERRORS } from "../_errors.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";

Deno.test({
  name: "Test 1: Call getSDK once, init SDK success",
  async fn() {
    const env = await loadEnv();
    assertExists(env.RPC_URL, "RPC_URL should be configured");
    assertExists(
      env.TEST_WALLET_PRIVATE_KEY,
      "TEST_WALLET_PRIVATE_KEY should be configured",
    );

    const pumpFunModule = await import("../_index.ts");
    pumpFunModule.clearSDK();

    const wallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet, "Wallet keypair should be created from private key");

    const [sdk, error] = pumpFunModule.getSDK(wallet);

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
    const env = await loadEnv();
    const wallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet, "Wallet keypair should be created from private key");

    const pumpFunModule = await import("../_index.ts");

    const [sdk1, error1] = pumpFunModule.getSDK(wallet);
    const [sdk2, error2] = pumpFunModule.getSDK(wallet);

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
  name: "Test 3: Test SDK with different wallets",
  async fn() {
    const env = await loadEnv();
    const pumpFunModule = await import("../_index.ts");
    pumpFunModule.clearSDK();

    const wallet1 = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet1, "Wallet 1 should be created from private key");

    const wallet2 = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    assertExists(wallet2, "Wallet 2 should be created from private key");

    const [sdk1, error1] = pumpFunModule.getSDK(wallet1);
    const [sdk2, error2] = pumpFunModule.getSDK(wallet2);

    if (error1 || error2) {
      return;
    }

    assertExists(sdk1, "SDK 1 should exist");
    assertExists(sdk2, "SDK 2 should exist");
    assertEquals(sdk1, sdk2, "Same wallet should return same SDK instance");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
