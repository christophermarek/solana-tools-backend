import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getConfig } from "../utils/env.ts";
import * as logging from "../utils/logging.ts";
import { AppContext, AppState } from "./_context.ts";
import { ResponseUtil } from "../routes/response.ts";
import { MiddlewareError, MiddlewareErrorType } from "./error-handler.ts";

const TAG = "authenticate-api-client";
export function createAuthenticateApiClientMiddleware(): Middleware<AppState> {
  return async (ctx: AppContext, next: Next) => {
    logging.info(TAG, "Authenticating API client");
    if (!ctx.state?.requestId) {
      logging.error(
        TAG,
        "Missing request ID in API client middleware",
        new Error("Missing request ID"),
      );
      return ResponseUtil.serverError(ctx, new Error("Missing request ID"));
    }

    const requestId = ctx.state.requestId;
    const authHeader = ctx.request.headers.get("authorization");
    if (!authHeader) {
      const error = new MiddlewareError(
        MiddlewareErrorType.MISSING_AUTHORIZATION_HEADER,
        401,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    const config = getConfig();
    if (authHeader !== config.CLIENT_API_KEY) {
      const error = new MiddlewareError(
        MiddlewareErrorType.INVALID_API_KEY,
        401,
      );
      logging.error(requestId, error.message, error);
      return ResponseUtil.serverError(ctx, error);
    }

    await next();
  };
}
