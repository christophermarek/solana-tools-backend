import { Application } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { loadEnv } from "./utils/env.ts";
import { initializeDb } from "./db/client.ts";
import { registerRoutes } from "./routes/index.ts";
import * as solanaService from "./services/solana/index.ts";
import { validateSolanaServiceOnStartup } from "./services/solana/server-startup-check.ts";
import { createDetailedLogger } from "./middleware/logging.ts";
import { createErrorHandler } from "./middleware/error-handler.ts";
import { createRequestIdMiddleware } from "./middleware/request-id.ts";
import { createResponseTimeMiddleware } from "./middleware/response-time.ts";
import * as logging from "./utils/logging.ts";

const app = new Application();
app.use(createErrorHandler());
app.use(oakCors());
app.use(createRequestIdMiddleware());

console.log("Registering detailed logging middleware...");
app.use(createDetailedLogger({
  logRequestBody: true,
  logResponseBody: true,
  logHeaders: true,
  maxBodyLength: 2000,
  useColors: true,
}));

app.use(createResponseTimeMiddleware());

registerRoutes(app);

async function initialize() {
  logging.info("system", "Starting application initialization...");

  await loadEnv();
  await initializeDb();

  await solanaService.init();

  const solanaReady = await validateSolanaServiceOnStartup();
  if (!solanaReady) {
    logging.warn(
      "system",
      "⚠️ Solana service validation failed, but continuing startup",
    );
  }

  const port = 8000;
  logging.info("system", `Server running on http://localhost:${port}`);

  await app.listen({ port });
}

initialize().catch((error: unknown) => {
  logging.error("system", "Failed to start server:", error);
  Deno.exit(1);
});
