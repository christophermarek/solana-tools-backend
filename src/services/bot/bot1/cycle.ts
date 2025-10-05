import * as logging from "../../../utils/logging.ts";
import { TAG } from "../_constants.ts";
import { BotCycleExecutor, BotCyclePreparator } from "../_types.ts";
import {
  VolumeBot1CycleParams,
  VolumeBot1CycleResult,
  VolumeBot1Params,
} from "./_types.ts";
import { createBotError } from "../_utils.ts";
import * as solanaService from "../../solana/_index.ts";
import * as pumpFunService from "../../pump-fun/_index.ts";

export const prepareCycleParams: BotCyclePreparator<
  VolumeBot1Params,
  VolumeBot1CycleParams
> = (params, _cycleIndex) => ({
  wallet: params.wallet,
  mint: params.mint,
  volumeAmountSol: params.volumeAmountSol,
  blocksToWaitBeforeSell: params.blocksToWaitBeforeSell,
});

export const executeCycle: BotCycleExecutor<
  VolumeBot1CycleParams,
  VolumeBot1CycleResult
> = async (params) => {
  const {
    wallet,
    mint,
    volumeAmountSol,
    blocksToWaitBeforeSell,
    botExecutionId,
  } = params;

  logging.info(TAG, "Volume bot 1 cycle started", {
    wallet: wallet.publicKey.toString(),
    mint: mint.publicKey.toString(),
    volumeAmountSol,
    blocksToWaitBeforeSell,
  });

  const result: VolumeBot1CycleResult = {
    success: false,
    buySuccess: false,
    sellSuccess: false,
    volumeSol: volumeAmountSol,
    metrics: {
      volumeSol: volumeAmountSol,
      buySuccess: false,
      sellSuccess: false,
    },
  };

  try {
    logging.info(TAG, "Executing buy operation", {
      volumeAmountSol,
    });

    const [buyResult, buyError] = await pumpFunService.buy(
      wallet,
      mint,
      volumeAmountSol,
      undefined,
      botExecutionId,
    );

    if (buyError) {
      const errorMsg = createBotError(
        "Buy operation failed",
        new Error(
          typeof buyError === "string" ? buyError : JSON.stringify(buyError),
        ),
      );
      result.buyError = errorMsg;
      return [result, null];
    }

    if (!buyResult) {
      const errorMsg = createBotError(
        "Buy operation returned no result",
        new Error("No result from buy operation"),
      );
      result.buyError = errorMsg;
      return [result, null];
    }

    result.buySuccess = true;
    result.buyTransactionSignature = buyResult.signature;

    logging.info(TAG, "Buy operation completed", {
      transactionSignature: result.buyTransactionSignature,
      solscanUrl: `https://solscan.io/tx/${result.buyTransactionSignature}`,
    });

    if (blocksToWaitBeforeSell > 0) {
      logging.info(TAG, "Waiting for blocks before sell", {
        blocksToWait: blocksToWaitBeforeSell,
      });

      const [blockWaitResult, blockWaitError] = await solanaService
        .waitForBlocks(blocksToWaitBeforeSell);

      if (blockWaitError) {
        const errorMsg = createBotError(
          "Failed to wait for blocks",
          new Error(blockWaitError),
        );
        result.sellError = errorMsg;
        return [result, null];
      }

      logging.info(TAG, "Block wait completed", {
        blocksWaited: blockWaitResult.blocksWaited,
      });
    }

    logging.info(TAG, "Executing sell operation", {
      volumeAmountSol,
    });

    const [sellResult, sellError] = await pumpFunService.sell(wallet, mint, {
      sellAmountSol: volumeAmountSol,
    }, botExecutionId);

    if (sellError) {
      const errorMsg = createBotError(
        "Sell operation failed",
        new Error(
          typeof sellError === "string" ? sellError : JSON.stringify(sellError),
        ),
      );
      result.sellError = errorMsg;
      return [result, null];
    }

    if (!sellResult) {
      const errorMsg = createBotError(
        "Sell operation returned no result",
        new Error("No result from sell operation"),
      );
      result.sellError = errorMsg;
      return [result, null];
    }

    result.sellSuccess = true;
    result.sellTransactionSignature = sellResult.signature;

    logging.info(TAG, "Sell operation completed", {
      transactionSignature: result.sellTransactionSignature,
      solscanUrl: `https://solscan.io/tx/${result.sellTransactionSignature}`,
    });

    result.success = result.buySuccess && result.sellSuccess;
    result.metrics = {
      volumeSol: result.volumeSol,
      buySuccess: result.buySuccess,
      sellSuccess: result.sellSuccess,
    };

    if (result.buyTransactionSignature) {
      result.transactionSignatures = [result.buyTransactionSignature];
    }
    if (result.sellTransactionSignature) {
      result.transactionSignatures = [
        ...(result.transactionSignatures || []),
        result.sellTransactionSignature,
      ];
    }

    logging.info(TAG, "Volume bot 1 cycle completed", {
      success: result.success,
      buySuccess: result.buySuccess,
      sellSuccess: result.sellSuccess,
      volumeSol: result.volumeSol,
    });

    return [result, null];
  } catch (error) {
    const errorMessage = createBotError(
      "Volume bot 1 cycle failed",
      error as Error,
    );
    result.buyError = errorMessage;
    return [result, null];
  }
};
