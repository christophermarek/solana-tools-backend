import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const healthCheck: RouterMiddleware<string> = (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Health check endpoint accessed");

  ResponseUtil.success(ctx, {
    status: "ok",
    timestamp: new Date().toISOString(),
    routes: {
      wallet: true,
      transaction: true,
      strategy: true,
    },
    environment: Deno.env.get("NODE_ENV") || "development",
  });
};
