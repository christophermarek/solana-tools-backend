import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getConfig } from "../utils/env.ts";
import * as logging from "../utils/logging.ts";
import { AppContext, AppState } from "./_context.ts";

export function createAuthenticateApiClientMiddleware(): Middleware<AppState> {
  return async (ctx: AppContext, next: Next) => {
    const requestId = logging.getRequestId(ctx);

    const authHeader = ctx.request.headers.get("authorization");
    console.log("authHeader", authHeader);
    if (!authHeader) {
      logging.warn(requestId, "Missing Authorization header");
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "UNAUTHORIZED",
      };
      return;
    }

    const config = getConfig();
    console.log("config.CLIENT_API_KEY", config.CLIENT_API_KEY);
    if (authHeader !== config.CLIENT_API_KEY) {
      console.log("Invalid API key provided");
      logging.warn(requestId, "Invalid API key provided");
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "UNAUTHORIZED",
      };
      return;
    }

    await next();
  };
}
