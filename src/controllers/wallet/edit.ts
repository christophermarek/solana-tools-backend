import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import walletService from "../../services/wallet/_index.ts";
import { BulkEditWalletsPayload, BulkEditWalletsResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppState,
  getContext,
} from "../../middleware/_context.ts";

export const bulkEditWallets: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = async (ctx: AppRouterContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;

  logging.info(
    requestId,
    `Bulk editing wallets for user ${telegramUser.telegram_id}`,
  );

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as BulkEditWalletsPayload;
    const { walletIds, updates } = body;

    const [result, error] = await walletService.bulkEditWallets(
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

    const responseData: BulkEditWalletsResponse = {
      results: {
        total: walletIds.length,
        successful: result.successful.length,
        failed: result.failed.length,
        successfulWallets: result.successful,
        failedWallets: result.failed,
      },
    };
    ResponseUtil.success(ctx, responseData);

    logging.debug(requestId, "Bulk edit response", {
      successCount: result.successful.length,
      failCount: result.failed.length,
    });
  } catch (error) {
    logging.error(requestId, "Error during bulk wallet edit", error);
    ResponseUtil.serverError(ctx, error);
  }
};
