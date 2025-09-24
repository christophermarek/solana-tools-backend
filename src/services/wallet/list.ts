import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { ListWalletsParams, ListWalletsResult, Wallet } from "./_types.ts";
import { mapWalletFromDb } from "./_utils.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";

export async function listWallets(
  params: ListWalletsParams = {},
  requestId?: string | undefined,
): Promise<[ListWalletsResult, null] | [null, WalletErrors]> {
  const { activeOnly = false, includeBalances = true } = params;

  logging.info(
    requestId ?? TAG,
    `Listing wallets${activeOnly ? " (active only)" : " (including inactive)"}`,
  );

  try {
    const keypairs: DbKeypair[] = activeOnly
      ? await keypairRepo.listActive()
      : await keypairRepo.listAll();

    logging.info(
      requestId ?? TAG,
      `Found ${keypairs.length} wallets${
        activeOnly ? " (active only)" : " (including inactive)"
      }`,
    );

    const wallets: Wallet[] = keypairs.map((kp: DbKeypair) => {
      const wallet: Wallet = mapWalletFromDb(kp);
      if (!includeBalances) {
        return {
          ...wallet,
          solBalance: undefined,
          wsolBalance: undefined,
          totalBalance: undefined,
          lastBalanceUpdate: undefined,
          balanceStatus: undefined,
        };
      }
      return wallet;
    });

    const walletsWithNullBalance = wallets.filter((w) =>
      w.solBalance === null && w.wsolBalance === null
    );

    const meta: ListWalletsResult["meta"] = {
      totalWallets: wallets.length,
      activeWallets: wallets.filter((w) => w.isActive).length,
      inactiveWallets: wallets.filter((w) => !w.isActive).length,
      walletsWithNullBalance: walletsWithNullBalance.length,
      refreshed: false,
    };

    logging.debug(
      requestId ?? TAG,
      `Prepared ${wallets.length} wallet objects for response`,
    );

    return [{ wallets, meta }, null];
  } catch (error) {
    logging.error(requestId ?? TAG, "Failed to list wallets", error);
    return [null, WALLET_ERRORS.ERROR_LISTING_WALLETS];
  }
}

export default {
  listWallets,
};
