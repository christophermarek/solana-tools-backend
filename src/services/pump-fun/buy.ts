import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import * as transactionRepo from "../../db/repositories/transactions.ts";
import { TransactionStatus } from "../../db/repositories/transactions.ts";
import { getSPLBalance } from "./get-spl-balance.ts";
import { parseSolanaErrorLogs } from "../solana/_constants.ts";
import { PumpFunTransactionType } from "../../db/repositories/bot-execution-transactions.ts";

export async function buy(
  buyer: Keypair,
  mint: Keypair,
  buyAmountSol: number,
  slippageBps?: number,
  botExecutionId?: number,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    curve: BondingCurveAccount;
    signature: string;
    amountBought: number;
    totalSolSpent: number;
    transactionFee: number;
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Buying token");
  let transactionId: number | null = null;

  try {
    const [sdk, error] = getSDK(buyer);

    if (error) {
      return [null, error];
    }

    const [initialBalance, initialBalanceError] = await getSPLBalance(
      buyer.publicKey,
      mint.publicKey,
    );

    if (initialBalanceError) {
      logging.warn(
        TAG,
        "Failed to get initial SPL balance",
        initialBalanceError,
      );
    }

    logging.info(TAG, "Mint: ", mint.publicKey.toString());

    const buyAmountLamports = BigInt(solanaService.solToLamports(buyAmountSol));
    const priorityFee = getPriorityFee();
    const slippage = slippageBps !== undefined
      ? BigInt(slippageBps)
      : SLIPPAGE_BPS;

    logging.info(TAG, "Buy parameters", {
      buyer: buyer.publicKey.toString(),
      mint: mint.publicKey.toString(),
      buyAmountSol,
      buyAmountLamports: buyAmountLamports.toString(),
      slippageBps: slippage.toString(),
      priorityFee,
    });

    const res = await sdk.trade.buy(
      buyer,
      mint.publicKey,
      buyAmountLamports,
      slippage,
      priorityFee,
    );

    if (!res.success) {
      const errorMessage = res.error as string;
      const cleanErrorMessage = parseSolanaErrorLogs(errorMessage);

      logging.error(
        TAG,
        "Failed to buy token",
        new Error(cleanErrorMessage),
      );
      return [
        null,
        { type: "SDK_ERROR", message: cleanErrorMessage } as SDKError,
      ];
    }

    if (!res.results) {
      logging.info(TAG, "No results from buy");
      return [null, PUMP_FUN_ERRORS.ERROR_NO_RESULTS_BUY];
    }

    const signature = res.signature;

    if (!signature) {
      const errorMsg = "Could not find signature in transaction result";
      logging.error(TAG, errorMsg, {
        res: res,
        results: res.results,
      });
      return [null, { type: "SDK_ERROR", message: errorMsg } as SDKError];
    }

    const transactionFee = res.results.meta?.fee ? res.results.meta.fee : 0;
    const transactionFeeSol = solanaService.lamportsToSol(transactionFee);

    const transaction = await transactionRepo.create({
      signature,
      sender_public_key: buyer.publicKey.toString(),
      status: TransactionStatus.PENDING,
      slot: res.results.slot,
      slippage_bps: Number(slippage),
      priority_fee_unit_limit: priorityFee.unitLimit,
      priority_fee_unit_price_lamports: priorityFee.unitPrice,
      transaction_fee_sol: transactionFeeSol,
      bot_execution_id: botExecutionId,
      pump_fun_transaction_type: botExecutionId
        ? PumpFunTransactionType.BUY
        : undefined,
    });
    transactionId = transaction.id;

    logging.info(TAG, "Buy transaction submitted", {
      signature,
      solscanUrl: `https://solscan.io/tx/${signature}`,
    });

    const [connection, connectionError] = await solanaService.getConnection();
    if (connectionError) {
      logging.warn(
        TAG,
        "Failed to get connection for confirmation, proceeding without confirmation",
        {
          error: connectionError,
        },
      );
    } else {
      const [confirmationResult, confirmationError] = await solanaService
        .confirmTransaction(
          connection,
          signature,
          {
            timeoutMs: 45000,
            retryCount: 2,
            retryDelayMs: 3000,
            commitment: "confirmed",
          },
        );

      if (confirmationError) {
        logging.warn(
          TAG,
          "Transaction confirmation failed, but transaction may have succeeded",
          {
            signature,
            error: confirmationError,
          },
        );

        const [statusCheck, statusError] = await solanaService
          .checkTransactionStatus(connection, signature);
        if (statusError || !statusCheck) {
          logging.warn(TAG, "Transaction status check also failed", {
            signature,
            statusError,
          });
        } else {
          logging.info(TAG, "Transaction confirmed via status check", {
            signature,
          });
        }
      } else {
        logging.info(TAG, "Transaction confirmed successfully", {
          signature,
          confirmedAt: confirmationResult?.confirmedAt,
        });

        if (transactionId) {
          await transactionRepo.update(transactionId, {
            status: TransactionStatus.CONFIRMED,
            confirmed_at: new Date(
              confirmationResult?.confirmedAt || Date.now(),
            ),
            commitment_level: "confirmed",
          });
        }
      }
    }

    const curve = await sdk.token.getBondingCurveAccount(mint.publicKey);
    if (!curve) {
      logging.info(TAG, "No curve from buy");
      return [null, PUMP_FUN_ERRORS.ERROR_NO_CURVE_AFTER_BUY];
    }

    const [finalBalance, balanceError] = await getSPLBalance(
      buyer.publicKey,
      mint.publicKey,
    );

    if (balanceError) {
      logging.warn(TAG, "Failed to get final SPL balance", balanceError);
    }

    const amountBought = initialBalanceError || balanceError
      ? 0
      : (finalBalance - initialBalance);

    const totalSolSpent = buyAmountSol + transactionFeeSol;

    logging.info(TAG, "Buy operation completed", {
      signature,
      curveExists: !!curve,
      amountBought,
      totalSolSpent,
      transactionFee: transactionFeeSol,
    });

    return [
      {
        transactionResult: res.results,
        curve,
        signature,
        amountBought,
        totalSolSpent,
        transactionFee: transactionFeeSol,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to buy token", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred during buy";

    if (transactionId) {
      await transactionRepo.update(transactionId, {
        status: TransactionStatus.FAILED,
        error_message: errorMessage,
      });
    }

    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
