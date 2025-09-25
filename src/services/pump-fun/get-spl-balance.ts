import * as connectionService from "../solana/connection.ts";
import * as logging from "../../utils/logging.ts";
import { PublicKey } from "@solana/web3.js";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TAG,
  TOKEN_PROGRAM_ID,
} from "./_constants.ts";
import { SolanaErrors } from "../solana/_errors.ts";

// SPL is short for Solana Program Library
export async function getSPLBalance(
  wallet: PublicKey,
  mint: PublicKey,
): Promise<[number, null] | [null, PumpFunErrors | SolanaErrors]> {
  logging.info(TAG, "Getting SPL token balance");
  try {
    const [connection, connectionError] = await connectionService
      .getConnection();
    if (connectionError) {
      return [null, connectionError];
    }

    logging.info(TAG, "Wallet: ", wallet.toString());
    logging.info(TAG, "Mint: ", mint.toString());

    const ata = PublicKey.findProgramAddressSync(
      [
        wallet.toBuffer(),
        new PublicKey(TOKEN_PROGRAM_ID).toBuffer(),
        mint.toBuffer(),
      ],
      new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
    )[0];

    const info = await connection.getTokenAccountBalance(ata).catch(() => null);
    const balance = info ? Number(info.value.amount) : 0;

    logging.info(TAG, "Balance retrieved successfully", { balance });

    return [balance, null];
  } catch (error) {
    logging.error(TAG, "Failed to get SPL token balance", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while getting SPL balance";
    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
