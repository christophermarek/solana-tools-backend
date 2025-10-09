import type { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import type { AppContext, AppState } from "./_context.ts";
import { ResponseUtil } from "../routes/response.ts";
import { MiddlewareError, MiddlewareErrorType } from "./error-handler.ts";

const TAG = "authenticate-user-credits";

export function createAuthenticateUserCreditsMiddleware(): Middleware<
  AppState
> {
  return async (ctx: AppContext, next: Next) => {
    logging.info(TAG, "Authenticating user credits");

    if (!ctx.state?.requestId) {
      logging.error(
        TAG,
        "Missing request ID in user credits middleware",
        new Error("Missing request ID"),
      );
      return ResponseUtil.serverError(ctx, new Error("Missing request ID"));
    }

    const requestId = ctx.state.requestId;

    if (!ctx.state.telegramUser) {
      const error = new MiddlewareError(
        MiddlewareErrorType.USER_NOT_AUTHENTICATED,
        401,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    const user = ctx.state.telegramUser;

    if (!user.credits_expire_at) {
      const error = new MiddlewareError(
        MiddlewareErrorType.USER_CREDITS_EXPIRED,
        403,
      );
      logging.warn(requestId, "User has no credits", {
        telegramId: user.telegram_id,
      });
      return ResponseUtil.serverError(ctx, error);
    }

    const now = new Date();
    const creditsExpireAt = new Date(user.credits_expire_at);

    if (now > creditsExpireAt) {
      const error = new MiddlewareError(
        MiddlewareErrorType.USER_CREDITS_EXPIRED,
        403,
      );
      logging.warn(requestId, "User credits have expired", {
        telegramId: user.telegram_id,
        creditsExpireAt: user.credits_expire_at,
        currentTime: now.toISOString(),
      });
      return ResponseUtil.serverError(ctx, error);
    }

    logging.info(requestId, "User credits validated", {
      telegramId: user.telegram_id,
      creditsExpireAt: user.credits_expire_at,
    });

    await next();
  };
}
