import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { getClient } from "../../db/client.ts";

export const dbHealthCheck: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Database health check endpoint accessed");

  try {
    const db = getClient();

    const startTime = performance.now();
    await db.prepare("SELECT 1 as test").get();
    const endTime = performance.now();
    const responseTimeMs = Math.round(endTime - startTime);

    const dbInfo = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
    ).all();
    const tableCount = dbInfo.length;

    const dbHealth = {
      status: "healthy",
      responseTimeMs,
      tableCount,
      connection: "active",
      database: "sqlite",
      timestamp: new Date().toISOString(),
    };

    logging.info(requestId, "Database health check completed", {
      status: dbHealth.status,
      responseTimeMs,
      tableCount,
    });

    ResponseUtil.success(ctx, dbHealth);
  } catch (error) {
    logging.error(requestId, "Error during database health check", error);

    const errorResponse = {
      status: "unhealthy",
      responseTimeMs: 0,
      tableCount: 0,
      connection: "failed",
      database: "sqlite",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown database error",
    };

    ResponseUtil.serverError(ctx, errorResponse);
  }
};
