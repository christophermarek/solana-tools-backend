import {
  Blockhash,
  Commitment,
  Keypair,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as logging from "../../utils/logging.ts";
import * as connectionService from "./connection.ts";
import * as rateLimiter from "./rate-limiter.ts";

/**
 * Get the latest blockhash
 */
export async function getLatestBlockhash(
  requestId = "system",
): Promise<Blockhash> {
  try {
    const connection = await connectionService.getConnection();
    const startTime = performance.now();

    // Apply rate limiting
    await rateLimiter.waitForRateLimit("getLatestBlockhash", requestId);

    const { blockhash } = await connection.getLatestBlockhash();
    const endTime = performance.now();

    logging.debug(requestId, "Retrieved latest blockhash", {
      blockhash,
      responseTimeMs: Math.round(endTime - startTime),
    });

    return blockhash;
  } catch (error) {
    logging.error(requestId, "Failed to get latest blockhash", error);
    throw new Error(
      `Failed to get latest blockhash: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Create and sign a versioned transaction
 */
export async function createAndSignVersionedTx(
  instructions: TransactionInstruction[],
  signers: Keypair[],
  requestId = "system",
): Promise<VersionedTransaction> {
  try {
    const blockhash = await getLatestBlockhash(requestId);

    // Use the first signer as the payer
    if (signers.length === 0) {
      throw new Error("At least one signer is required");
    }

    const payer = signers[0];

    logging.debug(requestId, "Creating versioned transaction", {
      instructionCount: instructions.length,
      signerCount: signers.length,
      payerPublicKey: payer.publicKey.toString(),
    });

    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Add all signers
    transaction.sign(signers);

    logging.debug(requestId, "Created and signed versioned transaction", {
      signature: transaction.signatures[0]?.toString(),
    });

    return transaction;
  } catch (error) {
    logging.error(requestId, "Failed to create versioned transaction", error);
    throw new Error(
      `Failed to create versioned transaction: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Wait for transaction confirmation with exponential backoff retry
 */
export async function confirmTransaction(
  signature: string,
  requestId = "system",
  maxRetries = 5,
  initialDelayMs = 2000,
): Promise<{ confirmed: boolean; slot?: number; error?: string }> {
  const connection = await connectionService.getConnection();
  let currentDelay = initialDelayMs;
  let retries = 0;

  logging.debug(requestId, "Waiting for transaction confirmation", {
    signature,
    maxRetries,
    initialDelayMs,
  });

  while (retries <= maxRetries) {
    try {
      await rateLimiter.waitForRateLimit("confirmTransaction", requestId);

      const startTime = performance.now();
      const confirmation = await connection.confirmTransaction(
        signature,
        "confirmed" as Commitment,
      );
      const endTime = performance.now();

      if (confirmation.value.err) {
        const error = typeof confirmation.value.err === "string"
          ? confirmation.value.err
          : JSON.stringify(confirmation.value.err);

        logging.warn(requestId, `Transaction failed with error: ${error}`, {
          signature,
          slot: confirmation.context.slot,
          responseTimeMs: Math.round(endTime - startTime),
        });

        return { confirmed: false, error };
      }

      logging.info(requestId, "Transaction confirmed successfully", {
        signature,
        slot: confirmation.context.slot,
        responseTimeMs: Math.round(endTime - startTime),
      });

      return { confirmed: true, slot: confirmation.context.slot };
    } catch (error) {
      if (retries >= maxRetries) {
        logging.error(
          requestId,
          `Failed to confirm transaction after ${maxRetries} attempts`,
          error,
        );
        return {
          confirmed: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      logging.warn(requestId, `Retrying confirmation for transaction`, {
        signature,
        attempt: retries + 1,
        maxRetries,
      });

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * currentDelay;
      await new Promise((resolve) =>
        setTimeout(resolve, currentDelay + jitter)
      );
      currentDelay *= 2;
      retries++;
    }
  }

  return { confirmed: false, error: "Maximum retries exceeded" };
}

/**
 * Send a transaction with retry logic
 */
export async function sendTransactionWithRetry(
  transaction: VersionedTransaction | Transaction,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    skipPreflight?: boolean;
  } = {},
  requestId = "system",
): Promise<{
  signature: string;
  confirmed: boolean;
  error?: string;
}> {
  const connection = await connectionService.getConnection();
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    skipPreflight = false,
  } = options;

  let currentDelay = initialDelayMs;
  let retries = 0;
  let lastError: string | undefined;

  logging.debug(requestId, "Sending transaction with retry", {
    maxRetries,
    initialDelayMs,
    skipPreflight,
  });

  while (retries <= maxRetries) {
    try {
      await rateLimiter.waitForRateLimit("sendTransaction", requestId);

      // Send transaction
      const txBuffer = transaction instanceof VersionedTransaction
        ? transaction.serialize()
        : transaction.serialize();

      const startTime = performance.now();
      const signature = await connection.sendRawTransaction(txBuffer, {
        skipPreflight,
        preflightCommitment: "confirmed",
      });
      const endTime = performance.now();

      logging.info(requestId, "Transaction sent successfully", {
        signature,
        responseTimeMs: Math.round(endTime - startTime),
      });

      // Wait for confirmation
      const confirmation = await confirmTransaction(signature, requestId);

      if (confirmation.confirmed) {
        return { signature, confirmed: true };
      } else {
        lastError = confirmation.error;

        // If transaction error is not retryable, break immediately
        if (
          lastError && (
            lastError.includes("Blockhash not found") ||
            lastError.includes("Transaction simulation failed")
          )
        ) {
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      lastError = errorMessage;

      // Identify non-retryable errors
      if (
        errorMessage.includes("Transaction simulation failed") ||
        errorMessage.includes("Blockhash not found")
      ) {
        logging.error(requestId, "Non-retryable error encountered", {
          error: errorMessage,
        });
        break;
      }
    }

    if (retries >= maxRetries) {
      logging.error(
        requestId,
        `Failed to send transaction after ${maxRetries} attempts`,
        new Error(lastError || "Unknown error"),
      );
      break;
    }

    logging.warn(requestId, "Retrying transaction", {
      attempt: retries + 1,
      maxRetries,
    });

    // Exponential backoff with jitter
    const jitter = Math.random() * 0.3 * currentDelay;
    await new Promise((resolve) => setTimeout(resolve, currentDelay + jitter));
    currentDelay *= 2;
    retries++;

    // Get a fresh blockhash if we're retrying
    if (transaction instanceof Transaction) {
      transaction.recentBlockhash = await getLatestBlockhash(requestId);
    }
  }

  return {
    signature: "",
    confirmed: false,
    error: lastError || "Maximum retries exceeded",
  };
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  signature: string,
  requestId = "system",
): Promise<{
  status:
    | "confirmed"
    | "finalized"
    | "processed"
    | "pending"
    | "failed"
    | "unknown";
  confirmations?: number;
  slot?: number;
  error?: string;
}> {
  try {
    await rateLimiter.waitForRateLimit("getSignatureStatus", requestId);

    const connection = await connectionService.getConnection();
    const startTime = performance.now();
    const response = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    const endTime = performance.now();

    if (!response || !response.value) {
      logging.warn(requestId, "Transaction status not found", { signature });
      return { status: "unknown" };
    }

    const result = {
      status: response.value.confirmationStatus || "unknown",
      confirmations: response.value.confirmations ?? undefined,
      slot: response.value.slot,
      error: response.value.err
        ? (typeof response.value.err === "string"
          ? response.value.err
          : JSON.stringify(response.value.err))
        : undefined,
    } as const;

    logging.debug(requestId, "Retrieved transaction status", {
      signature,
      ...result,
      responseTimeMs: Math.round(endTime - startTime),
    });

    return result;
  } catch (error) {
    logging.error(requestId, "Failed to get transaction status", error);
    return {
      status: "unknown",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  getLatestBlockhash,
  createAndSignVersionedTx,
  confirmTransaction,
  sendTransactionWithRetry,
  getTransactionStatus,
};
