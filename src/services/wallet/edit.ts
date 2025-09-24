import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { BulkEditParams, BulkEditResult, Wallet } from "./types.ts";
import { mapWalletFromDb } from "./_utils.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";

export async function bulkEditWallets(
  params: BulkEditParams,
  requestId?: string | undefined,
): Promise<[BulkEditResult, null] | [null, WalletErrors]> {
  const { walletIds, updates } = params;

  logging.info(requestId ?? TAG, `Bulk editing ${walletIds.length} wallets`, {
    walletCount: walletIds.length,
    updates,
  });

  const results: BulkEditResult = {
    successful: [],
    failed: [],
  };

  for (const id of walletIds) {
    try {
      const wallet: DbKeypair | null = await keypairRepo
        .findByIdIncludingInactive(id);

      if (!wallet) {
        logging.info(requestId ?? TAG, `Wallet with ID ${id} not found`);
        results.failed.push({
          id,
          error: WALLET_ERRORS.ERROR_WALLET_NOT_FOUND,
        });
        continue;
      }

      let walletUpdated = false;

      if (updates.label !== undefined) {
        logging.debug(
          requestId ?? TAG,
          `Updating label for wallet ${id} to "${updates.label}"`,
        );
        await keypairRepo.updateLabel(id, updates.label);
        walletUpdated = true;
      }

      if (updates.isActive !== undefined) {
        if (updates.isActive && !wallet.is_active) {
          logging.debug(requestId ?? TAG, `Activating wallet ${id}`);
          await keypairRepo.reactivateById(id);
          walletUpdated = true;
        } else if (!updates.isActive && wallet.is_active) {
          logging.debug(requestId ?? TAG, `Deactivating wallet ${id}`);
          await keypairRepo.deactivateById(id);
          walletUpdated = true;
        } else {
          logging.debug(
            requestId ?? TAG,
            `Wallet ${id} is already ${
              updates.isActive ? "active" : "inactive"
            }`,
          );
        }
      }

      const updatedWallet: DbKeypair | null = await keypairRepo
        .findByIdIncludingInactive(id);
      if (!updatedWallet) {
        throw new Error(`Failed to retrieve updated wallet with ID ${id}`);
      }

      const mappedWallet: Wallet = mapWalletFromDb(updatedWallet);
      results.successful.push({
        id,
        publicKey: updatedWallet.public_key,
        wallet: mappedWallet,
      });

      logging.info(
        requestId ?? TAG,
        `Successfully updated wallet ${id}${
          walletUpdated ? "" : " (no changes needed)"
        }`,
      );
    } catch (walletError) {
      logging.error(
        requestId ?? TAG,
        `Error updating wallet with ID ${id}`,
        walletError,
      );
      results.failed.push({
        id,
        error: WALLET_ERRORS.ERROR_BULK_EDITING_WALLETS,
      });
    }
  }

  logging.info(
    requestId ?? TAG,
    `Bulk edit completed. Success: ${results.successful.length}, Failed: ${results.failed.length}`,
  );

  return [results, null];
}

export default {
  bulkEditWallets,
};
