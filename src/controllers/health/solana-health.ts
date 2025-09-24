import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  getActiveRpcUrl,
  getConnectionStatus,
} from "../../services/solana/connection.ts";

export const solanaHealthCheck: RouterMiddleware<string> = (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Solana health check endpoint accessed");

  try {
    const connectionStatus = getConnectionStatus();
    const activeRpcUrl = getActiveRpcUrl();

    const healthyConnections = connectionStatus.filter((status) =>
      status.healthy
    );
    const totalConnections = connectionStatus.length;
    const isHealthy = healthyConnections.length > 0;

    const solanaHealth = {
      status: isHealthy ? "healthy" : "unhealthy",
      activeRpcUrl,
      totalConnections,
      healthyConnections: healthyConnections.length,
      connections: connectionStatus.map((status) => ({
        url: status.url,
        healthy: status.healthy,
        latencyMs: status.latencyMs,
        lastChecked: new Date(status.lastChecked).toISOString(),
        errorCount: status.errorCount,
        lastError: status.lastError,
      })),
    };

    logging.info(requestId, "Solana health check completed", {
      status: solanaHealth.status,
      activeRpcUrl,
      healthyConnections: healthyConnections.length,
      totalConnections,
    });

    ResponseUtil.success(ctx, solanaHealth);
  } catch (error) {
    logging.error(requestId, "Error during Solana health check", error);

    const errorResponse = {
      status: "error",
      activeRpcUrl: "",
      totalConnections: 0,
      healthyConnections: 0,
      connections: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };

    ResponseUtil.serverError(ctx, errorResponse);
  }
};
