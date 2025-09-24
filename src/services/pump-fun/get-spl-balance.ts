import * as connectionService from "../solana/connection.ts";
import * as logging from "../../utils/logging.ts";
import { PublicKey } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TAG,
  TOKEN_PROGRAM_ID,
} from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";

// SPL is short for Solana Program Library
export async function getSPLBalance(
  wallet: PublicKey,
  mint: PublicKey,
): Promise<[number, null] | [null, PumpFunErrors]> {
  logging.info(TAG, "Getting SPL token balance");
  try {
    const connection = await connectionService.getConnection();

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
    return [null, PUMP_FUN_ERRORS.ERROR_GETTING_SPL_BALANCE];
  }
}
