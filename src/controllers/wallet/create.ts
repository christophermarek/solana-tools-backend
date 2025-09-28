import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import walletService from "../../services/wallet/_index.ts";
import { CreateWalletsPayload, CreateWalletsResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppState,
  getContext,
} from "../../middleware/_context.ts";

export const createWallets: RouterMiddleware<
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
    `Creating new wallets for user ${telegramUser.telegram_id}`,
  );

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as CreateWalletsPayload;
    const { count = 1, label } = body;

    const result = await walletService.createWallets(
      { count, label },
      requestId,
    );

    const responseData: CreateWalletsResponse = {
      wallets: result.wallets,
      meta: {
        requested: count,
        created: result.wallets.length,
        errorCount: result.errors.length,
        errors: result.errors,
      },
    };

    if (result.errors.length > 0) {
      logging.warn(
        requestId,
        `Created ${result.wallets.length}/${count} wallets with ${result.errors.length} errors`,
      );
      ResponseUtil.success<CreateWalletsResponse>(ctx, responseData, 206);
    } else {
      logging.info(
        requestId,
        `Successfully created ${result.wallets.length} wallets`,
      );
      ResponseUtil.created<CreateWalletsResponse>(ctx, responseData);
    }
    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error creating wallets", error);
    ResponseUtil.serverError(ctx, error);
  }
};
