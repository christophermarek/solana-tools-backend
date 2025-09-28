import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import { AppContext, AppState, getContext } from "./_context.ts";
import { ResponseUtil } from "../routes/response.ts";
import { MiddlewareError, MiddlewareErrorType } from "./error-handler.ts";

export function createAuthenticateAdminRoleMiddleware(): Middleware<
  AppState
> {
  return async (ctx: AppContext, next: Next) => {
    const [contextData, contextError] = getContext(ctx);

    if (contextError) {
      logging.error("system", contextError.message, contextError);
      return ResponseUtil.serverError(ctx, contextError);
    }

    const [requestId] = contextData;

    if (!ctx.state.telegramUser) {
      const error = new MiddlewareError(
        MiddlewareErrorType.USER_NOT_AUTHENTICATED,
        401,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    if (ctx.state.telegramUser.role_id !== "admin") {
      const error = new MiddlewareError(
        MiddlewareErrorType.ADMIN_ROLE_REQUIRED,
        403,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    logging.info(requestId, "Admin role authenticated");
    await next();
  };
}
