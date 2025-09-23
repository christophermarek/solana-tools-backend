import { PublicKey } from "@solana/web3.js";
import * as keypairRepo from "../db/repositories/keypairs.ts";
import { BalanceStatus } from "../db/repositories/keypairs.ts";
import * as solanaService from "./solana/index.ts";
import * as logging from "../utils/logging.ts";

/**
 * Interface for wallet balance
 */
export interface WalletBalance {
  id: number;
  publicKey: string;
  label?: string;
  solBalance: number;
  wsolBalance: number;
  totalBalance: number;
  lastUpdated: Date;
  balanceStatus: BalanceStatus;
}

/**
 * Get balances for multiple wallets with improved batch processing
 */
export async function getWalletBalances(
  walletIds: number[],
  requestId = "system",
): Promise<WalletBalance[]> {
  logging.info(requestId, `Fetching balances for ${walletIds.length} wallets`);
  const results: WalletBalance[] = [];
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
          const balanceResult = await solanaService.getTotalSolBalance(
            wallet.publicKey,
            requestId,
          );

          // Store balances in lamports in the database
          const solLamports = solanaService.solToLamports(
            balanceResult.nativeSol,
          );
          const wsolLamports = solanaService.solToLamports(
            balanceResult.wrappedSol,
          );

          // Update DB with current balances in lamports
          const updatedKeypair = await keypairRepo.updateBalance(wallet.id, {
            sol_balance: solLamports,
            wsol_balance: wsolLamports,
            balance_status: 'FRESH', // Mark as FRESH after update
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
            lastUpdated: updatedKeypair.last_balance_update || new Date(),
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
): Promise<WalletBalance | null> {
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
    const balanceResult = await solanaService.getTotalSolBalance(
      publicKey,
      requestId,
    );

    // Store balances in lamports in the database
    const solLamports = solanaService.solToLamports(balanceResult.nativeSol);
    const wsolLamports = solanaService.solToLamports(balanceResult.wrappedSol);

    // Update DB with current balances in lamports
    const updatedKeypair = await keypairRepo.updateBalanceByPublicKey(
      publicKeyStr,
      {
        sol_balance: solLamports,
        wsol_balance: wsolLamports,
        balance_status: 'FRESH', // Mark as FRESH after update
      },
    );

    // Return the balance in SOL units for the API
    const walletBalance: WalletBalance = {
      id: dbKeypair.id,
      publicKey: dbKeypair.public_key,
      label: dbKeypair.label,
      solBalance: balanceResult.nativeSol, // Already in SOL
      wsolBalance: balanceResult.wrappedSol, // Already in SOL
      totalBalance: balanceResult.totalSol, // Already in SOL
      lastUpdated: updatedKeypair.last_balance_update || new Date(),
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
  getWalletBalances,
  getBalanceByPublicKey,
};
