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

/**
 * Get balances for multiple wallets with improved batch processing
 */
export async function getWalletBalances(
  walletIds: number[],
  requestId = "system",
): Promise<
  Array<{
    id: number;
    publicKey: string;
    label?: string;
    solBalance: number;
    wsolBalance: number;
    totalBalance: number;
    lastUpdated: Date;
    balanceStatus: string;
  }>
> {
  const { default: keypairRepo, BalanceStatus } = await import(
    "../../db/repositories/keypairs.ts"
  );

  logging.info(requestId, `Fetching balances for ${walletIds.length} wallets`);
  const results: Array<{
    id: number;
    publicKey: string;
    label?: string;
    solBalance: number;
    wsolBalance: number;
    totalBalance: number;
    lastUpdated: Date;
    balanceStatus: string;
  }> = [];
  const errors: string[] = [];

  // Get all keypairs in a single DB call
  const allActiveKeypairs = await keypairRepo.listActive();
  const keypairsMap = new Map(allActiveKeypairs.map((kp) => [kp.id, kp]));

  // Prepare requests in batches
  const walletRequests = walletIds
    .filter((id) => keypairsMap.has(id))
    .map((id) => {
      const dbKeypair = keypairsMap.get(id)!;
      return {
        id: dbKeypair.id,
        publicKey: new PublicKey(dbKeypair.public_key),
        dbKeypair,
      };
    });

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5;
  for (let i = 0; i < walletRequests.length; i += BATCH_SIZE) {
    const batch = walletRequests.slice(i, i + BATCH_SIZE);
    logging.debug(
      requestId,
      `Processing batch ${i / BATCH_SIZE + 1} of wallet balances`,
      {
        batchSize: batch.length,
        totalProcessed: i,
        totalToProcess: walletRequests.length,
      },
    );

    // Process batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(async (wallet) => {
        try {
          const balanceResult = await getTotalSolBalance(
            wallet.publicKey,
            requestId,
          );

          // Store balances in lamports in the database
          const solLamports = solToLamports(balanceResult.nativeSol);
          const wsolLamports = solToLamports(balanceResult.wrappedSol);

          // Update DB with current balances in lamports
          const updatedKeypair = await keypairRepo.updateBalance(wallet.id, {
            sol_balance: solLamports,
            wsol_balance: wsolLamports,
            balance_status: BalanceStatus.FRESH, // Mark as FRESH after update
          });

          // Log the values for debugging
          logging.debug(requestId, `Updated wallet balance in database`, {
            walletId: wallet.id,
            publicKey: wallet.dbKeypair.public_key,
            solBalanceLamports: solLamports,
            wsolBalanceLamports: wsolLamports,
            solBalanceSol: balanceResult.nativeSol,
            wsolBalanceSol: balanceResult.wrappedSol,
            totalSol: balanceResult.totalSol,
            balanceStatus: updatedKeypair.balance_status,
          });

          // Return balances in SOL units for the API
          return {
            id: wallet.id,
            publicKey: wallet.dbKeypair.public_key,
            label: wallet.dbKeypair.label,
            solBalance: balanceResult.nativeSol, // Already in SOL
            wsolBalance: balanceResult.wrappedSol, // Already in SOL
            totalBalance: balanceResult.totalSol, // Already in SOL
            lastUpdated: updatedKeypair.last_balance_update
              ? new Date(updatedKeypair.last_balance_update)
              : new Date(),
            balanceStatus: updatedKeypair.balance_status,
          };
        } catch (error) {
          const errorMessage =
            `Failed to fetch balance for wallet ID ${wallet.id}: ${
              error instanceof Error ? error.message : String(error)
            }`;
          logging.error(requestId, errorMessage, error);
          throw new Error(errorMessage);
        }
      }),
    );

    // Process batch results
    batchResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        errors.push(result.reason.message);
      }
    });
  }

  // Log summary of results
  logging.info(requestId, `Completed fetching balances`, {
    totalWallets: walletIds.length,
    successCount: results.length,
    errorCount: errors.length,
  });

  if (errors.length > 0) {
    logging.debug(requestId, `Balance fetch errors`, { errors });
  }

  return results;
}

/**
 * Get balance for a specific public key with improved error handling
 */
export async function getBalanceByPublicKey(
  publicKeyStr: string,
  requestId = "system",
): Promise<
  {
    id: number;
    publicKey: string;
    label?: string;
    solBalance: number;
    wsolBalance: number;
    totalBalance: number;
    lastUpdated: Date;
    balanceStatus: string;
  } | null
> {
  const { default: keypairRepo, BalanceStatus } = await import(
    "../../db/repositories/keypairs.ts"
  );

  logging.info(requestId, `Getting balance for wallet: ${publicKeyStr}`);

  try {
    // Validate the public key
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(publicKeyStr);
    } catch (error) {
      const errorMessage = `Invalid public key format: ${publicKeyStr}`;
      logging.error(requestId, errorMessage, error);
      throw new Error(errorMessage);
    }

    // Check if wallet exists in database
    const dbKeypair = await keypairRepo.findByPublicKey(publicKeyStr);
    if (!dbKeypair) {
      logging.info(requestId, `Wallet not found in database: ${publicKeyStr}`);
      return null;
    }

    // Get on-chain balances with a single call
    const balanceResult = await getTotalSolBalance(publicKey, requestId);

    // Store balances in lamports in the database
    const solLamports = solToLamports(balanceResult.nativeSol);
    const wsolLamports = solToLamports(balanceResult.wrappedSol);

    // Update DB with current balances in lamports
    const updatedKeypair = await keypairRepo.updateBalanceByPublicKey(
      publicKeyStr,
      {
        sol_balance: solLamports,
        wsol_balance: wsolLamports,
        balance_status: BalanceStatus.FRESH, // Mark as FRESH after update
      },
    );

    // Return the balance in SOL units for the API
    const walletBalance = {
      id: dbKeypair.id,
      publicKey: dbKeypair.public_key,
      label: dbKeypair.label,
      solBalance: balanceResult.nativeSol, // Already in SOL
      wsolBalance: balanceResult.wrappedSol, // Already in SOL
      totalBalance: balanceResult.totalSol, // Already in SOL
      lastUpdated: updatedKeypair.last_balance_update
        ? new Date(updatedKeypair.last_balance_update)
        : new Date(),
      balanceStatus: updatedKeypair.balance_status,
    };

    logging.debug(requestId, `Successfully retrieved balance for wallet`, {
      publicKey: publicKeyStr,
      solBalance: walletBalance.solBalance,
      wsolBalance: walletBalance.wsolBalance,
      totalBalance: walletBalance.totalBalance,
      solLamports,
      wsolLamports,
    });

    return walletBalance;
  } catch (error) {
    const errorMessage =
      `Failed to fetch balance for public key ${publicKeyStr}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    logging.error(requestId, errorMessage, error);
    throw new Error(errorMessage);
  }
}

export default {
  getSolBalance,
  getWsolBalance,
  getTotalSolBalance,
  lamportsToSol,
  solToLamports,
  getWalletBalances,
  getBalanceByPublicKey,
};
