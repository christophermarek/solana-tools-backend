import { getSDK } from "./_index.ts";
import * as logging from "../../utils/logging.ts";
import { Keypair, Transaction } from "@solana/web3.js";
import { PumpFunErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { PUMP_FUN_ERRORS } from "./_errors.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";

export async function getCreateInstructions(
  creator: Keypair,
  metadata: CreateTokenMetadata,
): Promise<[Transaction, null] | [null, PumpFunErrors]> {
  logging.info(TAG, "Getting create token instructions");
  try {
    const [sdk, error] = getSDK(creator);

    if (error) {
      return [null, error];
    }

    logging.info(TAG, "Create instructions parameters", {
      creator: creator.publicKey.toString(),
      metadata,
    });

    const mint = Keypair.generate();
    const transaction = await sdk.trade.getCreateInstructions(
      creator.publicKey,
      metadata.name,
      metadata.symbol,
      metadata.description || "",
      mint,
    );

    logging.info(TAG, "Create instructions created successfully");

    return [transaction, null];
  } catch (error) {
    logging.error(TAG, "Failed to get create instructions", error);
    return [null, PUMP_FUN_ERRORS.ERROR_UNKNOWN_GET_CREATE_INSTRUCTIONS];
  }
}
