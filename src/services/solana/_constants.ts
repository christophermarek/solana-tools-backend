export const SOLANA_ERROR_MESSAGES = {
  TOO_LITTLE_SOL_RECEIVED:
    "Slippage too low. Try increasing slippage or reducing trade size. Price impact may be too high.",
  INSUFFICIENT_FUNDS:
    "Insufficient funds for this transaction. Please check your wallet balance.",
  TRANSACTION_FAILED:
    "Transaction failed. Please try again with different parameters.",
  SLIPPAGE_EXCEEDED:
    "Slippage tolerance exceeded. Try increasing slippage or reducing trade size.",
  INVALID_AMOUNT: "Invalid amount specified. Please check your input values.",
} as const;

export type SolanaErrorMessage =
  typeof SOLANA_ERROR_MESSAGES[keyof typeof SOLANA_ERROR_MESSAGES];

export function parseSolanaErrorLogs(
  errorMessage: string | Error | object,
): string {
  let errorString: string;
  if (typeof errorMessage === "string") {
    errorString = errorMessage;
  } else if (errorMessage instanceof Error) {
    errorString = errorMessage.message;
  } else {
    errorString = JSON.stringify(errorMessage);
  }

  let cleanErrorMessage = errorString;

  if (errorString.includes("TooLittleSolReceived")) {
    cleanErrorMessage = SOLANA_ERROR_MESSAGES.TOO_LITTLE_SOL_RECEIVED;
  } else if (
    errorString.includes("insufficient lamports") ||
    errorString.includes("insufficient funds")
  ) {
    cleanErrorMessage = SOLANA_ERROR_MESSAGES.INSUFFICIENT_FUNDS;
  } else if (errorString.includes("slippage")) {
    cleanErrorMessage = SOLANA_ERROR_MESSAGES.SLIPPAGE_EXCEEDED;
  } else if (errorString.includes("custom program error")) {
    const logMatch = errorString.match(/Error Message: ([^.]+)\./);
    if (logMatch) {
      cleanErrorMessage = logMatch[1];
    }
  }

  return cleanErrorMessage;
}

export const TAG = "solana-service";
export const DEFAULT_RPC_TIMEOUT_MS = 30000;
export const DEFAULT_RPC_REQUESTS_PER_SECOND = 5;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;
export const MAX_BLOCKS_TO_WAIT = 100;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const COMMITMENT_LEVEL = "confirmed";
export const WELL_KNOWN_ADDRESSES = {
  SYSTEM_PROGRAM: "11111111111111111111111111111111",
  NATIVE_MINT: "So11111111111111111111111111111111111111112",
} as const;
