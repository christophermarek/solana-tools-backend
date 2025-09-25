import { JitoError, JitoErrors } from "./_errors.ts";
import { BundleResult } from "./_types.ts";
import { TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";
import { getJitoService } from "./_index.ts";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types";

export async function sendBundle(
  txBundle: Bundle,
): Promise<[BundleResult, null] | [null, JitoErrors]> {
  logging.info(TAG, "Sending bundle", {
    transactionCount: txBundle.packets.length,
  });

  try {
    const [service, error] = getJitoService();
    if (error) {
      return [null, error];
    }

    const result = await service.client.sendBundle(txBundle);

    if (!result.ok) {
      logging.error(TAG, "Failed to send bundle", result.error);
      return [
        null,
        { type: "JITO_ERROR", message: result.error.message } as JitoError,
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
