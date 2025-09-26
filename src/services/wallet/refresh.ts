import solanaService from "../solana/_index.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { RefreshBalancesResult } from "./_types.ts";

export async function refreshWalletBalances(
  walletIds: number[],
  requestId?: string | undefined,
): Promise<[RefreshBalancesResult, null] | [null, WalletErrors]> {
  try {
    logging.info(
      requestId ?? TAG,
      `Refreshing balances for ${walletIds.length} wallets`,
    );

    const results: RefreshBalancesResult["wallets"] = [];
    let successful = 0;
    let failed = 0;

    for (const walletId of walletIds) {
      try {
        const dbKeypair = await keypairRepo.findById(
          walletId,
          requestId ?? TAG,
        );
        if (!dbKeypair) {
          results.push({
            id: walletId,
            publicKey: "Unknown",
            success: false,
            error: "Wallet not found",
          });
          failed++;
          continue;
        }

        const balance = await solanaService.getBalanceByPublicKey(
          dbKeypair.public_key,
          requestId ?? TAG,
        );

        if (balance) {
          results.push({
            id: walletId,
            publicKey: dbKeypair.public_key,
            label: dbKeypair.label,
            success: true,
            balance: {
              solBalance: balance.solBalance,
              wsolBalance: balance.wsolBalance,
              totalBalance: balance.totalBalance,
              lastBalanceUpdate: balance.lastUpdated,
              balanceStatus: balance.balanceStatus,
            },
          });
          successful++;
        } else {
          results.push({
            id: walletId,
            publicKey: dbKeypair.public_key,
            label: dbKeypair.label,
            success: false,
            error: "Failed to fetch balance",
          });
          failed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : String(error);
        results.push({
          id: walletId,
          publicKey: "Unknown",
          success: false,
          error: errorMessage,
        });
        failed++;
      }
    }

    logging.info(
      requestId ?? TAG,
      `Successfully refreshed ${successful}/${walletIds.length} wallet balances`,
    );

    return [{
      successful,
      failed,
      wallets: results,
    }, null];
  } catch (error) {
    logging.error(requestId ?? TAG, "Failed to refresh wallet balances", error);
    return [null, WALLET_ERRORS.ERROR_REFRESHING_BALANCES];
  }
}

export default {
  refreshWalletBalances,
};
