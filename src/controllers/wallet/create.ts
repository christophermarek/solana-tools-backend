import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { createWallets as createWalletsService } from "../../services/wallet/_index.ts";
import { CreateWalletsPayload } from "../../schemas/wallet.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const createWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Creating new wallets");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as CreateWalletsPayload;
    const { count = 1, label } = body;

    const result = await createWalletsService(
      { count, label },
      requestId,
    );

    const responseData = {
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
      ResponseUtil.success(ctx, responseData, 206);
    } else {
      logging.info(
        requestId,
        `Successfully created ${result.wallets.length} wallets`,
      );
      ResponseUtil.created(ctx, responseData);
    }
    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error creating wallets", error);
    ResponseUtil.serverError(ctx, error);
  }
};
