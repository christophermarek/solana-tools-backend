import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import * as waitForBlocks from "../wait-for-blocks.ts";
import * as logging from "../../../utils/logging.ts";
import { loadEnv } from "../../../utils/env.ts";

Deno.test({
  name: "Test waitForBlocks success - wait for specified blocks",
  async fn() {
    await loadEnv(".env.devnet");
    const blocksToWait = 1;

    const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

    if (error) {
      throw new Error(`Failed to wait for blocks: ${error}`);
    }

    assertExists(result, "Result should exist");
    assertExists(result.success, "Success should exist");
    assertExists(result.blocksWaited, "Blocks waited should exist");
    assertEquals(result.success, true, "Wait should be successful");
    assertEquals(
      typeof result.blocksWaited,
      "number",
      "Blocks waited should be number",
    );
    assertEquals(
      result.blocksWaited >= 0,
      true,
      "Blocks waited should be non-negative",
    );

    logging.info("wait-for-blocks-test", "Successfully waited for blocks", {
      blocksToWait,
      blocksWaited: result.blocksWaited,
      success: result.success,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test waitForBlocks failure - invalid connection",
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

      const blocksToWait = 1;

      const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

      if (error) {
        assertEquals(result, null, "Result should be null on failure");
        assertExists(error, "Error should exist");
        assertEquals(
          error,
          "RPC request failed",
          "Should return RPC request failed error",
        );

        logging.info(
          "wait-for-blocks-test",
          "Wait for blocks failed as expected",
          {
            error,
            blocksToWait,
          },
        );
      } else {
        logging.info(
          "wait-for-blocks-test",
          "Wait for blocks succeeded unexpectedly",
          {
            result,
            blocksToWait,
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
  name: "Test waitForBlocks success - zero blocks to wait",
  async fn() {
    await loadEnv(".env.devnet");
    const blocksToWait = 0;

    const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

    if (error) {
      throw new Error(`Failed to wait for blocks: ${error}`);
    }

    assertExists(result, "Result should exist");
    assertExists(result.success, "Success should exist");
    assertExists(result.blocksWaited, "Blocks waited should exist");
    assertEquals(result.success, true, "Wait should be successful");
    assertEquals(result.blocksWaited, 0, "Blocks waited should be 0");

    logging.info(
      "wait-for-blocks-test",
      "Successfully handled zero blocks wait",
      {
        blocksToWait,
        blocksWaited: result.blocksWaited,
        success: result.success,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test waitForBlocks success - negative blocks to wait",
  async fn() {
    await loadEnv(".env.devnet");
    const blocksToWait = -1;

    const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

    if (error) {
      throw new Error(`Failed to wait for blocks: ${error}`);
    }

    assertExists(result, "Result should exist");
    assertExists(result.success, "Success should exist");
    assertExists(result.blocksWaited, "Blocks waited should exist");
    assertEquals(result.success, true, "Wait should be successful");
    assertEquals(
      result.blocksWaited,
      0,
      "Blocks waited should be 0 for negative input",
    );

    logging.info(
      "wait-for-blocks-test",
      "Successfully handled negative blocks wait",
      {
        blocksToWait,
        blocksWaited: result.blocksWaited,
        success: result.success,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test waitForBlocks success - multiple blocks to wait",
  async fn() {
    await loadEnv(".env.devnet");
    const blocksToWait = 2;

    const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

    if (error) {
      throw new Error(`Failed to wait for blocks: ${error}`);
    }

    assertExists(result, "Result should exist");
    assertExists(result.success, "Success should exist");
    assertExists(result.blocksWaited, "Blocks waited should exist");
    assertEquals(result.success, true, "Wait should be successful");
    assertEquals(
      typeof result.blocksWaited,
      "number",
      "Blocks waited should be number",
    );
    assertEquals(
      result.blocksWaited >= 0,
      true,
      "Blocks waited should be non-negative",
    );

    logging.info(
      "wait-for-blocks-test",
      "Successfully waited for multiple blocks",
      {
        blocksToWait,
        blocksWaited: result.blocksWaited,
        success: result.success,
      },
    );
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test waitForBlocks failure - connection timeout",
  async fn() {
    await loadEnv(".env.devnet");
    const originalEnv = Deno.env.get("RPC_URL");
    const originalHeliusEnv = Deno.env.get("HELIUS_RPC_URL");

    try {
      Deno.env.set("RPC_URL", "https://httpstat.us/200?sleep=10000");
      Deno.env.set("HELIUS_RPC_URL", "");

      const blocksToWait = 1;

      const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

      if (error) {
        assertEquals(result, null, "Result should be null on failure");
        assertExists(error, "Error should exist");
        assertEquals(
          error,
          "RPC request failed",
          "Should return RPC request failed error",
        );

        logging.info(
          "wait-for-blocks-test",
          "Wait for blocks timed out as expected",
          {
            error,
            blocksToWait,
          },
        );
      } else {
        logging.info(
          "wait-for-blocks-test",
          "Wait for blocks succeeded despite timeout URL",
          {
            result,
            blocksToWait,
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
  name: "Test waitForBlocks failure - exceeds maximum blocks limit",
  async fn() {
    await loadEnv(".env.devnet");
    const blocksToWait = 150;

    const [result, error] = await waitForBlocks.waitForBlocks(blocksToWait);

    if (error) {
      assertEquals(result, null, "Result should be null on failure");
      assertExists(error, "Error should exist");
      assertEquals(
        error,
        "RPC request failed",
        "Should return RPC request failed error",
      );

      logging.info(
        "wait-for-blocks-test",
        "Wait for blocks failed as expected",
        {
          error,
          blocksToWait,
        },
      );
    } else {
      assertExists(result, "Result should exist");
      assertEquals(result.success, false, "Should fail due to exceeding limit");
      assertExists(result.error, "Error message should exist");
      assertEquals(
        result.error?.includes("Cannot wait for more than 100 blocks"),
        true,
        "Should return appropriate error message",
      );

      logging.info(
        "wait-for-blocks-test",
        "Wait for blocks failed due to limit as expected",
        {
          result,
          blocksToWait,
        },
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
