/**
 * Transaction Swap Module
 * Provides functionality for creating and submitting token swap transactions
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as txRepo from "../../db/repositories/transactions.ts";
import * as solanaService from "../solana/index.ts";
import * as balanceService from "../balance.service.ts";
import * as logging from "../../utils/logging.ts";
import {
  SubmitTransactionParams,
  TokenType,
  Transaction,
  TransactionStatus,
} from "./types.ts";

/**
 * Parameters for creating a swap transaction
 */
export interface SwapTransactionParams {
  fromWalletId: number;
  fromToken: string;
  toToken: string;
  amountIn: number;
  slippageBps: number;
}

/**
 * Create a draft swap transaction without submitting to the blockchain
 */
export async function createSwapDraftTransaction(
  params: SwapTransactionParams,
  requestId = "system",
): Promise<Transaction> {
  logging.info(requestId, "Creating draft swap transaction", {
    fromWalletId: params.fromWalletId,
    fromToken: params.fromToken,
    toToken: params.toToken,
    amountIn: params.amountIn,
    slippageBps: params.slippageBps,
  });

  try {
    // 1. Validate sender wallet exists
    const fromWallet = await keypairRepo.findById(params.fromWalletId);
    if (!fromWallet) {
      throw new Error(`Sender wallet with ID ${params.fromWalletId} not found`);
    }

    let fromTokenPublicKey: PublicKey;
    let toTokenPublicKey: PublicKey;

    try {
      fromTokenPublicKey = new PublicKey(params.fromToken);
    } catch (error) {
      logging.error(requestId, "Invalid source token address", {
        token: params.fromToken,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Invalid source token address: ${params.fromToken}`);
    }

    try {
      toTokenPublicKey = new PublicKey(params.toToken);
    } catch (error) {
      logging.error(requestId, "Invalid destination token address", {
        token: params.toToken,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Invalid destination token address: ${params.toToken}`);
    }

    // 4. Check if this is a SOL transaction (special handling)
    const isFromSol = params.fromToken === "11111111111111111111111111111111";

    // 5. For SOL, convert amount to lamports
    let amountInLamports: number;
    if (isFromSol) {
      amountInLamports = solanaService.solToLamports(params.amountIn);
    } else {
      // For now, treat all token amounts as scaled by 10^9 for simplicity
      // In a real implementation, you would look up the token's decimals
      amountInLamports = solanaService.solToLamports(params.amountIn);
    }

    // 6. Check balance for SOL
    if (isFromSol) {
      const walletBalance = await balanceService.getWalletBalances([
        params.fromWalletId,
      ], requestId);
      if (walletBalance.length === 0) {
        throw new Error(
          `Could not fetch balance for wallet ID ${params.fromWalletId}`,
        );
      }

      const solBalance = walletBalance[0].solBalance;
      const solBalanceLamports = solanaService.solToLamports(solBalance);

      if (solBalanceLamports < amountInLamports) {
        throw new Error(
          `Insufficient SOL balance. Available: ${solBalance} SOL, Required: ${params.amountIn} SOL`,
        );
      }
    }
    // For other tokens, we would check SPL token balances here

    // 7. Get swap quote for fee estimation
    const quote = await solanaService.getTokenSwapQuote(
      fromTokenPublicKey,
      toTokenPublicKey,
      amountInLamports,
      params.slippageBps,
      requestId,
    );

    // 8. Calculate total fee (network + platform)
    const totalFee = Number(quote.networkFee + quote.platformFee);

    // 9. Create draft transaction in database
    const dbTransaction = await txRepo.createTransaction({
      from_wallet_id: params.fromWalletId,
      to_wallet_id: null, // Swap transactions don't have a recipient wallet
      external_destination: null,
      amount: amountInLamports,
      fee_amount: totalFee,
      token_type: isFromSol ? "SOL" : "SPL", // 'SPL' for non-SOL tokens
      status: "DRAFT",
      is_external: true, // Swaps are considered external operations
      transaction_data: {
        type: "SWAP",
        fromToken: params.fromToken,
        toToken: params.toToken,
        expectedAmountOut: Number(quote.amountOut),
        minimumAmountOut: Number(quote.minimumOut),
        slippageBps: params.slippageBps,
        price: quote.price,
        priceImpact: quote.priceImpact,
        routes: quote.routes,
      },
    });

    // 10. Format and return response
    const transaction: Transaction = {
      id: dbTransaction.id,
      fromWalletId: dbTransaction.from_wallet_id,
      fromWalletPublicKey: fromWallet.public_key,
      destination: {
        type: "EXTERNAL",
        address: params.toToken,
      },
      amount: Number(dbTransaction.amount),
      displayAmount: isFromSol
        ? solanaService.lamportsToSol(Number(dbTransaction.amount))
        : Number(dbTransaction.amount) / 1e9,
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
      // Add swap-specific data
      swapData: {
        fromToken: params.fromToken,
        toToken: params.toToken,
        expectedAmountOut: solanaService.lamportsToSol(Number(quote.amountOut)),
        minimumAmountOut: solanaService.lamportsToSol(Number(quote.minimumOut)),
        slippageBps: params.slippageBps,
        price: quote.price,
        priceImpact: quote.priceImpact,
      },
    };

    logging.info(requestId, "Draft swap transaction created successfully", {
      transactionId: transaction.id,
      amount: transaction.displayAmount,
      fee: transaction.displayFee,
      total: transaction.displayTotalCost,
    });

    return transaction;
  } catch (error) {
    logging.error(requestId, "Failed to create draft swap transaction", error);
    throw error;
  }
}

/**
 * Submit a draft swap transaction to the blockchain
 */
export async function submitSwapTransaction(
  params: SubmitTransactionParams,
  requestId = "system",
): Promise<Transaction> {
  logging.info(requestId, "Submitting swap transaction", {
    transactionId: params.transactionId,
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

    // 3. Check if this is a swap transaction
    const transactionData =
      dbTransaction.transaction_data as Record<string, unknown> || {};
    if (transactionData.type !== "SWAP") {
      throw new Error(
        `Transaction ${params.transactionId} is not a swap transaction`,
      );
    }

    // 4. Get sender wallet
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

    // 5. Parse the sender keypair from DB
    const fromKeypair = keypairRepo.toKeypair(fromWallet.secret_key);
    if (!fromKeypair) {
      throw new Error(
        `Sender wallet with ID ${dbTransaction.from_wallet_id} has no keypair`,
      );
    }

    // 6. Update transaction status to PENDING
    await txRepo.updateTransactionStatus(dbTransaction.id, "PENDING");

    // 7. Execute the swap
    try {
      const fromToken = new PublicKey(transactionData.fromToken);
      const toToken = new PublicKey(transactionData.toToken);
      const slippageBps = transactionData.slippageBps || 50; // Default 0.5%

      // Execute the swap (simulated in this case)
      const result = await solanaService.executeTokenSwap(
        fromKeypair,
        fromToken,
        toToken,
        dbTransaction.amount,
        slippageBps,
        requestId,
      );

      logging.info(
        requestId,
        `Swap executed successfully with signature: ${result.signature}`,
      );

      // Update transaction in database with signature and confirmed status
      const updatedTx = await txRepo.updateTransactionStatus(
        dbTransaction.id,
        "CONFIRMED",
        result.signature,
      );

      // Also update the transaction data with the actual output amount
      await txRepo.updateTransactionData(dbTransaction.id, {
        ...transactionData,
        actualAmountOut: Number(result.amountOut),
        actualFee: Number(result.fee),
      });

      // Refresh wallet balances in background
      setTimeout(async () => {
        try {
          if (dbTransaction.from_wallet_id) {
            await balanceService.getWalletBalances([
              dbTransaction.from_wallet_id,
            ], `${requestId}-refresh`);
          }
        } catch (refreshError) {
          logging.error(
            requestId,
            "Failed to refresh wallet balances after swap",
            refreshError,
          );
        }
      }, 2000);

      // Format and return response
      return {
        id: updatedTx.id,
        fromWalletId: updatedTx.from_wallet_id,
        fromWalletPublicKey: fromWallet.public_key,
        destination: {
          type: "EXTERNAL",
          address: transactionData.toToken,
        },
        amount: Number(updatedTx.amount),
        displayAmount: solanaService.lamportsToSol(Number(updatedTx.amount)),
        feeAmount: updatedTx.fee_amount !== null
          ? Number(updatedTx.fee_amount)
          : null,
        displayFee: updatedTx.fee_amount !== null
          ? solanaService.lamportsToSol(Number(updatedTx.fee_amount))
          : null,
        tokenType: updatedTx.token_type as TokenType,
        status: updatedTx.status as TransactionStatus,
        signature: updatedTx.signature,
        createdAt: updatedTx.created_at,
        updatedAt: updatedTx.updated_at,
        errorMessage: updatedTx.error_message,
        isExternal: updatedTx.is_external,
        totalCost: updatedTx.fee_amount !== null
          ? Number(updatedTx.amount) + Number(updatedTx.fee_amount)
          : null,
        displayTotalCost: updatedTx.fee_amount !== null
          ? solanaService.lamportsToSol(
            Number(updatedTx.amount) + Number(updatedTx.fee_amount),
          )
          : null,
        swapData: {
          fromToken: transactionData.fromToken,
          toToken: transactionData.toToken,
          expectedAmountOut: solanaService.lamportsToSol(
            transactionData.expectedAmountOut,
          ),
          actualAmountOut: solanaService.lamportsToSol(
            Number(result.amountOut),
          ),
          slippageBps: transactionData.slippageBps,
          price: transactionData.price,
          priceImpact: transactionData.priceImpact,
        },
      };
    } catch (error) {
      // Update transaction status to FAILED
      const updatedTx = await txRepo.updateTransactionStatus(
        dbTransaction.id,
        "FAILED",
        null,
        error instanceof Error ? error.message : String(error),
      );

      logging.error(requestId, "Failed to submit swap transaction", error);

      // Format and return failed transaction
      return {
        id: updatedTx.id,
        fromWalletId: updatedTx.from_wallet_id,
        fromWalletPublicKey: fromWallet.public_key,
        destination: {
          type: "EXTERNAL",
          address: transactionData.toToken,
        },
        amount: Number(updatedTx.amount),
        displayAmount: solanaService.lamportsToSol(Number(updatedTx.amount)),
        feeAmount: updatedTx.fee_amount !== null
          ? Number(updatedTx.fee_amount)
          : null,
        displayFee: updatedTx.fee_amount !== null
          ? solanaService.lamportsToSol(Number(updatedTx.fee_amount))
          : null,
        tokenType: updatedTx.token_type as TokenType,
        status: updatedTx.status as TransactionStatus,
        signature: updatedTx.signature,
        createdAt: updatedTx.created_at,
        updatedAt: updatedTx.updated_at,
        errorMessage: updatedTx.error_message,
        isExternal: updatedTx.is_external,
        totalCost: updatedTx.fee_amount !== null
          ? Number(updatedTx.amount) + Number(updatedTx.fee_amount)
          : null,
        displayTotalCost: updatedTx.fee_amount !== null
          ? solanaService.lamportsToSol(
            Number(updatedTx.amount) + Number(updatedTx.fee_amount),
          )
          : null,
        swapData: {
          fromToken: transactionData.fromToken,
          toToken: transactionData.toToken,
          expectedAmountOut: solanaService.lamportsToSol(
            transactionData.expectedAmountOut,
          ),
          actualAmountOut: null,
          slippageBps: transactionData.slippageBps,
          price: transactionData.price,
          priceImpact: transactionData.priceImpact,
        },
      };
    }
  } catch (error) {
    logging.error(requestId, "Failed to submit swap transaction", error);
    throw error;
  }
}

export default {
  createSwapDraftTransaction,
  submitSwapTransaction,
};
