import { getWalletBalances } from "../solana/index.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { RefreshBalancesResult } from "./types.ts";

export async function refreshWalletBalances(
  walletIds: number[],
  requestId?: string | undefined,
): Promise<[RefreshBalancesResult, null] | [null, WalletErrors]> {
  logging.info(
    requestId ?? TAG,
    `Refreshing balances for ${walletIds.length} wallets`,
  );

  try {
    const balances = await getWalletBalances(walletIds, requestId ?? TAG);

    logging.info(
      requestId ?? TAG,
      `Successfully refreshed ${balances.length}/${walletIds.length} wallet balances`,
    );

    return [{
      successful: balances.length,
      failed: walletIds.length - balances.length,
    }, null];
  } catch (error) {
    logging.error(requestId ?? TAG, "Failed to refresh wallet balances", error);
    return [null, WALLET_ERRORS.ERROR_REFRESHING_BALANCES];
  }
}

export default {
  refreshWalletBalances,
};
