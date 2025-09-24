import { PumpFunSDK } from "pumpdotfun-repumped-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { getConfig } from "../../utils/env.ts";
import { PumpFunErrors, SDKError } from "./_errors.ts";
import * as logging from "../../utils/logging.ts";
import { TAG } from "./_constants.ts";

const sdkCache = new Map<string, PumpFunSDK>();

export function getSDK(
  wallet: Keypair,
): [PumpFunSDK, null] | [null, PumpFunErrors] {
  const walletKey = wallet.publicKey.toString();

  if (sdkCache.has(walletKey)) {
    return [sdkCache.get(walletKey)!, null];
  }

  const [sdk, error] = createSDK(wallet);
  if (error) {
    return [null, error];
  }

  sdkCache.set(walletKey, sdk);
  return [sdk, null];
}

export function clearSDK(): void {
  sdkCache.clear();
}

export function clearSDKForWallet(wallet: Keypair): void {
  const walletKey = wallet.publicKey.toString();
  sdkCache.delete(walletKey);
}

function createSDK(
  wallet: Keypair,
): [PumpFunSDK, null] | [null, PumpFunErrors] {
  logging.info(TAG, "Creating Pump Fun SDK for wallet", {
    wallet: wallet.publicKey.toString(),
  });

  try {
    const connection = new Connection(getConfig().RPC_URL, "confirmed");
    const anchorWallet = new Wallet(wallet);
    const provider = new AnchorProvider(connection, anchorWallet, {
      commitment: "confirmed",
    });
    const sdk = new PumpFunSDK(provider);

    return [sdk, null];
  } catch (error) {
    logging.error(TAG, "Error creating Pump Fun SDK", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while initializing SDK";
    return [null, { type: "SDK_ERROR", message: errorMessage } as SDKError];
  }
}
