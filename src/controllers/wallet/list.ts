import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import walletService from "../../services/wallet/_index.ts";
import { ListWalletsResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { AppContext, AppState, getContext } from "../../middleware/_context.ts";

export const listWallets: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = async (ctx: AppContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;

  const url = new URL(ctx.request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";

  logging.info(
    requestId,
    `Listing wallets${
      activeOnly ? " (active only)" : " (including inactive)"
    } with cached balances for user ${telegramUser.telegram_id}`,
  );

  try {
    const [result, error] = await walletService.listWallets(
      { activeOnly, includeBalances: true },
      requestId,
    );

    if (error) {
      logging.error(requestId, `Failed to list wallets: ${error}`, error);
      ResponseUtil.serverError(
        ctx,
        new Error(`Failed to list wallets: ${error}`),
      );
      return;
    }

    const responseData: ListWalletsResponse = {
      wallets: result.wallets,
      meta: {
        ...result.meta,
        activeOnly,
      },
    };
    ResponseUtil.success(ctx, responseData);

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error listing wallets", error);
    ResponseUtil.serverError(ctx, error);
  }
};
