import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";

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
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Selling token", params);

  try {
    const [sdk, error] = getSDK();
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
      return [null, PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN];
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
      logging.error(
        TAG,
        "Failed to sell token",
        new Error(res.error as string),
      );
      return [null, PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN];
    }

    if (!res.results) {
      logging.info(TAG, "No results from sell");
      return [null, PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN];
    }

    const curve = await sdk.token.getBondingCurveAccount(mint.publicKey);
    if (!curve) {
      logging.info(TAG, "No curve from sell");
      return [null, PUMP_FUN_ERRORS.ERROR_GETTING_BONDING_CURVE_ACCOUNT];
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
    return [null, PUMP_FUN_ERRORS.ERROR_SELLING_TOKEN];
  }
}
