import * as logging from "../../utils/logging.ts";
import * as solanaService from "./_index.ts";
import { PublicKey } from "@solana/web3.js";
import { TAG } from "./_constants.ts";

export async function validateSolanaServiceOnStartup(): Promise<boolean> {
  try {
    logging.info("system", "🔍 Running Solana service startup validation...");

    await validateConnections();
    await validateBalanceFunctionality();

    logging.info("system", "✅ Solana service validation complete", {
      status: "READY",
      healthy: true,
    });

    return true;
  } catch (error) {
    logging.error("system", "❌ Solana service validation failed", error);
    return false;
  }
}

async function validateConnections(): Promise<void> {
  try {
    const [connection, connectionError] = await solanaService.getConnection();
    if (connectionError || !connection) {
      throw new Error("Failed to retrieve Solana connection");
    }

    logging.info(TAG, "✅ Solana connection validation passed");
  } catch (error) {
    logging.error(TAG, "Failed to validate Solana connection", error);
    throw error;
  }
}

async function validateBalanceFunctionality(): Promise<void> {
  try {
    // Use a well-known address (Solana system program)
    const knownAddress = new PublicKey("11111111111111111111111111111111");

    logging.info(TAG, "Testing Solana balance fetch functionality");

    const [balanceResult, balanceError] = await solanaService.getSolBalance({
      publicKey: knownAddress,
      requestId: TAG,
    });

    if (balanceError) {
      throw new Error(`Failed to fetch balance: ${balanceError}`);
    }

    logging.info(TAG, "Successfully fetched Solana balance", {
      address: knownAddress.toString(),
      balanceSol: solanaService.lamportsToSol(balanceResult.balance),
    });

    logging.info(TAG, "✅ Solana balance functionality validation passed");
  } catch (error) {
    logging.error(
      TAG,
      "Failed to validate Solana balance functionality",
      error,
    );
    throw error;
  }
}

export default {
  validateSolanaServiceOnStartup,
};
