/**
 * Transaction service types
 */

/**
 * Transaction destination types
 */
export type DestinationType = "INTERNAL" | "EXTERNAL";

/**
 * Transaction token types
 */
export type TokenType = "SOL" | "WSOL" | "SPL";

/**
 * Transaction status types
 */
export type TransactionStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "CANCELLED";

/**
 * Transaction destination (either internal wallet or external address)
 */
export interface TransactionDestination {
  type: DestinationType;
  walletId?: number;
  address?: string;
}

/**
 * Parameters for creating a draft transaction
 */
export interface CreateDraftTransactionParams {
  fromWalletId: number;
  destination: TransactionDestination;
  amount: number; // In SOL (will be converted to lamports)
  tokenType: TokenType;
}

/**
 * Parameters for submitting a transaction
 */
export interface SubmitTransactionParams {
  transactionId: number;
  priorityFee?: number; // Optional priority fee in microlamports
}

/**
 * Swap data object
 */
export interface SwapData {
  fromToken: string;
  toToken: string;
  expectedAmountOut: number;
  minimumAmountOut?: number;
  actualAmountOut?: number | null;
  slippageBps: number;
  price: number;
  priceImpact: number;
}

/**
 * Transaction object returned to API
 */
export interface Transaction {
  id: number;
  fromWalletId: number | null;
  fromWalletPublicKey: string | null;
  destination: {
    type: DestinationType;
    walletId?: number;
    walletPublicKey?: string;
    address?: string;
  };
  amount: number; // In lamports
  displayAmount: number; // In SOL
  feeAmount: number | null; // In lamports
  displayFee: number | null; // In SOL
  tokenType: TokenType;
  status: TransactionStatus;
  signature: string | null;
  createdAt: Date;
  updatedAt: Date;
  errorMessage: string | null;
  isExternal: boolean;
  totalCost: number | null; // In lamports (amount + fee)
  displayTotalCost: number | null; // In SOL
  swapData?: SwapData; // Optional swap-related data
}

/**
 * Transaction history query params
 */
export interface TransactionHistoryParams {
  walletId?: number;
  status?: TransactionStatus;
  tokenType?: TokenType;
  limit?: number;
  offset?: number;
}

/**
 * Fee estimate result
 */
export interface FeeEstimate {
  baseFee: number; // In lamports
  priorityFee: number; // In lamports
  totalFee: number; // In lamports
}
