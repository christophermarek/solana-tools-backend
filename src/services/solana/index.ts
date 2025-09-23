import * as connectionService from "./connection.ts";
import * as rateLimiter from "./rate-limiter.ts";
import * as balanceService from "./balance.ts";
import * as transactionService from "./transaction.ts";
import * as tokenService from "./token.ts";
import * as utilsService from "./utils.ts";
import * as swapService from "./swap.ts";
import * as logging from "../../utils/logging.ts";

/**
 * Initialize all Solana services
 */
export async function init(): Promise<void> {
  try {
    logging.info("system", "Initializing Solana services...");

    // Initialize services in order
    await rateLimiter.init();
    await connectionService.init();

    // Validate connection
    const connectionValid = await connectionService.validateConnection();

    if (!connectionValid) {
      throw new Error(
        `Solana service initialization failed: ` +
          `${!connectionValid ? "Connection invalid" : ""}`,
      );
    }

    logging.info("system", "Solana services initialized successfully", {
      connectionValid,
    });
  } catch (error) {
    logging.error("system", "Failed to initialize Solana services", error);
    throw error;
  }
}

/**
 * Cleanup all Solana services
 */
export function shutdown(): void {
  connectionService.shutdown();
}

// Re-export all service functions
export {
  checkConnectionHealth,
  // Connection service
  getConnection,
  getConnectionStatus,
  validateConnection,
} from "./connection.ts";

export {
  // Balance service
  getSolBalance,
  getTotalSolBalance,
  getWsolBalance,
  lamportsToSol,
  solToLamports,
} from "./balance.ts";

export {
  confirmTransaction,
  createAndSignVersionedTx,
  // Transaction service
  getLatestBlockhash,
  getTransactionStatus,
  sendTransactionWithRetry,
} from "./transaction.ts";

export {
  buildCreateWsolAtaIx,
  buildReclaimWsolIxs,
  // Token service
  buildSolTransferIx,
  buildWsolTransferIxs,
  findAssociatedTokenAddress,
  getWsolMintAddress,
  sendAndConfirmTransaction,
} from "./token.ts";

export {
  buildTokenSwapIx,
  executeTokenSwap,
  // Swap service
  getTokenSwapQuote,
} from "./swap.ts";

export {
  // Utils
  chunkArray,
} from "./utils.ts";

// Rate limiter
export { waitForRateLimit } from "./rate-limiter.ts";

// Default export
export default {
  init,
  shutdown,

  // Connection
  getConnection: connectionService.getConnection,
  checkConnectionHealth: connectionService.checkConnectionHealth,
  validateConnection: connectionService.validateConnection,
  getConnectionStatus: connectionService.getConnectionStatus,

  // Balance
  getSolBalance: balanceService.getSolBalance,
  getWsolBalance: balanceService.getWsolBalance,
  getTotalSolBalance: balanceService.getTotalSolBalance,
  lamportsToSol: balanceService.lamportsToSol,
  solToLamports: balanceService.solToLamports,

  // Transactions
  getLatestBlockhash: transactionService.getLatestBlockhash,
  createAndSignVersionedTx: transactionService.createAndSignVersionedTx,
  confirmTransaction: transactionService.confirmTransaction,
  sendTransactionWithRetry: transactionService.sendTransactionWithRetry,
  getTransactionStatus: transactionService.getTransactionStatus,

  // Token operations
  buildSolTransferIx: tokenService.buildSolTransferIx,
  buildCreateWsolAtaIx: tokenService.buildCreateWsolAtaIx,
  buildWsolTransferIxs: tokenService.buildWsolTransferIxs,
  buildReclaimWsolIxs: tokenService.buildReclaimWsolIxs,
  getWsolMintAddress: tokenService.getWsolMintAddress,
  findAssociatedTokenAddress: tokenService.findAssociatedTokenAddress,
  sendAndConfirmTransaction: tokenService.sendAndConfirmTransaction,

  // Swap operations
  getTokenSwapQuote: swapService.getTokenSwapQuote,
  buildTokenSwapIx: swapService.buildTokenSwapIx,
  executeTokenSwap: swapService.executeTokenSwap,

  // Utils
  chunkArray: utilsService.chunkArray,

  // Rate limiter
  waitForRateLimit: rateLimiter.waitForRateLimit,
};
