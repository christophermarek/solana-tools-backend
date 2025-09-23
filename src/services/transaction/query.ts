import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as txRepo from "../../db/repositories/transactions.ts";
import * as solanaService from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import {
  DestinationType,
  TokenType,
  Transaction,
  TransactionHistoryParams,
  TransactionStatus,
} from "./types.ts";

/**
 * Get transaction by ID
 */
export async function getTransactionById(
  id: number,
  requestId = "system",
): Promise<Transaction | null> {
  try {
    logging.debug(requestId, `Fetching transaction with ID: ${id}`);

    const dbTransaction = await txRepo.getTransactionById(id);
    if (!dbTransaction) {
      return null;
    }

    return await formatTransaction(dbTransaction, requestId);
  } catch (error) {
    logging.error(requestId, `Failed to get transaction with ID: ${id}`, error);
    throw error;
  }
}

/**
 * Get transaction by signature
 */
export async function getTransactionBySignature(
  signature: string,
  requestId = "system",
): Promise<Transaction | null> {
  try {
    logging.debug(
      requestId,
      `Fetching transaction with signature: ${signature}`,
    );

    const dbTransaction = await txRepo.getTransactionBySignature(signature);
    if (!dbTransaction) {
      return null;
    }

    return await formatTransaction(dbTransaction, requestId);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction with signature: ${signature}`,
      error,
    );
    throw error;
  }
}

/**
 * Get transaction history for a wallet
 */
export async function getWalletTransactionHistory(
  walletId: number,
  limit = 20,
  offset = 0,
  requestId = "system",
): Promise<{
  transactions: Transaction[];
  total: number;
}> {
  try {
    logging.debug(
      requestId,
      `Fetching transaction history for wallet ID: ${walletId}`,
    );

    // Get wallet to verify it exists
    const wallet = await keypairRepo.findById(walletId);
    if (!wallet) {
      throw new Error(`Wallet with ID ${walletId} not found`);
    }

    // Get transactions
    const dbTransactions = await txRepo.getWalletTransactions(
      walletId,
      limit,
      offset,
    );
    const total = await txRepo.getWalletTransactionCount(walletId);

    // Format transactions
    const transactions = await Promise.all(
      dbTransactions.map((tx) => formatTransaction(tx, requestId)),
    );

    return {
      transactions,
      total,
    };
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction history for wallet ID: ${walletId}`,
      error,
    );
    throw error;
  }
}

/**
 * List transactions with optional filtering
 */
export async function listTransactions(
  params: TransactionHistoryParams = {},
  requestId = "system",
): Promise<{
  transactions: Transaction[];
  total: number;
}> {
  try {
    logging.debug(requestId, `Listing transactions with filters`, params);

    // Apply filters
    const options: {
      status?: string;
      tokenType?: string;
      limit?: number;
      offset?: number;
    } = {};

    if (params.status) {
      options.status = params.status;
    }

    if (params.tokenType) {
      options.tokenType = params.tokenType;
    }

    if (params.limit) {
      options.limit = params.limit;
    }

    if (params.offset) {
      options.offset = params.offset;
    }

    // Get transactions - special case for wallet filter
    let dbTransactions: txRepo.DbTransaction[] = [];
    let total = 0;

    if (params.walletId) {
      // Wallet specific transactions
      dbTransactions = await txRepo.getWalletTransactions(
        params.walletId,
        params.limit || 20,
        params.offset || 0,
      );
      total = await txRepo.getWalletTransactionCount(params.walletId);
    } else {
      // All transactions with filters
      dbTransactions = await txRepo.listTransactions(options);
      // For now, we don't have a count method for filtered results
      total = dbTransactions.length;
    }

    // Format transactions
    const transactions = await Promise.all(
      dbTransactions.map((tx) => formatTransaction(tx, requestId)),
    );

    return {
      transactions,
      total,
    };
  } catch (error) {
    logging.error(requestId, "Failed to list transactions", error);
    throw error;
  }
}

/**
 * Format a database transaction record into API response format
 */
async function formatTransaction(
  dbTransaction: txRepo.DbTransaction,
  requestId = "system",
): Promise<Transaction> {
  // Get the public keys for wallets
  let fromPublicKey: string | null = null;
  let toWalletPublicKey: string | null = null;

  if (dbTransaction.from_wallet_id) {
    try {
      const fromWallet = await keypairRepo.findByIdIncludingInactive(
        dbTransaction.from_wallet_id,
      );
      if (fromWallet) {
        fromPublicKey = fromWallet.public_key;
      }
    } catch (error) {
      logging.warn(
        requestId,
        `Failed to get sender wallet details for transaction ${dbTransaction.id}`,
        error,
      );
    }
  }

  if (dbTransaction.to_wallet_id) {
    try {
      const toWallet = await keypairRepo.findByIdIncludingInactive(
        dbTransaction.to_wallet_id,
      );
      if (toWallet) {
        toWalletPublicKey = toWallet.public_key;
      }
    } catch (error) {
      logging.warn(
        requestId,
        `Failed to get receiver wallet details for transaction ${dbTransaction.id}`,
        error,
      );
    }
  }

  // Determine destination type
  const isInternal = dbTransaction.to_wallet_id !== null;
  const destinationType: DestinationType = isInternal ? "INTERNAL" : "EXTERNAL";

  return {
    id: dbTransaction.id,
    fromWalletId: dbTransaction.from_wallet_id,
    fromWalletPublicKey: fromPublicKey,
    destination: {
      type: destinationType,
      walletId: dbTransaction.to_wallet_id || undefined,
      walletPublicKey: toWalletPublicKey || undefined,
      address: dbTransaction.external_destination || toWalletPublicKey ||
        undefined,
    },
    amount: Number(dbTransaction.amount),
    displayAmount: solanaService.lamportsToSol(Number(dbTransaction.amount)),
    feeAmount: dbTransaction.fee_amount !== null
      ? Number(dbTransaction.fee_amount)
      : null,
    displayFee: dbTransaction.fee_amount !== null
      ? solanaService.lamportsToSol(Number(dbTransaction.fee_amount))
      : null,
    tokenType: dbTransaction.token_type as TokenType,
    status: dbTransaction.status as TransactionStatus,
    signature: dbTransaction.signature,
    createdAt: dbTransaction.created_at,
    updatedAt: dbTransaction.updated_at,
    errorMessage: dbTransaction.error_message,
    isExternal: dbTransaction.is_external,
    totalCost: dbTransaction.fee_amount !== null
      ? Number(dbTransaction.amount) + Number(dbTransaction.fee_amount)
      : null,
    displayTotalCost: dbTransaction.fee_amount !== null
      ? solanaService.lamportsToSol(
        Number(dbTransaction.amount) + Number(dbTransaction.fee_amount),
      )
      : null,
  };
}
