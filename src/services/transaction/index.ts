/**
 * Transaction Service
 *
 * A comprehensive service for creating, submitting, and tracking Solana transactions
 */

// Import from each module
import { createDraftTransaction } from "./create.ts";
import { submitTransaction } from "./submit.ts";
import {
  getTransactionById,
  getTransactionBySignature,
  getWalletTransactionHistory,
  listTransactions,
} from "./query.ts";
import {
  calculateSimplifiedFee,
  checkTransactionOnChain,
  formatSolAmount,
  isValidPublicKey,
  parseTransactionError,
} from "./utils.ts";
import { estimateSolTransferFee, estimateWsolTransferFee } from "./fee.ts";
import { createSwapDraftTransaction, submitSwapTransaction } from "./swap.ts";

// Re-export all types
export * from "./types.ts";

// Re-export functions from each module
export { createDraftTransaction } from "./create.ts";
export { submitTransaction } from "./submit.ts";
export {
  getTransactionById,
  getTransactionBySignature,
  getWalletTransactionHistory,
  listTransactions,
} from "./query.ts";

// Export utility functions
export {
  calculateSimplifiedFee,
  checkTransactionOnChain,
  formatSolAmount,
  isValidPublicKey,
  parseTransactionError,
} from "./utils.ts";

export { estimateSolTransferFee, estimateWsolTransferFee } from "./fee.ts";

// Export swap functions
export { createSwapDraftTransaction, submitSwapTransaction } from "./swap.ts";

// Default export combining all functionality
const transactionService = {
  createDraftTransaction,
  submitTransaction,
  getTransactionById,
  getTransactionBySignature,
  getWalletTransactionHistory,
  listTransactions,
  isValidPublicKey,
  checkTransactionOnChain,
  formatSolAmount,
  calculateSimplifiedFee,
  parseTransactionError,
  estimateSolTransferFee,
  estimateWsolTransferFee,
  createSwapDraftTransaction,
  submitSwapTransaction,
};

export default transactionService;
