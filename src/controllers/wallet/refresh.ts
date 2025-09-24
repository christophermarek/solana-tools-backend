import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import walletService from "../../services/wallet/_index.ts";
import { RefreshWalletBalancesPayload } from "../../schemas/wallet.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const refreshWalletBalance: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as RefreshWalletBalancesPayload;
    const { walletIds } = body;

    logging.info(
      requestId,
      `Refreshing balances for ${walletIds.length} wallets`,
    );

    const [result, error] = await walletService.refreshWalletBalances(
      walletIds,
      requestId,
    );

    if (error) {
      logging.error(
        requestId,
        `Failed to refresh wallet balances: ${error}`,
        error,
      );
      ResponseUtil.serverError(
        ctx,
        new Error(`Failed to refresh wallet balances: ${error}`),
      );
      return;
    }

    logging.info(
      requestId,
      `Successfully refreshed ${result.successful} wallet balances, ${result.failed} failed`,
    );

    ResponseUtil.success(ctx, {
      refreshed: result.successful,
      failed: result.failed,
      total: result.successful + result.failed,
    });

    logging.debug(
      requestId,
      "Response body with refresh results",
      ctx.response.body,
    );
  } catch (error) {
    logging.error(
      requestId,
      "Error refreshing wallet balances",
      error,
    );
    ResponseUtil.serverError(ctx, error);
  }
};
