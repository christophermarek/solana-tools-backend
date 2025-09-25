import {
  Context,
  Middleware,
  Next,
} from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";

interface ErrorWithStatus extends Error {
  status?: number;
}

export function createErrorHandler(): Middleware {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err: unknown) {
      const requestId = logging.getRequestId(ctx);
      const status = err instanceof Error
        ? (err as ErrorWithStatus).status || 500
        : 500;
      const message = err instanceof Error
        ? err.message
        : "Internal Server Error";

      ctx.response.status = status;
      ctx.response.body = {
        success: false,
        message,
        ...((Deno.env.get("NODE_ENV") === "devnet" ||
          Deno.env.get("NODE_ENV") === "testnet") &&
          { stack: err instanceof Error ? err.stack : undefined }),
      };

      logging.error(requestId, `[${status}] ${message}`, err);
    }
  };
}
