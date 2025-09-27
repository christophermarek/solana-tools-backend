import { Application, Context } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { walletRouter } from "./wallet.ts";
import { healthRouter } from "./health.ts";
import { pumpFunRouter } from "./pump-fun.ts";
import { botRouter } from "./bot.ts";
import * as logging from "../utils/logging.ts";
import { ResponseUtil } from "./response.ts";

const notFoundHandler = (ctx: Context) => {
  const requestId = logging.getRequestId(ctx);
  logging.info(
    requestId,
    `404 Not Found: ${ctx.request.method} ${ctx.request.url.pathname}`,
  );
  ResponseUtil.notFound(ctx, `Path not found: ${ctx.request.url.pathname}`);
};

export function registerRoutes(app: Application): void {
  logging.info("system", "Registering routes...");

  logging.info("system", "Registering health routes...");
  app.use(healthRouter.routes());
  app.use(healthRouter.allowedMethods());

  logging.info("system", "Registering wallet routes...");
  app.use(walletRouter.routes());
  app.use(walletRouter.allowedMethods());

  logging.info("system", "Registering pump-fun routes...");
  app.use(pumpFunRouter.routes());
  app.use(pumpFunRouter.allowedMethods());

  logging.info("system", "Registering bot routes...");
  app.use(botRouter.routes());
  app.use(botRouter.allowedMethods());

  logging.info("system", "Registering not found handler...");
  app.use(notFoundHandler);
}
