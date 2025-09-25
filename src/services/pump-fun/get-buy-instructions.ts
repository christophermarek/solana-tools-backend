import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import { SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";

export async function getBuyInstructionsBySolAmount(
  buyer: Keypair,
  mint: PublicKey,
  buyAmountSol: number,
  slippageBasisPoints: bigint = SLIPPAGE_BPS,
): Promise<[Transaction, null] | [null, PumpFunErrors]> {
  logging.info(TAG, "Getting buy instructions by SOL amount");
  try {
    const [sdk, error] = getSDK(buyer);

    if (error) {
      return [null, error];
    }

    logging.info(TAG, "Buy instructions parameters", {
      buyer: buyer.publicKey.toString(),
      mint: mint.toString(),
      buyAmountSol,
      slippageBps: slippageBasisPoints.toString(),
    });

    const buyAmountLamports = BigInt(solanaService.solToLamports(buyAmountSol));

    const transaction = await sdk.trade.getBuyInstructionsBySolAmount(
      buyer.publicKey,
      mint,
      buyAmountLamports,
      slippageBasisPoints,
    );

    logging.info(TAG, "Buy instructions created successfully");

    return [transaction, null];
  } catch (error) {
    logging.error(TAG, "Failed to get buy instructions", error);
    return [null, PUMP_FUN_ERRORS.ERROR_UNKNOWN_GET_BUY_INSTRUCTIONS];
  }
}
