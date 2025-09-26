import * as connectionService from "./connection.ts";
import * as rateLimiter from "./rate-limiter.ts";
import * as balanceService from "./balance.ts";
import * as logging from "../../utils/logging.ts";
import { TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";
import { ServiceInitResult } from "./_types.ts";

export * from "./_constants.ts";
export * from "./_errors.ts";
export * from "./_types.ts";
export * from "./_utils.ts";
export * from "./balance.ts";
export * from "./connection.ts";
export * from "./rate-limiter.ts";
export * from "./server-startup-check.ts";
export * from "./wait-for-blocks.ts";

export async function init(): Promise<
  [ServiceInitResult, null] | [null, SolanaErrors]
> {
  try {
    logging.info(TAG, "Initializing Solana services...");

    const [_rateLimiterResult, rateLimiterError] = await rateLimiter.init();
    if (rateLimiterError) {
      return [null, rateLimiterError];
    }

    const [_connectionResult, connectionError] = await connectionService.init();
    if (connectionError) {
      return [null, connectionError];
    }

    const [connectionValid, validationError] = await connectionService
      .validateConnection();
    if (validationError) {
      return [null, validationError];
    }

    if (!connectionValid) {
      return [null, SOLANA_ERRORS.ERROR_CONNECTION_INVALID];
    }

    logging.info(TAG, "Solana services initialized successfully", {
      connectionValid,
    });

    return [{ success: true, connectionValid }, null];
  } catch (error) {
    logging.error(TAG, "Failed to initialize Solana services", error);
    return [null, SOLANA_ERRORS.ERROR_SERVICE_INITIALIZATION_FAILED];
  }
}

export function shutdown(): void {
  connectionService.shutdown();
}

export { getConnection, validateConnection } from "./connection.ts";

export {
  getBalanceByPublicKey,
  getSolBalance,
  getTotalSolBalance,
  getWsolBalance,
} from "./balance.ts";

export { waitForRateLimit } from "./rate-limiter.ts";

export { lamportsToSol, solToLamports } from "./_utils.ts";

export default {
  init,
  shutdown,

  getConnection: connectionService.getConnection,
  validateConnection: connectionService.validateConnection,

  getSolBalance: balanceService.getSolBalance,
  getWsolBalance: balanceService.getWsolBalance,
  getTotalSolBalance: balanceService.getTotalSolBalance,
  getBalanceByPublicKey: balanceService.getBalanceByPublicKey,

  waitForRateLimit: rateLimiter.waitForRateLimit,
};
