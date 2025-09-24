import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { listWallets as listWalletsService } from "../../services/wallet/_index.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const listWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);

  const url = new URL(ctx.request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";

  logging.info(
    requestId,
    `Listing wallets${
      activeOnly ? " (active only)" : " (including inactive)"
    } with cached balances`,
  );

  try {
    const [result, error] = await listWalletsService(
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

    ResponseUtil.success(ctx, {
      wallets: result.wallets,
      meta: {
        ...result.meta,
        activeOnly,
      },
    });

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error listing wallets", error);
    ResponseUtil.serverError(ctx, error);
  }
};
