import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import { getUserOrCreate } from "../db/repositories/users.ts";
import { isTelegramUserWhitelisted } from "../db/repositories/whitelist.ts";
import { AppContext, AppState } from "./_context.ts";

export function createAuthenticateTelegramUserMiddleware(): Middleware<
  AppState
> {
  return async (ctx: AppContext, next: Next) => {
    const requestId = logging.getRequestId(ctx);

    const telegramId = ctx.request.headers.get("x-telegram-id");
    if (!telegramId) {
      logging.warn(requestId, "Missing X-TELEGRAM-ID header");
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Missing X-TELEGRAM-ID header",
      };
      return;
    }

    try {
      const user = await getUserOrCreate(telegramId, requestId);
      const isWhitelisted = await isTelegramUserWhitelisted(
        user.telegram_id,
        requestId,
      );
      if (!isWhitelisted) {
        logging.warn(requestId, `User ${user.telegram_id} is not whitelisted`);
        ctx.response.status = 403;
        ctx.response.body = {
          success: false,
          message: "User not whitelisted",
        };
        return;
      }

      ctx.state.telegramUser = user;
      await next();
    } catch (error) {
      logging.error(
        requestId,
        `Failed to authenticate telegram user ${telegramId}`,
        error,
      );
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: "Failed to authenticate user",
      };
    }
  };
}
