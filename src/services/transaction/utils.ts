import { PublicKey } from "@solana/web3.js";
import * as logging from "../../utils/logging.ts";
import * as solanaService from "../solana/index.ts";

/**
 * Validate a Solana public key
 */
export function isValidPublicKey(key: string): boolean {
  try {
    new PublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a transaction exists on-chain
 */
export async function checkTransactionOnChain(
  signature: string,
  requestId = "system",
): Promise<{
  exists: boolean;
  confirmed: boolean;
  error?: string;
}> {
  try {
    logging.debug(requestId, `Checking transaction on-chain: ${signature}`);

    const status = await solanaService.getTransactionStatus(
      signature,
      requestId,
    );

    const exists = status.status !== "unknown";
    const confirmed = ["confirmed", "finalized"].includes(status.status);

    logging.debug(requestId, `Transaction status: ${status.status}`, {
      confirmations: status.confirmations,
      error: status.error,
    });

    return {
      exists,
      confirmed,
      error: status.error,
    };
  } catch (error) {
    logging.error(
      requestId,
      `Failed to check transaction on chain: ${signature}`,
      error,
    );
    return {
      exists: false,
      confirmed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format lamports for display (with appropriate decimals)
 */
export function formatSolAmount(lamports: number): string {
  const sol = solanaService.lamportsToSol(lamports);

  // Format with up to 9 decimal places, but trim trailing zeros
  return sol.toFixed(9).replace(/\.?0+$/, "");
}

/**
 * Calculate network fee based on instructions
 * This is a simplified fee calculator that can be used if RPC is unavailable
 */
export function calculateSimplifiedFee(instructionCount: number): number {
  // Base fee for a standard transaction
  const baseFee = 5000;

  // Additional fee per instruction
  const feePerInstruction = 1000;

  // Priority fee (to increase chances of inclusion)
  const priorityFee = 5000;

  return baseFee + (instructionCount * feePerInstruction) + priorityFee;
}

/**
 * Parse transaction error message to a user-friendly format
 */
export function parseTransactionError(error: string): string {
  // Common Solana error patterns and user-friendly translations
  const errorPatterns: Record<string, string> = {
    "insufficient funds": "Insufficient funds to complete this transaction",
    "blockhash not found": "Transaction expired. Please try again",
    "timed out": "Transaction timed out. The network may be congested",
    "Transaction simulation failed": "Transaction rejected by the network",
    "Account does not exist": "Destination account does not exist",
  };

  // Check if any known pattern matches the error message
  for (const [pattern, message] of Object.entries(errorPatterns)) {
    if (error.includes(pattern)) {
      return message;
    }
  }

  // Default error message if no pattern matches
  return "Transaction failed: " + error;
}
