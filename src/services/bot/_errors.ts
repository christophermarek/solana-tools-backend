export const BOT_ERRORS = {
  ERROR_VOLUME_BOT_FAILED: "Volume bot execution failed",
  ERROR_INSUFFICIENT_BALANCE: "Insufficient balance for bot operation",
  ERROR_BLOCK_WAIT_FAILED: "Failed to wait for blocks",
  ERROR_INTERVAL_WAIT_FAILED: "Failed to wait for interval",
  ERROR_BUY_OPERATION_FAILED: "Buy operation failed",
  ERROR_SELL_OPERATION_FAILED: "Sell operation failed",
  ERROR_UNKNOWN_VOLUME_BOT: "Unknown error occurred during volume bot execution",
} as const;

export interface BotError {
  type: "BOT_ERROR";
  message: string;
}

export type BotErrors =
  | typeof BOT_ERRORS[keyof typeof BOT_ERRORS]
  | BotError;
