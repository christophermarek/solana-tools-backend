import { getSDK } from "./_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import { SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import { getConnection } from "../solana/connection.ts";

export interface SellInstructionsParams {
  sellAmountSol?: number;
  sellAmountSPL?: number;
}

export async function getSellInstructionsByTokenAmount(
  seller: Keypair,
  mint: PublicKey,
  sellTokenAmount: number,
  slippageBasisPoints: bigint = SLIPPAGE_BPS,
): Promise<[Transaction, null] | [null, PumpFunErrors]> {
  logging.info(TAG, "Getting sell instructions by token amount");
  try {
    const [sdk, error] = getSDK(seller);

    if (error) {
      return [null, error];
    }

    logging.info(TAG, "Sell instructions parameters", {
      seller: seller.publicKey.toString(),
      mint: mint.toString(),
      sellTokenAmount,
      slippageBps: slippageBasisPoints.toString(),
    });

    const sellAmountLamports = BigInt(sellTokenAmount);

    const transaction = await sdk.trade.getSellInstructionsByTokenAmount(
      seller.publicKey,
      mint,
      sellAmountLamports,
      slippageBasisPoints,
    );

    const [connection, connectionError] = await getConnection();
    if (connectionError) {
      logging.error(
        TAG,
        "Failed to get connection for transaction preparation",
        connectionError,
      );
      return [null, {
        type: "SDK_ERROR",
        message: `Failed to get connection: ${connectionError}`,
      }];
    }

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = seller.publicKey;
    transaction.sign(seller);

    logging.info(TAG, "Sell instructions created and prepared successfully");

    return [transaction, null];
  } catch (error) {
    logging.error(TAG, "Failed to get sell instructions", error);
    return [null, PUMP_FUN_ERRORS.ERROR_UNKNOWN_GET_SELL_INSTRUCTIONS];
  }
}
