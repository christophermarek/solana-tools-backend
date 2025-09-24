import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { bulkEditWallets as bulkEditWalletsService } from "../../services/wallet/_index.ts";
import { BulkEditWalletsPayload } from "../../schemas/wallet.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const bulkEditWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Bulk editing wallets");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as BulkEditWalletsPayload;
    const { walletIds, updates } = body;

    const [result, error] = await bulkEditWalletsService(
      { walletIds, updates },
      requestId,
    );

    if (error) {
      logging.error(requestId, `Failed to bulk edit wallets: ${error}`, error);
      ResponseUtil.serverError(
        ctx,
        new Error(`Failed to bulk edit wallets: ${error}`),
      );
      return;
    }

    logging.info(
      requestId,
      `Bulk edit completed. Success: ${result.successful.length}, Failed: ${result.failed.length}`,
    );

    ResponseUtil.success(ctx, {
      results: {
        total: walletIds.length,
        successful: result.successful.length,
        failed: result.failed.length,
        successfulWallets: result.successful,
        failedWallets: result.failed,
      },
    });

    logging.debug(requestId, "Bulk edit response", {
      successCount: result.successful.length,
      failCount: result.failed.length,
    });
  } catch (error) {
    logging.error(requestId, "Error during bulk wallet edit", error);
    ResponseUtil.serverError(ctx, error);
  }
};
