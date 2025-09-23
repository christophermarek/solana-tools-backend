import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as logging from "../../utils/logging.ts";
import * as connectionService from "./connection.ts";
import * as rateLimiter from "./rate-limiter.ts";

/**
 * Get SOL balance with rate limiting and detailed error handling
 */
export async function getSolBalance(
  publicKey: PublicKey,
  requestId = "system",
): Promise<number> {
  try {
    // Wait for rate limit
    await rateLimiter.waitForRateLimit("getBalance", requestId);

    // Get connection and balance
    const connection = await connectionService.getConnection();
    logging.debug(requestId, "Fetching SOL balance", {
      publicKey: publicKey.toString(),
    });

    const startTime = performance.now();
    const balance = await connection.getBalance(publicKey);
    const endTime = performance.now();

    logging.debug(requestId, "Fetched SOL balance successfully", {
      publicKey: publicKey.toString(),
      balanceLamports: balance,
      balanceSol: balance / LAMPORTS_PER_SOL,
      responseTimeMs: Math.round(endTime - startTime),
    });

    return balance;
  } catch (error) {
    logging.error(requestId, "Failed to fetch SOL balance", error);
    throw new Error(
      `Failed to fetch SOL balance for ${publicKey.toString()}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Get WSOL (wrapped SOL) balance with improved error handling
 */
export async function getWsolBalance(
  publicKey: PublicKey,
  requestId = "system",
): Promise<number> {
  try {
    // Wait for rate limit
    await rateLimiter.waitForRateLimit("getTokenAccountBalance", requestId);

    const connection = await connectionService.getConnection();

    // Get the associated token address for WSOL
    const ataAddress = await spl.getAssociatedTokenAddress(
      new PublicKey(spl.NATIVE_MINT),
      publicKey,
    );

    logging.debug(requestId, "Fetching WSOL balance", {
      publicKey: publicKey.toString(),
      tokenAccount: ataAddress.toString(),
    });

    try {
      const startTime = performance.now();
      const balance = await connection.getTokenAccountBalance(ataAddress);
      const endTime = performance.now();

      logging.debug(requestId, "Fetched WSOL balance successfully", {
        publicKey: publicKey.toString(),
        tokenAccount: ataAddress.toString(),
        balance: Number(balance.value.amount),
        responseTimeMs: Math.round(endTime - startTime),
      });

      return Number(balance.value.amount);
    } catch (error) {
      // If the account doesn't exist, return 0 instead of throwing
      if (
        error instanceof Error &&
        (error.message.includes("could not find account") ||
          error.message.includes("not found"))
      ) {
        logging.debug(requestId, "WSOL token account not found, returning 0", {
          publicKey: publicKey.toString(),
          tokenAccount: ataAddress.toString(),
        });
        return 0;
      }

      // Otherwise rethrow
      throw error;
    }
  } catch (error) {
    logging.error(requestId, "Failed to fetch WSOL balance", error);
    throw new Error(
      `Failed to fetch WSOL balance for ${publicKey.toString()}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Get combined SOL balance (native SOL + WSOL)
 */
export async function getTotalSolBalance(
  publicKey: PublicKey,
  requestId = "system",
): Promise<{
  nativeSol: number;
  wrappedSol: number;
  totalLamports: number;
  totalSol: number;
}> {
  try {
    // Get both balances
    const [nativeSolLamports, wrappedSolLamports] = await Promise.all([
      getSolBalance(publicKey, requestId),
      getWsolBalance(publicKey, requestId),
    ]);

    const totalLamports = nativeSolLamports + wrappedSolLamports;

    return {
      nativeSol: nativeSolLamports / LAMPORTS_PER_SOL,
      wrappedSol: wrappedSolLamports / LAMPORTS_PER_SOL,
      totalLamports,
      totalSol: totalLamports / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    logging.error(requestId, "Failed to fetch total SOL balance", error);
    throw new Error(
      `Failed to fetch total SOL balance for ${publicKey.toString()}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export default {
  getSolBalance,
  getWsolBalance,
  getTotalSolBalance,
  lamportsToSol,
  solToLamports,
};
