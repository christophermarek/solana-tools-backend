import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import { BondingCurveAccount } from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";

export async function buy(
  buyer: Keypair,
  mint: Keypair,
  buyAmountSol: number,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    curve: BondingCurveAccount;
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Buying token");
  try {
    const [sdk, error] = getSDK(buyer);
    if (error) {
      return [null, error];
    }

    logging.info(TAG, "Mint: ", mint.publicKey.toString());

    const buyAmountLamports = BigInt(solanaService.solToLamports(buyAmountSol));
    const priorityFee = getPriorityFee();

    logging.info(TAG, "Buy parameters", {
      buyer: buyer.publicKey.toString(),
      mint: mint.publicKey.toString(),
      buyAmountSol,
      buyAmountLamports: buyAmountLamports.toString(),
      slippageBps: SLIPPAGE_BPS.toString(),
      priorityFee,
    });

    const res = await sdk.trade.buy(
      buyer,
      mint.publicKey,
      buyAmountLamports,
      SLIPPAGE_BPS,
      priorityFee,
    );

    if (!res.success) {
      logging.error(
        TAG,
        "Failed to buy token",
        new Error(res.error as string),
      );
      return [null, PUMP_FUN_ERRORS.ERROR_BUYING_TOKEN];
    }

    if (!res.results) {
      logging.info(TAG, "No results from buy");
      return [null, PUMP_FUN_ERRORS.ERROR_BUYING_TOKEN];
    }

    const curve = await sdk.token.getBondingCurveAccount(mint.publicKey);
    if (!curve) {
      logging.info(TAG, "No curve from buy");
      return [null, PUMP_FUN_ERRORS.ERROR_GETTING_BONDING_CURVE_ACCOUNT];
    }

    logging.info(TAG, "Buy successful");

    return [
      {
        transactionResult: res.results,
        curve,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to buy token", error);
    return [null, PUMP_FUN_ERRORS.ERROR_BUYING_TOKEN];
  }
}
