import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { listAvailableBots } from "../../services/bot/list.ts";

export const listBots: RouterMiddleware<string> = (ctx) => {
  const requestId = getRequestId(ctx);
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
