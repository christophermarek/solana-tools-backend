import * as logging from "../../utils/logging.ts";
import * as solanaService from "./index.ts";
import * as connectionService from "./connection.ts";
import { PublicKey } from "@solana/web3.js";

/**
 * Run diagnostics and validation on Solana service during server startup
 */
export async function validateSolanaServiceOnStartup(): Promise<boolean> {
  try {
    logging.info("system", "🔍 Running Solana service startup validation...");

    // Check connection status
    await validateConnections();

    // Verify balance functionality
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

/**
 * Validate Solana connections for all configured RPC endpoints
 */
async function validateConnections(): Promise<void> {
  try {
    const status = connectionService.getConnectionStatus();
    const healthyCount = status.filter((endpoint) => endpoint.healthy).length;

    logging.info("system", "Solana RPC connection status", {
      total: status.length,
      healthy: healthyCount,
      unhealthy: status.length - healthyCount,
    });

    if (healthyCount === 0) {
      throw new Error("No healthy Solana RPC endpoints found");
    }

    // Check connection can be retrieved
    const connection = await solanaService.getConnection();
    if (!connection) {
      throw new Error("Failed to retrieve Solana connection");
    }

    logging.info("system", "✅ Solana connection validation passed");
  } catch (error) {
    logging.error("system", "Failed to validate Solana connections", error);
    throw error;
  }
}

/**
 * Validate balance functionality works with RPC connection
 */
async function validateBalanceFunctionality(): Promise<void> {
  try {
    // Use a well-known address (e.g., Solana system program)
    const knownAddress = new PublicKey("11111111111111111111111111111111");

    logging.info("system", "Testing Solana balance fetch functionality");

    // Test SOL balance fetch
    const balance = await solanaService.getSolBalance(knownAddress);

    logging.info("system", "Successfully fetched Solana balance", {
      address: knownAddress.toString(),
      balanceSol: solanaService.lamportsToSol(balance),
    });

    logging.info("system", "✅ Solana balance functionality validation passed");
  } catch (error) {
    logging.error(
      "system",
      "Failed to validate Solana balance functionality",
      error,
    );
    throw error;
  }
}

export default {
  validateSolanaServiceOnStartup,
};
