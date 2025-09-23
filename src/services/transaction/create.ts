import { PublicKey } from "@solana/web3.js";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as txRepo from "../../db/repositories/transactions.ts";
import * as solanaService from "../solana/index.ts";
import * as balanceService from "../balance.service.ts";
import * as logging from "../../utils/logging.ts";
import {
  CreateDraftTransactionParams,
  DestinationType,
  TokenType,
  Transaction,
} from "./types.ts";
import { estimateSolTransferFee, estimateWsolTransferFee } from "./fee.ts";

/**
 * Create a draft transaction without submitting to the blockchain
 * This calculates fees and validates parameters
 */
export async function createDraftTransaction(
  params: CreateDraftTransactionParams,
  requestId = "system",
): Promise<Transaction> {
  logging.info(requestId, "Creating draft transaction", {
    fromWalletId: params.fromWalletId,
    destination: {
      type: params.destination.type,
      walletId: params.destination.walletId,
      address: params.destination.address,
    },
    amount: params.amount,
    tokenType: params.tokenType,
  });

  try {
    // 1. Validate sender wallet exists
    const fromWallet = await keypairRepo.findById(params.fromWalletId);
    if (!fromWallet) {
      throw new Error(`Sender wallet with ID ${params.fromWalletId} not found`);
    }

    // 2. Get sender public key
    const fromPublicKey = new PublicKey(fromWallet.public_key);

    // 3. Handle destination based on type
    let toWalletId: number | null = null;
    let toPublicKey: PublicKey;
    let externalDestination: string | null = null;
    let isExternal = false;

    if (params.destination.type === "INTERNAL") {
      if (!params.destination.walletId) {
        throw new Error("Wallet ID is required for internal transfers");
      }

      // Validate receiver wallet exists
      const toWallet = await keypairRepo.findById(params.destination.walletId);
      if (!toWallet) {
        throw new Error(
          `Receiver wallet with ID ${params.destination.walletId} not found`,
        );
      }

      toWalletId = toWallet.id;
      toPublicKey = new PublicKey(toWallet.public_key);
    } else {
      // External destination
      if (!params.destination.address) {
        throw new Error("Address is required for external transfers");
      }

      // Validate address format
      try {
        toPublicKey = new PublicKey(params.destination.address);
      } catch (error) {
        throw new Error(
          `Invalid destination address: ${params.destination.address}`,
        );
      }

      externalDestination = params.destination.address;
      isExternal = true;
    }

    // 4. Convert SOL amount to lamports
    const amountLamports = solanaService.solToLamports(params.amount);

    // 5. Verify sufficient balance
    const walletBalance = await balanceService.getWalletBalances([
      params.fromWalletId,
    ], requestId);
    if (walletBalance.length === 0) {
      throw new Error(
        `Could not fetch balance for wallet ID ${params.fromWalletId}`,
      );
    }

    const currentBalance = params.tokenType === "SOL"
      ? walletBalance[0].solBalance
      : walletBalance[0].wsolBalance;

    const currentBalanceLamports = solanaService.solToLamports(currentBalance);

    if (currentBalanceLamports < amountLamports) {
      throw new Error(
        `Insufficient ${params.tokenType} balance. Available: ${currentBalance} SOL, Required: ${params.amount} SOL`,
      );
    }

    // 6. Estimate transaction fee
    const feeEstimate = params.tokenType === "SOL"
      ? await estimateSolTransferFee(
        fromPublicKey,
        toPublicKey,
        amountLamports,
        requestId,
      )
      : await estimateWsolTransferFee(
        fromPublicKey,
        toPublicKey,
        amountLamports,
        requestId,
      );

    // 7. Check if balance is sufficient for amount + fee
    if (currentBalanceLamports < (amountLamports + feeEstimate.totalFee)) {
      throw new Error(
        `Insufficient balance to cover amount + fee. ` +
          `Available: ${currentBalance} SOL, ` +
          `Required: ${
            params.amount + solanaService.lamportsToSol(feeEstimate.totalFee)
          } SOL ` +
          `(${params.amount} SOL + ${
            solanaService.lamportsToSol(feeEstimate.totalFee)
          } SOL fee)`,
      );
    }

    // 8. Create draft transaction in database
    const dbTransaction = await txRepo.createTransaction({
      from_wallet_id: params.fromWalletId,
      to_wallet_id: toWalletId,
      external_destination: externalDestination,
      amount: amountLamports,
      fee_amount: feeEstimate.totalFee,
      token_type: params.tokenType,
      status: "DRAFT",
      is_external: isExternal,
      transaction_data: {
        destinationType: params.destination.type,
        feeBreakdown: feeEstimate,
      },
    });

    // 9. Format and return response
    const transaction: Transaction = {
      id: dbTransaction.id,
      fromWalletId: dbTransaction.from_wallet_id,
      fromWalletPublicKey: fromWallet.public_key,
      destination: {
        type: params.destination.type as DestinationType,
        walletId: toWalletId || undefined,
        walletPublicKey: toWalletId ? toPublicKey.toString() : undefined,
        address: externalDestination || undefined,
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
      status: dbTransaction.status as any,
      signature: dbTransaction.signature,
      createdAt: new Date(dbTransaction.created_at),
      updatedAt: new Date(dbTransaction.updated_at),
      errorMessage: dbTransaction.error_message,
      isExternal: dbTransaction.is_external === 1,
      totalCost: dbTransaction.fee_amount !== null
        ? Number(dbTransaction.amount) + Number(dbTransaction.fee_amount)
        : null,
      displayTotalCost: dbTransaction.fee_amount !== null
        ? solanaService.lamportsToSol(
          Number(dbTransaction.amount) + Number(dbTransaction.fee_amount),
        )
        : null,
    };

    logging.info(requestId, "Draft transaction created successfully", {
      transactionId: transaction.id,
      amount: transaction.displayAmount,
      fee: transaction.displayFee,
      total: transaction.displayTotalCost,
    });

    return transaction;
  } catch (error) {
    logging.error(requestId, "Failed to create draft transaction", error);
    throw error;
  }
}
