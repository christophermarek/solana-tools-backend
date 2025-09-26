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
  name: "Test volume bot 1 - usage example with proper cleanup",
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
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("volume-bot-1-test", "Testing registry execution", {
        wallet: wallet.publicKey.toString(),
        mint: testToken.mint.publicKey.toString(),
        pumpLink: testToken.pumpLink,
      });

      const [result1, error1] = await executeBotFromRegistry<
        VolumeBot1Params,
        VolumeBot1AggregatedResults
      >(config);

      if (error1) {
        logging.info(
          "volume-bot-1-test",
          "Registry execution failed as expected",
          {
            error: error1,
          },
        );
        assertExists(error1, "Error should exist");
      } else {
        assertExists(result1, "Result should exist");
        assertExists(
          result1.botSpecificResults,
          "Bot specific results should exist",
        );
        assertEquals(
          typeof result1.botSpecificResults.totalBuyOperations,
          "number",
          "Total buy operations should be a number",
        );
      }
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
