import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import { BulkEditParams, BulkEditResult, Wallet } from "./_types.ts";
import { mapWalletFromDb } from "./_utils.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";

export async function bulkEditWallets(
  params: BulkEditParams,
  requestId?: string | undefined,
): Promise<[BulkEditResult, null] | [null, WalletErrors]> {
  const { walletIds, updates, delete: shouldDelete } = params;

  const operation = shouldDelete ? "delete" : "edit";

  logging.info(
    requestId ?? TAG,
    `Bulk ${operation}ing ${walletIds.length} wallets`,
    {
      walletCount: walletIds.length,
      updates,
      delete: shouldDelete,
    },
  );

  const results: BulkEditResult = {
    successful: [],
    failed: [],
    operation,
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

      if (shouldDelete) {
        logging.debug(requestId ?? TAG, `Deleting wallet ${id}`);
        await keypairRepo.deleteById(id);
        results.successful.push({
          id,
          publicKey: wallet.public_key,
        });
        logging.info(requestId ?? TAG, `Successfully deleted wallet ${id}`);
      } else if (updates !== undefined && updates.label !== undefined) {
        logging.debug(
          requestId ?? TAG,
          `Updating label for wallet ${id} to "${updates.label}"`,
        );
        await keypairRepo.updateLabel(id, updates.label);

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

        logging.info(requestId ?? TAG, `Successfully updated wallet ${id}`);
      } else {
        logging.warn(
          requestId ?? TAG,
          `No valid operation specified for wallet ${id}`,
        );
        results.failed.push({
          id,
          error: WALLET_ERRORS.ERROR_BULK_EDITING_WALLETS,
        });
      }
    } catch (walletError) {
      logging.error(
        requestId ?? TAG,
        `Error ${operation}ing wallet with ID ${id}`,
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
    `Bulk ${operation} completed. Success: ${results.successful.length}, Failed: ${results.failed.length}`,
  );

  return [results, null];
}

export default {
  bulkEditWallets,
};
