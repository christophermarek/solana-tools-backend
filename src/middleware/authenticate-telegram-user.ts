import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import { getUserOrCreate } from "../db/repositories/users.ts";
import { isTelegramUserWhitelisted } from "../db/repositories/whitelist.ts";
import { AppContext, AppState } from "./_context.ts";
import { ResponseUtil } from "../routes/response.ts";
import { MiddlewareError, MiddlewareErrorType } from "./error-handler.ts";

const TAG = "authenticate-telegram-user";
export function createAuthenticateTelegramUserMiddleware(): Middleware<
  AppState
> {
  return async (ctx: AppContext, next: Next) => {
    logging.info(TAG, "Authenticating telegram user");

    if (!ctx.state?.requestId) {
      logging.error(
        TAG,
        "Missing request ID in telegram user middleware",
        new Error("Missing request ID"),
      );
      return ResponseUtil.serverError(ctx, new Error("Missing request ID"));
    }

    const requestId = ctx.state.requestId;

    const telegramId = ctx.request.headers.get("x-telegram-id");
    if (!telegramId) {
      const error = new MiddlewareError(
        MiddlewareErrorType.MISSING_X_TELEGRAM_ID_HEADER,
        401,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    try {
      const user = await getUserOrCreate(telegramId, requestId);
      const isWhitelisted = await isTelegramUserWhitelisted(
        user.telegram_id,
        requestId,
      );
      if (!isWhitelisted) {
        const error = new MiddlewareError(
          MiddlewareErrorType.USER_NOT_WHITELISTED,
          403,
        );
        logging.warn(requestId, error.message, error);

        return ResponseUtil.serverError(ctx, error);
      }

      ctx.state.telegramUser = user;
      await next();
    } catch (error) {
      const serverError = new MiddlewareError(
        MiddlewareErrorType.FAILED_TO_AUTHENTICATE_TELEGRAM_USER,
        500,
      );
      logging.error(requestId, serverError.message, error);
      return ResponseUtil.serverError(ctx, error);
    }
  };
}
