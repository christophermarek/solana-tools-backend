import { getSDK } from "./index.ts";
import * as solanaService from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors } from "./errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./constants.ts";
import { PUMP_FUN_ERRORS } from "./errors.ts";

export async function sell(
  seller: Keypair,
  mint: Keypair,
  sellAmountSol: number,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    curve: BondingCurveAccount;
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Selling token");
  try {
    const [sdk, error] = getSDK();
    if (error) {
      return [null, error];
    }

    logging.info(TAG, "Mint: ", mint.publicKey.toString());
    const sellAmountLamports = BigInt(
      solanaService.solToLamports(sellAmountSol),
    );
    const priorityFee = getPriorityFee();
    logging.info(TAG, "Sell parameters", {
      seller: seller.publicKey.toString(),
      mint: mint.publicKey.toString(),
      sellAmountSol,
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
