import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import solanaService from "../../services/solana/_index.ts";

export const solanaHealthCheck: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Solana health check endpoint accessed");

  try {
    const [connection, connectionError] = await solanaService.getConnection();

    if (connectionError || !connection) {
      const errorResponse = {
        status: "unhealthy",
        activeRpcUrl: "",
        totalConnections: 0,
        healthyConnections: 0,
        connections: [],
        error: connectionError || "Connection failed",
      };

      logging.warn(requestId, "Solana connection unhealthy", {
        error: connectionError,
      });
      ResponseUtil.success(ctx, errorResponse);
      return;
    }

    const [isValid, validationError] = await solanaService.validateConnection();

    const isHealthy = isValid && !validationError;
    const activeRpcUrl = connection.rpcEndpoint;

    const solanaHealth = {
      status: isHealthy ? "healthy" : "unhealthy",
      activeRpcUrl,
      totalConnections: 1,
      healthyConnections: isHealthy ? 1 : 0,
      connections: [{
        url: activeRpcUrl,
        healthy: isHealthy,
        latencyMs: null,
        lastChecked: new Date().toISOString(),
        errorCount: validationError ? 1 : 0,
        lastError: validationError || null,
      }],
    };

    logging.info(requestId, "Solana health check completed", {
      status: solanaHealth.status,
      activeRpcUrl,
      healthyConnections: solanaHealth.healthyConnections,
      totalConnections: solanaHealth.totalConnections,
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
