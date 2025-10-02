import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as pumpfunMintsRepo from "../../db/repositories/pumpfun-mints.ts";
import { ListPumpfunMintsResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { AppContext, AppState, getContext } from "../../middleware/_context.ts";

export const listPumpfunMints: RouterMiddleware<
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

  logging.info(
    requestId,
    `Listing pumpfun mints for user ${telegramUser.telegram_id}`,
  );

  try {
    const mints = await pumpfunMintsRepo.listByTelegramUserId(
      telegramUser.telegram_id,
      requestId,
    );

    const responseData: ListPumpfunMintsResponse = {
      mints,
      meta: {
        total: mints.length,
        count: mints.length,
      },
    };

    ResponseUtil.success(ctx, responseData);

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error listing pumpfun mints", error);
    ResponseUtil.serverError(ctx, error);
  }
};
