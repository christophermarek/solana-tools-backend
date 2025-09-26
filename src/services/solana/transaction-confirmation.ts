import { Connection, TransactionSignature } from "@solana/web3.js";
import * as logging from "../../utils/logging.ts";
import { TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";

export interface TransactionConfirmationOptions {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  commitment?: "processed" | "confirmed" | "finalized";
}

export interface TransactionConfirmationResult {
  success: boolean;
  signature: string;
  error?: string;
  confirmedAt?: number;
}

const DEFAULT_OPTIONS: Required<TransactionConfirmationOptions> = {
  timeoutMs: 60000,
  retryCount: 3,
  retryDelayMs: 2000,
  commitment: "confirmed",
};

export async function confirmTransaction(
  connection: Connection,
  signature: TransactionSignature,
  options: TransactionConfirmationOptions = {},
): Promise<[TransactionConfirmationResult, null] | [null, SolanaErrors]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  logging.info(TAG, "Starting transaction confirmation", {
    signature,
    timeoutMs: opts.timeoutMs,
    retryCount: opts.retryCount,
    commitment: opts.commitment,
  });

  for (let attempt = 1; attempt <= opts.retryCount; attempt++) {
    try {
      logging.info(
        TAG,
        `Transaction confirmation attempt ${attempt}/${opts.retryCount}`,
        {
          signature,
          attempt,
        },
      );

      const result = await Promise.race([
        connection.confirmTransaction(signature, opts.commitment),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Transaction confirmation timeout after ${opts.timeoutMs}ms`,
              ),
            );
          }, opts.timeoutMs);
        }),
      ]);

      if (result.value?.err) {
        const errorMsg = `Transaction failed: ${
          JSON.stringify(result.value.err)
        }`;
        logging.error(TAG, "Transaction confirmation failed", {
          signature,
          error: result.value.err,
          attempt,
        });

        if (attempt === opts.retryCount) {
          return [null, {
            type: "SDK_ERROR",
            message: errorMsg,
          } as unknown as SolanaErrors];
        }

        await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs));
        continue;
      }

      logging.info(TAG, "Transaction confirmed successfully", {
        signature,
        attempt,
        commitment: opts.commitment,
      });

      return [{
        success: true,
        signature,
        confirmedAt: Date.now(),
      }, null];
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      logging.warn(TAG, `Transaction confirmation attempt ${attempt} failed`, {
        signature,
        attempt,
        error: errorMessage,
      });

      if (attempt === opts.retryCount) {
        return [null, {
          type: "SDK_ERROR",
          message:
            `Transaction confirmation failed after ${opts.retryCount} attempts: ${errorMessage}`,
        } as unknown as SolanaErrors];
      }

      await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs));
    }
  }

  return [null, SOLANA_ERRORS.ERROR_CONNECTION_FAILED];
}

export async function checkTransactionStatus(
  connection: Connection,
  signature: TransactionSignature,
): Promise<[boolean, null] | [null, SolanaErrors]> {
  try {
    const status = await connection.getSignatureStatus(signature);

    if (status.value?.err) {
      return [false, null];
    }

    return [
      status.value?.confirmationStatus === "confirmed" ||
      status.value?.confirmationStatus === "finalized",
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to check transaction status", error);
    return [null, {
      type: "SDK_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    } as unknown as SolanaErrors];
  }
}
