export const WALLET_ERRORS = {
  ERROR_CREATING_WALLET: "Error creating wallet",
  ERROR_IMPORTING_WALLET: "Error importing wallet",
  ERROR_GETTING_WALLET: "Error getting wallet",
  ERROR_GETTING_WALLET_BALANCE: "Error getting wallet balance",
  ERROR_LISTING_WALLETS: "Error listing wallets",
  ERROR_BULK_EDITING_WALLETS: "Error bulk editing wallets",
  ERROR_REFRESHING_BALANCES: "Error refreshing wallet balances",
  ERROR_WALLET_NOT_FOUND: "Wallet not found",
  ERROR_INVALID_PUBLIC_KEY: "Invalid public key format",
  ERROR_INVALID_SECRET_KEY: "Invalid secret key format",
  ERROR_INSUFFICIENT_BALANCE: "Insufficient balance",
  ERROR_BALANCE_FETCH_FAILED: "Failed to fetch balance from blockchain",
  ERROR_DATABASE_OPERATION_FAILED: "Database operation failed",
} as const;

export type WalletErrors = typeof WALLET_ERRORS[keyof typeof WALLET_ERRORS];
