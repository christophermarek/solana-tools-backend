import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";

import { BotType } from "../../_types.ts";
import * as logging from "../../../../utils/logging.ts";
import { executeBotFromRegistry, registerBot } from "../../bot-executor.ts";
import { volumeBot1 } from "../../_index.ts";
import {
  VolumeBot1AggregatedResults,
  VolumeBot1Params,
} from "../../bot1/_types.ts";
import { withBotTestCleanup } from "../fixtures.ts";

Deno.test({
  name: "Test volume bot 1 - successful execution with real token",
  async fn() {
    await withBotTestCleanup(async (context) => {
      const { wallet, testToken, initialSolBalance } = context;

      registerBot(volumeBot1);

      const config = {
        botType: BotType.VOLUME_BOT_1,
        botParams: {
          wallet,
          mint: testToken.mint,
          volumeAmountSol: 0.002,
          blocksToWaitBeforeSell: 2,
        } as VolumeBot1Params,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info(
        "volume-bot-1-success-test",
        "Testing successful bot execution",
        {
          wallet: wallet.publicKey.toString(),
          mint: testToken.mint.publicKey.toString(),
          pumpLink: testToken.pumpLink,
          initialSolBalance,
          volumeAmountSol: config.botParams.volumeAmountSol,
        },
      );

      const [result, error] = await executeBotFromRegistry<
        VolumeBot1Params,
        VolumeBot1AggregatedResults
      >(config);

      if (error) {
        logging.error("volume-bot-1-success-test", "Bot execution failed", {
          error,
        });
        const errorMessage = typeof error === "string"
          ? error
          : (error as any).message || JSON.stringify(error);
        throw new Error(`Bot execution failed: ${errorMessage}`);
      }

      assertExists(result, "Result should exist");
      assertExists(
        result.botSpecificResults,
        "Bot specific results should exist",
      );

      logging.info("volume-bot-1-success-test", "Bot execution completed", {
        success: result.success,
        totalCycles: result.totalCycles,
        successfulCycles: result.successfulCycles,
        failedCycles: result.failedCycles,
        executionTimeMs: result.executionTimeMs,
        botSpecificResults: result.botSpecificResults,
      });

      assertEquals(
        result.success,
        true,
        "Bot execution should be successful",
      );
      assertEquals(
        result.totalCycles,
        1,
        "Should have executed 1 cycle",
      );
      assertEquals(
        result.successfulCycles,
        1,
        "Should have 1 successful cycle",
      );
      assertEquals(
        result.failedCycles,
        0,
        "Should have 0 failed cycles",
      );
      assertEquals(
        typeof result.botSpecificResults.totalBuyOperations,
        "number",
        "Total buy operations should be a number",
      );
      assertEquals(
        typeof result.botSpecificResults.totalSellOperations,
        "number",
        "Total sell operations should be a number",
      );
      assertEquals(
        typeof result.botSpecificResults.totalVolumeSol,
        "number",
        "Total volume SOL should be a number",
      );

      logging.info("volume-bot-1-success-test", "All assertions passed", {
        totalBuyOperations: result.botSpecificResults.totalBuyOperations,
        totalSellOperations: result.botSpecificResults.totalSellOperations,
        totalVolumeSol: result.botSpecificResults.totalVolumeSol,
      });
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test volume bot 1 - multiple cycles with cleanup",
  async fn() {
    await withBotTestCleanup(async (context) => {
      const { wallet, testToken } = context;

      registerBot(volumeBot1);

      const config = {
        botType: BotType.VOLUME_BOT_1,
        botParams: {
          wallet,
          mint: testToken.mint,
          volumeAmountSol: 0.001,
          blocksToWaitBeforeSell: 1,
        } as VolumeBot1Params,
        executionConfig: {
          repeatCount: 3,
          intervalSeconds: 0,
        },
      };

      logging.info("volume-bot-1-multi-test", "Testing multiple cycles", {
        wallet: wallet.publicKey.toString(),
        mint: testToken.mint.publicKey.toString(),
        repeatCount: config.executionConfig.repeatCount,
      });

      const [result, error] = await executeBotFromRegistry<
        VolumeBot1Params,
        VolumeBot1AggregatedResults
      >(config);

      if (error) {
        logging.error(
          "volume-bot-1-multi-test",
          "Multi-cycle execution failed",
          {
            error,
          },
        );
        const errorMessage = typeof error === "string"
          ? error
          : (error as any).message || JSON.stringify(error);
        throw new Error(`Multi-cycle execution failed: ${errorMessage}`);
      }

      assertExists(result, "Result should exist");
      assertExists(
        result.botSpecificResults,
        "Bot specific results should exist",
      );

      logging.info(
        "volume-bot-1-multi-test",
        "Multi-cycle execution completed",
        {
          success: result.success,
          totalCycles: result.totalCycles,
          successfulCycles: result.successfulCycles,
          failedCycles: result.failedCycles,
          botSpecificResults: result.botSpecificResults,
        },
      );

      assertEquals(
        result.totalCycles,
        3,
        "Should have executed 3 cycles",
      );
      assertEquals(
        result.successfulCycles + result.failedCycles,
        3,
        "Should have 3 total cycles (successful + failed)",
      );
      assertEquals(
        result.botSpecificResults.totalBuyOperations,
        result.successfulCycles,
        "Total buy operations should equal successful cycles",
      );
      assertEquals(
        result.botSpecificResults.totalSellOperations,
        result.successfulCycles,
        "Total sell operations should equal successful cycles",
      );
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
