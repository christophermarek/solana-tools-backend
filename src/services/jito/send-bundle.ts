import { JitoError, JitoErrors } from "./_errors.ts";
import { BundleResult } from "./_types.ts";
import { TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";
import { getJitoService } from "./_index.ts";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "node:buffer";

export async function sendBundle(
  transactions: VersionedTransaction[],
  timeoutMs: number = 30000,
): Promise<[BundleResult, null] | [null, JitoErrors]> {
  logging.info(TAG, "Sending bundle", {
    transactionCount: transactions.length,
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

    const base64Transactions = transactions.map((tx) => {
      const serialized = tx.serialize();
      return Buffer.from(serialized).toString("base64");
    });

    const bundleParams: [string[], { encoding: "base64" }] = [
      base64Transactions,
      { encoding: "base64" },
    ];

    const bundlePromise = service.client.sendBundle(bundleParams);
    const result = await Promise.race([bundlePromise, timeoutPromise]);

    if (result.error) {
      logging.error(TAG, "Failed to send bundle", {
        error: result.error,
      });
      return [
        null,
        {
          type: "JITO_ERROR",
          message: `Jito sendBundle failed: ${result.error}`,
        } as JitoError,
      ];
    }

    // Extract bundle ID from the result
    const bundleId = typeof result === "string"
      ? result
      : (result as { result?: string }).result || result;
    logging.info(TAG, "Bundle sent successfully", { bundleId });

    return [
      {
        bundleId: String(bundleId),
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
