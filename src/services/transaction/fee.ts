import { PublicKey, TransactionMessage } from "@solana/web3.js";
import * as solanaService from "../solana/index.ts";
import * as rateLimiter from "../solana/rate-limiter.ts";
import * as logging from "../../utils/logging.ts";
import { FeeEstimate } from "./types.ts";

/**
 * Estimate transaction fee for a SOL transfer
 */
export async function estimateSolTransferFee(
  fromPublicKey: PublicKey,
  toPublicKey: PublicKey,
  amountLamports: number | bigint,
  requestId = "system",
): Promise<FeeEstimate> {
  try {
    // Wait for rate limit
    await rateLimiter.waitForRateLimit("estimateFee", requestId);

    // Get connection and latest blockhash
    const connection = await solanaService.getConnection();
    const blockhash = await solanaService.getLatestBlockhash(requestId);

    // Create a SOL transfer instruction
    const transferInstruction = solanaService.buildSolTransferIx(
      fromPublicKey,
      toPublicKey,
      amountLamports,
    );

    // Create a transaction message
    const messageV0 = new TransactionMessage({
      payerKey: fromPublicKey,
      recentBlockhash: blockhash,
      instructions: [transferInstruction],
    }).compileToV0Message();

    logging.debug(requestId, "Estimating fee for transaction", {
      fromPublicKey: fromPublicKey.toString(),
      toPublicKey: toPublicKey.toString(),
      amountLamports: amountLamports.toString(),
    });

    // Get fee estimate from the RPC
    const feeEstimate = await connection.getFeeForMessage(messageV0);

    if (!feeEstimate || feeEstimate.value === null) {
      throw new Error("Failed to estimate transaction fee");
    }

    // Default priority fee - in production this might be dynamically adjusted
    // based on network congestion
    const priorityFee = 5000; // 5000 lamports (0.000005 SOL)

    const result: FeeEstimate = {
      baseFee: feeEstimate.value,
      priorityFee,
      totalFee: feeEstimate.value + priorityFee,
    };

    logging.debug(requestId, "Fee estimation result", result);

    return result;
  } catch (error) {
    logging.error(requestId, "Failed to estimate transaction fee", error);

    // Return a default estimate if unable to query RPC
    // In production, you might want to handle this differently
    return {
      baseFee: 5000,
      priorityFee: 5000,
      totalFee: 10000,
    };
  }
}

/**
 * Estimate transaction fee for a WSOL transfer
 */
export async function estimateWsolTransferFee(
  fromPublicKey: PublicKey,
  toPublicKey: PublicKey,
  amountLamports: number | bigint,
  requestId = "system",
): Promise<FeeEstimate> {
  try {
    // Wait for rate limit
    await rateLimiter.waitForRateLimit("estimateFee", requestId);

    // Get connection and latest blockhash
    const connection = await solanaService.getConnection();
    const blockhash = await solanaService.getLatestBlockhash(requestId);

    // Get WSOL transfer instructions (this may include ATA creation)
    const transferInstructions = await solanaService.buildWsolTransferIxs(
      fromPublicKey,
      toPublicKey,
      amountLamports,
      requestId,
    );

    // Create a transaction message
    const messageV0 = new TransactionMessage({
      payerKey: fromPublicKey,
      recentBlockhash: blockhash,
      instructions: transferInstructions,
    }).compileToV0Message();

    logging.debug(requestId, "Estimating fee for WSOL transaction", {
      fromPublicKey: fromPublicKey.toString(),
      toPublicKey: toPublicKey.toString(),
      amountLamports: amountLamports.toString(),
      instructionCount: transferInstructions.length,
    });

    // Get fee estimate from the RPC
    const feeEstimate = await connection.getFeeForMessage(messageV0);

    if (!feeEstimate || feeEstimate.value === null) {
      throw new Error("Failed to estimate WSOL transaction fee");
    }

    // Default priority fee - in production this might be dynamically adjusted
    // based on network congestion
    const priorityFee = 10000; // 10000 lamports (0.00001 SOL) - higher for WSOL due to complexity

    const result: FeeEstimate = {
      baseFee: feeEstimate.value,
      priorityFee,
      totalFee: feeEstimate.value + priorityFee,
    };

    logging.debug(requestId, "WSOL fee estimation result", result);

    return result;
  } catch (error) {
    logging.error(requestId, "Failed to estimate WSOL transaction fee", error);

    // Return a default estimate if unable to query RPC
    // In production, you might want to handle this differently
    return {
      baseFee: 10000,
      priorityFee: 10000,
      totalFee: 20000,
    };
  }
}
