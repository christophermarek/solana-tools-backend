import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { BulkEditWalletsPayload } from "../../schemas/wallet.schema.ts";
import logging, {
  formatWalletResponse,
  getRequestId,
} from "../../utils/logging.ts";

export const bulkEditWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Bulk editing wallets");

  const body = await ctx.request.body({ type: "json" })
    .value as BulkEditWalletsPayload;
  const { walletIds, updates } = body;

  logging.info(requestId, `Bulk editing ${walletIds.length} wallets`, {
    walletCount: walletIds.length,
    updates,
  });

  try {
    const results = {
      successful: [] as {
        id: number;
        publicKey: string;
        wallet: ReturnType<typeof formatWalletResponse>;
      }[],
      failed: [] as { id: number; error: string }[],
    };

    for (const id of walletIds) {
      try {
        const wallet = await keypairRepo.findByIdIncludingInactive(id);

        if (!wallet) {
          logging.info(requestId, `Wallet with ID ${id} not found`);
          results.failed.push({ id, error: `Wallet with ID ${id} not found` });
          continue;
        }

        let walletUpdated = false;

        if (updates.label !== undefined) {
          logging.debug(
            requestId,
            `Updating label for wallet ${id} to "${updates.label}"`,
          );
          await keypairRepo.updateLabel(id, updates.label);
          walletUpdated = true;
        }

        if (updates.isActive !== undefined) {
          if (updates.isActive && !wallet.is_active) {
            logging.debug(requestId, `Activating wallet ${id}`);
            await keypairRepo.reactivateById(id);
            walletUpdated = true;
          } else if (!updates.isActive && wallet.is_active) {
            logging.debug(requestId, `Deactivating wallet ${id}`);
            await keypairRepo.deactivateById(id);
            walletUpdated = true;
          } else {
            logging.debug(
              requestId,
              `Wallet ${id} is already ${
                updates.isActive ? "active" : "inactive"
              }`,
            );
          }
        }

        const updatedWallet = await keypairRepo.findByIdIncludingInactive(id);
        if (!updatedWallet) {
          throw new Error(`Failed to retrieve updated wallet with ID ${id}`);
        }

        results.successful.push({
          id,
          publicKey: updatedWallet.public_key,
          wallet: formatWalletResponse(updatedWallet),
        });

        logging.info(
          requestId,
          `Successfully updated wallet ${id}${
            walletUpdated ? "" : " (no changes needed)"
          }`,
        );
      } catch (walletError) {
        logging.error(
          requestId,
          `Error updating wallet with ID ${id}`,
          walletError,
        );
        results.failed.push({
          id,
          error: walletError instanceof Error
            ? walletError.message
            : String(walletError),
        });
      }
    }

    logging.info(
      requestId,
      `Bulk edit completed. Success: ${results.successful.length}, Failed: ${results.failed.length}`,
    );

    ctx.response.status = Status.OK;
    ctx.response.body = {
      success: true,
      results: {
        total: walletIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        successfulWallets: results.successful,
        failedWallets: results.failed,
      },
    };

    logging.debug(requestId, "Bulk edit response", {
      successCount: results.successful.length,
      failCount: results.failed.length,
    });
  } catch (error) {
    logging.error(requestId, "Error during bulk wallet edit", error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to perform bulk wallet edit",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};
