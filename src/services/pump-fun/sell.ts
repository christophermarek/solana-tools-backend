import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import { SolanaErrors } from "../solana/_errors.ts";
import * as transactionRepo from "../../db/repositories/transactions.ts";
import { TransactionStatus } from "../../db/repositories/transactions.ts";

export interface SellTokenParams {
  sellAmountSol?: number;
  sellAmountSPL?: number;
  slippageBps?: number;
}

export async function sell(
  seller: Keypair,
  mint: Keypair,
  params: SellTokenParams,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    curve: BondingCurveAccount;
    signature: string;
  }, null] | [null, PumpFunErrors | SolanaErrors]
> {
  logging.info(TAG, "Selling token", params);
  let transactionId: number | null = null;

  try {
    const [sdk, error] = getSDK(seller);
    if (error) {
      return [null, error];
    }

    let sellAmountLamports: bigint;
    let sellType: string;
    let sellAmount: number;

    if (params.sellAmountSol !== undefined) {
      sellAmountLamports = BigInt(
        solanaService.solToLamports(params.sellAmountSol),
      );
      sellType = "SOL value";
      sellAmount = params.sellAmountSol;
    } else if (params.sellAmountSPL !== undefined) {
      sellAmountLamports = BigInt(params.sellAmountSPL);
      sellType = "SPL tokens";
      sellAmount = params.sellAmountSPL;
    } else {
      logging.error(
        TAG,
        "Either sellAmountSol or sellAmountSPL must be provided",
        new Error("Invalid sell parameters"),
      );
      return [
        null,
        {
          type: "SDK_ERROR",
          message: PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN,
        } as SDKError,
      ];
    }

    logging.info(TAG, "Mint: ", mint.publicKey.toString());
    const priorityFee = getPriorityFee();
    const slippage = params.slippageBps !== undefined
      ? BigInt(params.slippageBps)
      : SLIPPAGE_BPS;

    logging.info(TAG, "Sell parameters", {
      seller: seller.publicKey.toString(),
      mint: mint.publicKey.toString(),
      sellType,
      sellAmount,
      sellAmountLamports: sellAmountLamports.toString(),
      slippageBps: slippage.toString(),
      priorityFee,
    });

    const res = await sdk.trade.sell(
      seller,
      mint.publicKey,
      sellAmountLamports,
      slippage,
      priorityFee,
    );

    if (!res.success) {
      const errorMessage = res.error as string;
      logging.error(
        TAG,
        "Failed to sell token",
        new Error(errorMessage),
      );
      return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
    }

    if (!res.results) {
      logging.info(TAG, "No results from sell");
      return [
        null,
        {
          type: "SDK_ERROR",
          message: PUMP_FUN_ERRORS.ERROR_NO_RESULTS_SELL,
        } as SDKError,
      ];
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

    const transaction = await transactionRepo.create({
      signature,
      sender_public_key: seller.publicKey.toString(),
      status: TransactionStatus.PENDING,
      slot: res.results.slot,
      slippage_bps: Number(slippage),
      priority_fee_unit_limit: priorityFee.unitLimit,
      priority_fee_unit_price_lamports: priorityFee.unitPrice,
    });
    transactionId = transaction.id;

    logging.info(TAG, "Sell transaction submitted", {
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
      logging.info(TAG, "No curve from sell");
      return [
        null,
        {
          type: "SDK_ERROR",
          message: PUMP_FUN_ERRORS.ERROR_NO_CURVE_AFTER_SELL,
        } as SDKError,
      ];
    }

    logging.info(TAG, "Sell operation completed", {
      signature,
      curveExists: !!curve,
    });

    return [
      {
        transactionResult: res.results,
        curve,
        signature,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to sell token", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred during sell";

    if (transactionId) {
      await transactionRepo.update(transactionId, {
        status: TransactionStatus.FAILED,
        error_message: errorMessage,
      });
    }

    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
