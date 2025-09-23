import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as txRepo from "../../db/repositories/transactions.ts";
import * as solanaService from "../solana/index.ts";
import * as balanceService from "../balance.service.ts";
import * as logging from "../../utils/logging.ts";
import {
  DestinationType,
  SubmitTransactionParams,
  TokenType,
  Transaction,
  TransactionStatus,
} from "./types.ts";

/**
 * Submit a draft transaction to the blockchain
 */
export async function submitTransaction(
  params: SubmitTransactionParams,
  requestId = "system",
): Promise<Transaction> {
  logging.info(requestId, "Submitting transaction", {
    transactionId: params.transactionId,
    priorityFee: params.priorityFee,
  });

  try {
    // 1. Get the draft transaction
    const dbTransaction = await txRepo.getTransactionById(params.transactionId);
    if (!dbTransaction) {
      throw new Error(`Transaction with ID ${params.transactionId} not found`);
    }

    // 2. Verify it's in DRAFT status
    if (dbTransaction.status !== "DRAFT") {
      throw new Error(
        `Transaction ${params.transactionId} is already in ${dbTransaction.status} status and cannot be submitted`,
      );
    }

    // 3. Get sender wallet
    if (!dbTransaction.from_wallet_id) {
      throw new Error(
        `Transaction ${params.transactionId} has no sender wallet`,
      );
    }

    const fromWallet = await keypairRepo.findById(dbTransaction.from_wallet_id);
    if (!fromWallet) {
      throw new Error(
        `Sender wallet with ID ${dbTransaction.from_wallet_id} not found`,
      );
    }

    // 4. Parse the sender keypair from DB
    const fromKeypair = keypairRepo.toKeypair(fromWallet.secret_key);

    // 5. Get destination public key
    let toPublicKey: PublicKey;

    if (dbTransaction.to_wallet_id) {
      // Internal destination
      const toWallet = await keypairRepo.findById(dbTransaction.to_wallet_id);
      if (!toWallet) {
        throw new Error(
          `Receiver wallet with ID ${dbTransaction.to_wallet_id} not found`,
        );
      }
      toPublicKey = new PublicKey(toWallet.public_key);
    } else if (dbTransaction.external_destination) {
      // External destination
      toPublicKey = new PublicKey(dbTransaction.external_destination);
    } else {
      throw new Error(
        `Transaction ${params.transactionId} has no valid destination`,
      );
    }

    // 6. Update transaction status to PENDING
    await txRepo.updateTransactionStatus(dbTransaction.id, "PENDING");

    // 7. Build and sign the transaction
    let signature: string;
    const tokenType = dbTransaction.token_type as TokenType;

    try {
      if (tokenType === "SOL") {
        signature = await sendSolTransaction(
          fromKeypair,
          toPublicKey,
          Number(dbTransaction.amount),
          requestId,
        );
      } else if (tokenType === "WSOL") {
        signature = await sendWsolTransaction(
          fromKeypair,
          toPublicKey,
          Number(dbTransaction.amount),
          requestId,
        );
      } else {
        throw new Error(`Unsupported token type: ${tokenType}`);
      }

      logging.info(
        requestId,
        `Transaction submitted successfully with signature: ${signature}`,
      );
    } catch (error) {
      // Update transaction status to FAILED
      const updatedTx = await txRepo.updateTransactionStatus(
        dbTransaction.id,
        "FAILED",
        null,
        error instanceof Error ? error.message : String(error),
      );

      logging.error(requestId, "Failed to submit transaction", error);

      // Format and return failed transaction
      return formatTransactionResponse(
        updatedTx,
        fromWallet.public_key,
        toPublicKey.toString(),
      );
    }

    // 8. Update transaction in database with signature
    const updatedTx = await txRepo.updateTransactionStatus(
      dbTransaction.id,
      "CONFIRMED",
      signature,
    );

    // 9. Refresh wallet balances in background
    setTimeout(async () => {
      try {
        if (dbTransaction.from_wallet_id) {
          await balanceService.getWalletBalances(
            [dbTransaction.from_wallet_id],
            `${requestId}-refresh`,
          );
        }

        if (dbTransaction.to_wallet_id) {
          await balanceService.getWalletBalances(
            [dbTransaction.to_wallet_id],
            `${requestId}-refresh`,
          );
        }
      } catch (refreshError) {
        logging.error(
          requestId,
          "Failed to refresh wallet balances after transaction",
          refreshError,
        );
      }
    }, 2000);

    // 10. Format and return response
    return formatTransactionResponse(
      updatedTx,
      fromWallet.public_key,
      toPublicKey.toString(),
    );
  } catch (error) {
    logging.error(requestId, "Failed to submit transaction", error);
    throw error;
  }
}

/**
 * Format transaction response for API
 */
function formatTransactionResponse(
  dbTransaction: txRepo.DbTransaction,
  fromPublicKey: string,
  toPublicKey: string,
): Transaction {
  const isInternal = dbTransaction.to_wallet_id !== null;
  const destinationType: DestinationType = isInternal ? "INTERNAL" : "EXTERNAL";

  return {
    id: dbTransaction.id,
    fromWalletId: dbTransaction.from_wallet_id,
    fromWalletPublicKey: fromPublicKey,
    destination: {
      type: destinationType,
      walletId: dbTransaction.to_wallet_id || undefined,
      address: dbTransaction.external_destination || toPublicKey,
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

/**
 * Send a SOL transaction
 */
async function sendSolTransaction(
  fromKeypair: Keypair,
  toPublicKey: PublicKey,
  amountLamports: number,
  requestId = "system",
): Promise<string> {
  try {
    // Create SOL transfer instruction
    const transferIx = solanaService.buildSolTransferIx(
      fromKeypair.publicKey,
      toPublicKey,
      amountLamports,
    );

    // Create and sign transaction
    const transaction = await solanaService.createAndSignVersionedTx(
      [transferIx],
      [fromKeypair],
      requestId,
    );

    // Send transaction with retry
    const result = await solanaService.sendTransactionWithRetry(
      transaction,
      {
        maxRetries: 3,
        skipPreflight: false,
      },
      requestId,
    );

    if (!result.confirmed || result.error) {
      throw new Error(`Transaction failed: ${result.error || "Unknown error"}`);
    }

    return result.signature;
  } catch (error) {
    logging.error(requestId, "Failed to send SOL transaction", error);
    throw error;
  }
}

async function sendWsolTransaction(
  fromKeypair: Keypair,
  toPublicKey: PublicKey,
  amountLamports: number,
  requestId = "system",
): Promise<string> {
  try {
    // Create WSOL transfer instructions
    const transferIxs = await solanaService.buildWsolTransferIxs(
      fromKeypair.publicKey,
      toPublicKey,
      amountLamports,
      requestId,
    );

    // Create and sign transaction
    const transaction = await solanaService.createAndSignVersionedTx(
      transferIxs,
      [fromKeypair],
      requestId,
    );

    // Send transaction with retry
    const result = await solanaService.sendTransactionWithRetry(
      transaction,
      {
        maxRetries: 3,
        skipPreflight: false,
      },
      requestId,
    );

    if (!result.confirmed || result.error) {
      throw new Error(`Transaction failed: ${result.error || "Unknown error"}`);
    }

    return result.signature;
  } catch (error) {
    logging.error(requestId, "Failed to send WSOL transaction", error);
    throw error;
  }
}
