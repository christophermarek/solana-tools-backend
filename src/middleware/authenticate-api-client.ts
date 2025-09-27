import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getConfig } from "../utils/env.ts";
import * as logging from "../utils/logging.ts";
import { AppContext, AppState } from "./_context.ts";

export function createAuthenticateApiClientMiddleware(): Middleware<AppState> {
  return async (ctx: AppContext, next: Next) => {
    const requestId = logging.getRequestId(ctx);

    const authHeader = ctx.request.headers.get("authorization");
    if (!authHeader) {
      logging.warn(requestId, "Missing Authorization header");
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Missing Authorization header",
      };
      return;
    }

    const config = getConfig();
    if (authHeader !== config.CLIENT_API_KEY) {
      logging.warn(requestId, "Invalid API key provided");
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Invalid API key",
      };
      return;
    }

    await next();
  };
}
