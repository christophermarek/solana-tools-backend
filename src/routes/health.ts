import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import { ResponseUtil } from "./response.ts";

const router = new Router();

router.get("/health", (ctx) => {
  const requestId = logging.getRequestId(ctx);
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
});

export const healthRouter = router;
