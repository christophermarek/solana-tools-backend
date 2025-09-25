import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import { SolanaErrors } from "../solana/_errors.ts";

export interface SellTokenParams {
  sellAmountSol?: number;
  sellAmountSPL?: number;
}

export async function sell(
  seller: Keypair,
  mint: Keypair,
  params: SellTokenParams,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    curve: BondingCurveAccount;
  }, null] | [null, PumpFunErrors | SolanaErrors]
> {
  logging.info(TAG, "Selling token", params);

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

    logging.info(TAG, "Sell parameters", {
      seller: seller.publicKey.toString(),
      mint: mint.publicKey.toString(),
      sellType,
      sellAmount,
      sellAmountLamports: sellAmountLamports.toString(),
      slippageBps: SLIPPAGE_BPS.toString(),
      priorityFee,
    });

    const res = await sdk.trade.sell(
      seller,
      mint.publicKey,
      sellAmountLamports,
      SLIPPAGE_BPS,
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

    logging.info(TAG, "Sell successful");

    return [
      {
        transactionResult: res.results,
        curve,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to sell token", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred during sell";
    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
