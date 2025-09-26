import * as logging from "../../utils/logging.ts";
import { MAX_BLOCKS_TO_WAIT, TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";
import { BlockWaitResult } from "./_types.ts";
import { getConnection } from "./connection.ts";

export async function waitForBlocks(
  blocksToWait: number,
): Promise<[BlockWaitResult, null] | [null, SolanaErrors]> {
  if (blocksToWait <= 0) {
    return [
      {
        success: true,
        blocksWaited: 0,
      },
      null,
    ];
  }

  if (blocksToWait > MAX_BLOCKS_TO_WAIT) {
    logging.warn(TAG, "Blocks to wait exceeds maximum limit", {
      blocksToWait,
      maxBlocksToWait: MAX_BLOCKS_TO_WAIT,
    });
    return [
      {
        success: false,
        blocksWaited: 0,
        error: `Cannot wait for more than ${MAX_BLOCKS_TO_WAIT} blocks`,
      },
      null,
    ];
  }

  try {
    const [connection, connectionError] = await getConnection();
    if (connectionError) {
      return [null, connectionError];
    }

    const startBlockHeight = await connection.getBlockHeight();
    const targetBlockHeight = startBlockHeight + blocksToWait;

    logging.info(TAG, "Waiting for blocks", {
      blocksToWait,
      startBlockHeight,
      targetBlockHeight,
      maxBlocksToWait: MAX_BLOCKS_TO_WAIT,
    });

    let currentBlockHeight = startBlockHeight;
    let blocksWaited = 0;
    let iterationCount = 0;
    const maxIterations = MAX_BLOCKS_TO_WAIT * 2;

    while (currentBlockHeight < targetBlockHeight) {
      if (iterationCount >= maxIterations) {
        logging.error(TAG, "Block wait exceeded maximum iterations", {
          iterationCount,
          maxIterations,
          blocksWaited,
          targetBlockHeight,
          currentBlockHeight,
        });
        return [
          {
            success: false,
            blocksWaited,
            error: `Exceeded maximum wait iterations (${maxIterations})`,
          },
          null,
        ];
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      iterationCount++;

      try {
        currentBlockHeight = await connection.getBlockHeight();
        blocksWaited = currentBlockHeight - startBlockHeight;

        logging.debug(TAG, "Block wait progress", {
          currentBlockHeight,
          targetBlockHeight,
          blocksWaited,
          remaining: targetBlockHeight - currentBlockHeight,
          iterationCount,
        });
      } catch (error) {
        logging.warn(TAG, "Failed to get current block height", error);
      }
    }

    logging.info(TAG, "Block wait completed", {
      blocksWaited,
      targetBlockHeight,
      iterationCount,
    });

    return [
      {
        success: true,
        blocksWaited,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to wait for blocks", error);
    return [null, SOLANA_ERRORS.ERROR_RPC_REQUEST_FAILED];
  }
}

export default {
  waitForBlocks,
};
