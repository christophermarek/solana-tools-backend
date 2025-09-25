import { JitoError, JitoErrors } from "./_errors.ts";
import { BundleResult } from "./_types.ts";
import { TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";
import { getJitoService } from "./_index.ts";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";

export async function sendBundle(
  txBundle: Bundle,
  timeoutMs: number = 30000,
): Promise<[BundleResult, null] | [null, JitoErrors]> {
  logging.info(TAG, "Sending bundle", {
    transactionCount: txBundle.packets.length,
    timeoutMs,
  });

  try {
    const [service, error] = getJitoService();
    if (error) {
      return [null, error];
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Bundle send timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const bundlePromise = service.client.sendBundle(txBundle);
    const result = await Promise.race([bundlePromise, timeoutPromise]);

    if (!result.ok) {
      logging.error(TAG, "Failed to send bundle", {
        error: result.error,
        errorCode: result.error.code,
        errorDetails: result.error.details,
      });
      return [
        null,
        {
          type: "JITO_ERROR",
          message:
            `Jito sendBundle failed: ${result.error.details} (code: ${result.error.code})`,
        } as JitoError,
      ];
    }

    logging.info(TAG, "Bundle sent successfully", { bundleId: result.value });

    return [
      {
        bundleId: result.value,
        success: true,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to send bundle", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while sending bundle";
    return [null, { type: "JITO_ERROR", message: errorMessage } as JitoError];
  }
}
