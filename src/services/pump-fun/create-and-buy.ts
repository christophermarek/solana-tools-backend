import { getSDK } from "./_index.ts";
import * as solanaService from "../solana/_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, type VersionedTransactionResponse } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import {
  BondingCurveAccount,
  type CreateTokenMetadata,
} from "pumpdotfun-repumped-sdk";
import { getPriorityFee, SLIPPAGE_BPS, TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import * as transactionRepo from "../../db/repositories/transactions.ts";
import { TransactionStatus } from "../../db/repositories/transactions.ts";
import { getSPLBalance } from "./get-spl-balance.ts";
import * as pumpfunMintsRepo from "../../db/repositories/pumpfun-mints.ts";

export async function createAndBuy(
  creator: Keypair,
  tokenMeta: CreateTokenMetadata,
  buyAmountSol: number,
  telegramUserId: string,
  slippageBps?: number,
  priorityFeeOverride?: { unitLimit: number; unitPrice: number },
): Promise<
  [{
    transactionResult: VersionedTransactionResponse;
    mint: Keypair;
    curve: BondingCurveAccount;
    pumpLink: string;
    amountBought: number;
    totalSolSpent: number;
  }, null] | [null, PumpFunErrors]
> {
  logging.info(TAG, "Creating token & first buy");
  let transactionId: number | null = null;

  try {
    const [sdk, error] = getSDK(creator);
    if (error) {
      return [null, error];
    }

    const mint = Keypair.generate();
    const buyAmountLamports = BigInt(solanaService.solToLamports(buyAmountSol));
    const priorityFee = priorityFeeOverride || getPriorityFee();
    const slippage = slippageBps !== undefined
      ? BigInt(slippageBps)
      : SLIPPAGE_BPS;

    logging.info(TAG, "Create and buy parameters", {
      creator: creator.publicKey.toString(),
      mint: mint.publicKey.toString(),
      tokenMeta: {
        name: tokenMeta.name,
        symbol: tokenMeta.symbol,
        description: tokenMeta.description,
        twitter: tokenMeta.twitter,
        telegram: tokenMeta.telegram,
        website: tokenMeta.website,
      },
      buyAmountSol,
      buyAmountLamports: buyAmountLamports.toString(),
      slippageBps: slippage.toString(),
      priorityFee,
    });
    logging.info(TAG, "Mint: ", mint.publicKey.toString());

    const res = await sdk.trade.createAndBuy(
      creator,
      mint,
      tokenMeta,
      buyAmountLamports,
      slippage,
      priorityFee,
    );
    if (!res.success) {
      const errorMessage = typeof res.error === "string"
        ? res.error
        : (res.error instanceof Error
          ? res.error.message
          : JSON.stringify(res.error)) || "Unknown error";

      logging.error(
        TAG,
        "Failed to create and buy",
        new Error(errorMessage),
      );

      if (
        errorMessage.includes("insufficient lamports") ||
        errorMessage.includes("insufficient funds")
      ) {
        const [balanceResult, balanceError] = await solanaService.getSolBalance(
          {
            publicKey: creator.publicKey,
          },
        );
        if (!balanceError) {
          const currentBalance = solanaService.lamportsToSol(
            balanceResult.balance,
          );
          const requiredAmount = buyAmountSol;
          const shortfall = requiredAmount - currentBalance;
          const enhancedError =
            `Insufficient SOL balance. Required: ${requiredAmount} SOL, Available: ${currentBalance} SOL. ` +
            `Shortfall: ${
              shortfall.toFixed(6)
            } SOL. Please fund the wallet with more SOL.`;
          return [
            null,
            { type: "SDK_ERROR", message: enhancedError } as SDKError,
          ];
        }
      }

      return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
    }

    if (!res.results) {
      logging.info(TAG, "No results from create and buy");
      return [null, PUMP_FUN_ERRORS.ERROR_NO_RESULTS_CREATE_AND_BUY];
    }

    const transaction = await transactionRepo.create({
      signature: res.signature,
      sender_public_key: creator.publicKey.toString(),
      status: TransactionStatus.PENDING,
      slot: res.results.slot,
      slippage_bps: Number(slippage),
      priority_fee_unit_limit: priorityFee.unitLimit,
      priority_fee_unit_price_lamports: priorityFee.unitPrice,
    });
    transactionId = transaction.id;

    const curve = await sdk.token.getBondingCurveAccount(mint.publicKey);
    if (!curve) {
      logging.info(TAG, "No curve from create and buy");

      if (transactionId) {
        await transactionRepo.update(transactionId, {
          status: TransactionStatus.FAILED,
          error_message: "No curve from create and buy",
        });
      }

      return [null, PUMP_FUN_ERRORS.ERROR_NO_CURVE_AFTER_CREATE_AND_BUY];
    }

    const pumpLink = `https://pump.fun/${mint.publicKey.toBase58()}`;

    const [finalBalance, balanceError] = await getSPLBalance(
      creator.publicKey,
      mint.publicKey,
    );

    if (balanceError) {
      logging.warn(TAG, "Failed to get final SPL balance", balanceError);
    }

    const amountBought = balanceError ? 0 : finalBalance;

    const transactionFee = res.results.meta?.fee ? res.results.meta.fee : 0;
    const totalSolSpent = buyAmountSol +
      solanaService.lamportsToSol(transactionFee);

    if (transactionId) {
      await transactionRepo.update(transactionId, {
        status: TransactionStatus.CONFIRMED,
        confirmed_at: new Date(),
        commitment_level: "confirmed",
      });
    }

    try {
      await pumpfunMintsRepo.create({
        mint_public_key: mint.publicKey.toString(),
        telegram_user_id: telegramUserId,
      });
      logging.info(TAG, "Mint tracked in database", {
        mint: mint.publicKey.toString(),
        telegramUserId,
      });
    } catch (mintError) {
      logging.warn(TAG, "Failed to track mint in database", mintError);
    }

    logging.info(
      TAG,
      "Created! Pump link:",
      {
        pumpLink,
        amountBought,
        totalSolSpent,
        buyAmountSol,
        transactionFee: solanaService.lamportsToSol(transactionFee),
      },
    );

    return [
      {
        transactionResult: res.results,
        mint,
        curve,
        pumpLink,
        amountBought,
        totalSolSpent,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to create and buy", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred during create and buy";

    if (transactionId) {
      await transactionRepo.update(transactionId, {
        status: TransactionStatus.FAILED,
        error_message: errorMessage,
      });
    }

    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
