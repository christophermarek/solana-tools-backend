import { PumpFunSDK } from "pumpdotfun-repumped-sdk";
import { Connection } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getConfig } from "../../utils/env.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { PUMP_FUN_ERRORS, PumpFunErrors } from "./errors.ts";
import * as logging from "../../utils/logging.ts";
import { TAG } from "./constants.ts";

let sdk: PumpFunSDK | null = null;

export function getSDK(): [PumpFunSDK, null] | [null, PumpFunErrors] {
  if (!sdk) {
    const [sdk, error] = init();
    if (error) {
      return [null, error];
    }
    return [sdk, null];
  }
  return [sdk, null];
}

export function clearSDK(): void {
  sdk = null;
}

function init(): [PumpFunSDK, null] | [
  null,
  PumpFunErrors,
] {
  logging.info(TAG, "Initializing Pump Fun SDK");
  try {
    const connection = new Connection(getConfig().RPC_URL, "confirmed");
    const keypair = keypairRepo.toKeypair(
      getConfig().PUMP_FUN_WALLET_PRIVATE_KEY,
    );

    if (!keypair) {
      logging.error(TAG, "Error creating keypair", {
        error: PUMP_FUN_ERRORS.ERROR_CREATING_KEYPAIR,
      });
      return [null, PUMP_FUN_ERRORS.ERROR_CREATING_KEYPAIR];
    }

    const wallet = new Wallet(keypair);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    const _sdk = new PumpFunSDK(provider);

    sdk = _sdk;
    return [sdk, null];
  } catch (error) {
    logging.error(TAG, "Error initializing Pump Fun SDK", error);
    return [null, PUMP_FUN_ERRORS.ERROR_INITIALIZING_SDK];
  }
}
