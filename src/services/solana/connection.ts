import { Connection, PublicKey } from "@solana/web3.js";
import * as logging from "../../utils/logging.ts";
import { getConfig } from "../../utils/env.ts";
import { TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";
import { ServiceInitResult } from "./_types.ts";

let _connection: Connection | null = null;
let _initPromise: Promise<void> | null = null;

export async function init(): Promise<
  [ServiceInitResult, null] | [null, SolanaErrors]
> {
  if (_initPromise) {
    await _initPromise;
    return [{ success: true, connectionValid: true }, null];
  }

  try {
    _initPromise = _initializeConnection();
    await _initPromise;
    return [{ success: true, connectionValid: true }, null];
  } catch (error) {
    logging.error(TAG, "Failed to initialize Solana connection", error);
    return [null, SOLANA_ERRORS.ERROR_SERVICE_INITIALIZATION_FAILED];
  }
}

async function _initializeConnection(): Promise<void> {
  const config = await getConfig();

  const heliusRpcUrl = config.HELIUS_RPC_URL;

  const rpcUrl = heliusRpcUrl || config.RPC_URL;

  if (!rpcUrl) {
    throw new Error(
      "No RPC URL configured. Please set RPC_URL or HELIUS_RPC_URL in environment variables.",
    );
  }

  logging.info("system", "Initializing Solana connection", {
    url: rpcUrl,
    environment: config.NODE_ENV,
    timeout: config.RPC_TIMEOUT_MS,
  });

  _connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: config.RPC_TIMEOUT_MS,
  });
}

export async function getConnection(): Promise<
  [Connection, null] | [null, SolanaErrors]
> {
  if (!_connection) {
    const [_initResult, initError] = await init();
    if (initError) {
      return [null, initError];
    }

    if (!_connection) {
      return [null, SOLANA_ERRORS.ERROR_CONNECTION_FAILED];
    }
  }

  return [_connection, null];
}

export async function validateConnection(
  publicKey?: PublicKey,
): Promise<[boolean, null] | [null, SolanaErrors]> {
  try {
    const [connection, connectionError] = await getConnection();
    if (connectionError) {
      return [null, connectionError];
    }

    const testKey = publicKey ||
      new PublicKey("11111111111111111111111111111111");

    await connection.getBalance(testKey);
    return [true, null];
  } catch (error) {
    logging.error(TAG, "Failed to validate Solana connection", error);
    return [null, SOLANA_ERRORS.ERROR_CONNECTION_INVALID];
  }
}

export function shutdown(): void {
  _connection = null;
  _initPromise = null;
}

export default {
  init,
  getConnection,
  validateConnection,
  shutdown,
};
