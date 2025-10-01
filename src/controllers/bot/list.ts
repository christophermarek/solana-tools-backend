import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { listAvailableBots } from "../../services/bot/list.ts";
import { AppContext, AppState, getContext } from "../../middleware/_context.ts";

export const listBots: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = (ctx: AppContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, _telegramUser] = contextData;
  logging.info(requestId, "Listing available bots");

  try {
    const bots = listAvailableBots();

    logging.info(requestId, `Found ${bots.length} available bots`);

    ResponseUtil.success(ctx, { bots });

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error listing bots", error);
    ResponseUtil.serverError(ctx, error);
  }
};
