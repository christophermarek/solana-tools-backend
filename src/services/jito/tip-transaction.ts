import { JitoError, JitoErrors } from "./_errors.ts";
import { getRecommendedTipAmount, TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";
import { getTipAccounts } from "./tip-accounts.ts";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export interface TipTransactionParams {
  from: Keypair;
  tipAmountLamports?: number;
  recentBlockhash: string;
  priority?: "low" | "standard" | "high" | "critical";
}

export interface TipTransactionResult {
  transaction: VersionedTransaction;
  tipAccount: string;
  success: boolean;
  error?: string;
}

export async function createTipTransaction(
  params: TipTransactionParams,
  timeoutMs: number = 10000,
): Promise<[TipTransactionResult, null] | [null, JitoErrors]> {
  const tipAmount = params.tipAmountLamports ??
    getRecommendedTipAmount(params.priority);

  logging.info(TAG, "Creating tip transaction", {
    from: params.from.publicKey.toString(),
    tipAmount,
    priority: params.priority || "standard",
    timeoutMs,
  });

  try {
    const [tipAccountsResult, tipAccountsError] = await getTipAccounts(
      timeoutMs,
    );
    if (tipAccountsError) {
      return [null, tipAccountsError];
    }

    if (tipAccountsResult.tipAccounts.length === 0) {
      return [
        null,
        {
          type: "JITO_ERROR",
          message: "No tip accounts available",
        } as JitoError,
      ];
    }

    const tipAccount = tipAccountsResult.tipAccounts[0];
    const tipAccountPubkey = new PublicKey(tipAccount.account);

    logging.info(TAG, "Using tip account", {
      tipAccount: tipAccount.account,
      mint: tipAccount.mint,
    });

    const tipTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: params.from.publicKey,
        toPubkey: tipAccountPubkey,
        lamports: tipAmount,
      }),
    );

    tipTransaction.recentBlockhash = params.recentBlockhash;
    tipTransaction.feePayer = params.from.publicKey;
    tipTransaction.sign(params.from);

    const tipMessage = new TransactionMessage({
      payerKey: params.from.publicKey,
      recentBlockhash: params.recentBlockhash,
      instructions: tipTransaction.instructions,
    }).compileToV0Message();

    const versionedTipTx = new VersionedTransaction(tipMessage);
    versionedTipTx.sign([params.from]);

    logging.info(TAG, "Tip transaction created successfully", {
      tipAccount: tipAccount.account,
      tipAmount: params.tipAmountLamports,
    });

    return [
      {
        transaction: versionedTipTx,
        tipAccount: tipAccount.account,
        success: true,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to create tip transaction", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while creating tip transaction";
    return [null, { type: "JITO_ERROR", message: errorMessage } as JitoError];
  }
}
