import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import walletService from "../../services/wallet/_index.ts";
import {
  RefreshWalletBalancesPayload,
  RefreshWalletBalancesResponse,
} from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const refreshWalletBalance: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<RefreshWalletBalancesPayload>
> = async (ctx: AppRouterContext<RefreshWalletBalancesPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;

  try {
    const { walletIds } = ctx.state.bodyData;

    logging.info(
      requestId,
      `Refreshing balances for ${walletIds.length} wallets`,
    );

    const [result, error] = await walletService.refreshWalletBalances(
      { walletIds, ownerUserId: telegramUser.id },
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

    const responseData: RefreshWalletBalancesResponse = {
      meta: {
        refreshed: result.successful,
        failed: result.failed,
        total: result.successful + result.failed,
      },
      wallets: result.wallets,
    };
    ResponseUtil.success(ctx, responseData);

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
