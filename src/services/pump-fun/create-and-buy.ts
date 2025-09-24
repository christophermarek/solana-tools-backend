import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import {
  BondingCurveAccount,
  type CreateTokenMetadata,
} from "pumpdotfun-repumped-sdk";
import {
  getIsMainnetRpc,
  getPriorityFee,
  SLIPPAGE_BPS,
  TAG,
} from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";

export async function createAndBuy(
  creator: Keypair,
  tokenMeta: CreateTokenMetadata,
  buyAmountSol: number,
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    mint: Keypair;
    curve: BondingCurveAccount;
    pumpLink: string;
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Creating token & first buy");
  try {
    const [sdk, error] = getSDK(creator);
    if (error) {
      return [null, error];
    }

    const mint = Keypair.generate();
    const buyAmountLamports = BigInt(solanaService.solToLamports(buyAmountSol));
    const priorityFee = getPriorityFee();
    logging.info(TAG, "Create and buy parameters", {
      creator: creator.publicKey.toString(),
      mint: mint.publicKey.toString(),
      tokenMeta,
      buyAmountSol,
      buyAmountLamports: buyAmountLamports.toString(),
      slippageBps: SLIPPAGE_BPS.toString(),
      priorityFee,
    });
    logging.info(TAG, "Mint: ", mint.publicKey.toString());

    const res = await sdk.trade.createAndBuy(
      creator,
      mint,
      tokenMeta,
      buyAmountLamports,
      SLIPPAGE_BPS,
      priorityFee,
    );
    if (!res.success) {
      const errorMessage = res.error as string;
      logging.error(
        TAG,
        "Failed to create and buy",
        new Error(errorMessage),
      );
      return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
    }

    if (!res.results) {
      logging.info(TAG, "No results from create and buy");
      return [null, PUMP_FUN_ERRORS.ERROR_NO_RESULTS_CREATE_AND_BUY];
    }

    const curve = await sdk.token.getBondingCurveAccount(mint.publicKey);
    if (!curve) {
      logging.info(TAG, "No curve from create and buy");
      return [null, PUMP_FUN_ERRORS.ERROR_NO_CURVE_AFTER_CREATE_AND_BUY];
    }

    const pumpLink = `https://pump.fun/${mint.publicKey.toBase58()}?cluster=${
      getIsMainnetRpc() ? "mainnet" : "devnet"
    }`;

    logging.info(
      TAG,
      "Created! Pump link:",
      pumpLink,
    );
    if (!getIsMainnetRpc()) {
      logging.info(TAG, "[WARN] pump.fun does not work on devnet RPC");
    }

    return [
      {
        transactionResult: res.results,
        mint,
        curve,
        pumpLink,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to create and buy", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred during create and buy";
    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
