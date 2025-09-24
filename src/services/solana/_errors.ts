export const SOLANA_ERRORS = {
  ERROR_CONNECTION_FAILED: "Failed to establish Solana connection",
  ERROR_CONNECTION_INVALID: "Invalid Solana connection",
  ERROR_NO_HEALTHY_ENDPOINTS: "No healthy RPC endpoints available",
  ERROR_RPC_REQUEST_FAILED: "RPC request failed",
  ERROR_RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  ERROR_BALANCE_FETCH_FAILED: "Failed to fetch balance",
  ERROR_INVALID_PUBLIC_KEY: "Invalid public key format",
  ERROR_INVALID_ADDRESS: "Invalid address format",
  ERROR_TRANSACTION_FAILED: "Transaction failed",
  ERROR_TRANSACTION_TIMEOUT: "Transaction timeout",
  ERROR_INSUFFICIENT_BALANCE: "Insufficient balance",
  ERROR_TOKEN_ACCOUNT_NOT_FOUND: "Token account not found",
  ERROR_INVALID_AMOUNT: "Invalid amount",
  ERROR_NETWORK_ERROR: "Network error",
  ERROR_SERVICE_INITIALIZATION_FAILED: "Service initialization failed",
  ERROR_HEALTH_CHECK_FAILED: "Health check failed",
} as const;

export type SolanaErrors = typeof SOLANA_ERRORS[keyof typeof SOLANA_ERRORS];
