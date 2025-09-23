import { Connection, PublicKey } from "@solana/web3.js";
import * as logging from "../../utils/logging.ts";
import { getConfig } from "../../utils/env.ts";

type ConnectionStatus = {
  url: string;
  healthy: boolean;
  lastChecked: number;
  latencyMs?: number;
  errorCount: number;
  lastError?: string;
};

const _connections: Map<string, Connection> = new Map();
const _connectionStatus: Map<string, ConnectionStatus> = new Map();
let _activeConnectionUrl: string | null = null;
let _healthCheckInterval: number | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Initialize Solana connections pool
 */
export function init(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = _initializeConnections();
  return _initPromise;
}

/**
 * Internal function to initialize connections
 */
async function _initializeConnections(): Promise<void> {
  let rpcUrls: string[] = [];
  const config = await getConfig();

  // Determine which Helius RPC endpoint to use based on NODE_ENV
  const isProduction = config.NODE_ENV === "production";
  const heliusRpcUrl = isProduction
    ? config.HELIUS_MAINNET_RPC
    : config.HELIUS_DEVNET_RPC;

  // Set Helius RPC as the primary endpoint
  if (heliusRpcUrl) {
    logging.info(
      "system",
      `Using Helius ${
        isProduction ? "mainnet" : "devnet"
      } RPC as primary endpoint`,
      {
        url: heliusRpcUrl,
        environment: config.NODE_ENV,
      },
    );
    rpcUrls.push(heliusRpcUrl);
  }

  // Check if a direct RPC URL is provided (secondary priority)
  if (config.RPC_URL && !rpcUrls.includes(config.RPC_URL)) {
    logging.info("system", "Adding direct RPC URL as fallback endpoint", {
      url: config.RPC_URL,
    });
    rpcUrls.push(config.RPC_URL);
  }

  // Add any additional RPC URLs as additional fallbacks
  if (config.RPC_URLS.length > 0) {
    const additionalUrls = config.RPC_URLS.filter((url) =>
      !rpcUrls.includes(url)
    );
    if (additionalUrls.length > 0) {
      logging.info("system", "Adding additional fallback RPC endpoints", {
        count: additionalUrls.length,
      });
      rpcUrls = [...rpcUrls, ...additionalUrls];
    }
  }

  if (rpcUrls.length === 0) {
    throw new Error(
      "No RPC URLs configured. Please set RPC_URLS or HELIUS_MAINNET_RPC/HELIUS_DEVNET_RPC in environment variables.",
    );
  }

  logging.info("system", "Initializing Solana connection pool", {
    endpoints: rpcUrls.length,
    primary: rpcUrls[0],
    environment: config.NODE_ENV,
    timeout: config.RPC_TIMEOUT_MS,
  });

  // Clear existing connections
  _connections.clear();
  _connectionStatus.clear();

  // Create connections for each URL
  for (const url of rpcUrls) {
    const connection = new Connection(url, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: config.RPC_TIMEOUT_MS,
    });

    _connections.set(url, connection);
    _connectionStatus.set(url, {
      url,
      healthy: false, // Will be updated by health check
      lastChecked: 0,
      errorCount: 0,
    });
  }

  // Set the first URL as active by default
  _activeConnectionUrl = rpcUrls[0];

  // Setup automatic health checks
  await setupHealthChecks();

  // Run initial health check
  await checkConnectionHealth();
}

/**
 * Setup periodic health checks
 */
async function setupHealthChecks(): Promise<void> {
  const config = await getConfig();

  // Clear existing interval if any
  if (_healthCheckInterval !== null) {
    clearInterval(_healthCheckInterval);
  }

  // Setup new interval
  _healthCheckInterval = setInterval(
    () => {
      checkConnectionHealth().catch((error) => {
        logging.error("system", "Error running RPC health check", error);
      });
    },
    config.RPC_HEALTH_CHECK_INTERVAL_MS,
  );

  // Node.js compatibility check for unref
  if (typeof _healthCheckInterval === "number") {
    // Deno doesn't support unref on timers (only Node.js does)
    // Skip this in Deno environment
  } else if (_healthCheckInterval && "unref" in _healthCheckInterval) {
    // @ts-ignore: Node.js specific API
    _healthCheckInterval.unref();
  }
}

/**
 * Check health of all connections and update active connection if needed
 */
export async function checkConnectionHealth(): Promise<void> {
  if (_connections.size === 0) {
    logging.warn("system", "No RPC connections available for health check");
    return;
  }

  let foundHealthy = false;

  for (const [url, connection] of _connections.entries()) {
    const status = _connectionStatus.get(url) || {
      url,
      healthy: false,
      lastChecked: 0,
      errorCount: 0,
    };

    try {
      // Measure connection latency
      const startTime = performance.now();
      await connection.getSlot();
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      // Update status
      const wasHealthy = status.healthy;
      status.healthy = true;
      status.lastChecked = Date.now();
      status.latencyMs = latencyMs;
      status.errorCount = 0;
      status.lastError = undefined;

      _connectionStatus.set(url, status);
      foundHealthy = true;

      // Log health status change
      if (!wasHealthy) {
        logging.info(
          "system",
          "RPC endpoint health status changed to healthy",
          {
            endpoint: url,
            latencyMs,
          },
        );
      }

      // If current active connection is unhealthy, switch to this one
      if (
        !_activeConnectionUrl ||
        !_connectionStatus.get(_activeConnectionUrl)?.healthy
      ) {
        if (_activeConnectionUrl !== url) {
          const previousUrl = _activeConnectionUrl;
          _activeConnectionUrl = url;
          logging.warn("system", "Failover to alternate RPC endpoint", {
            from: previousUrl || "none",
            to: url,
            reason: "Previous endpoint unhealthy or not set",
          });
        }
      }
    } catch (error) {
      // Update status as unhealthy
      const wasHealthy = status.healthy;
      status.healthy = false;
      status.lastChecked = Date.now();
      status.errorCount++;
      status.lastError = error instanceof Error ? error.message : String(error);

      _connectionStatus.set(url, status);

      // Log health status change
      if (wasHealthy) {
        logging.warn(
          "system",
          "RPC endpoint health status changed to unhealthy",
          {
            endpoint: url,
            errorCount: status.errorCount,
            error: status.lastError,
          },
        );
      }

      // If this is the active connection, try to find another healthy one
      if (_activeConnectionUrl === url) {
        failover();
      }
    }
  }

  // If no healthy connections found, log critical error
  if (!foundHealthy) {
    logging.error("system", "No healthy RPC connections available", {
      connectionCount: _connections.size,
      checkedAt: new Date().toISOString(),
    });
  }
}

/**
 * Failover to another healthy connection
 */
function failover(): boolean {
  // Find a healthy connection
  for (const [url, status] of _connectionStatus.entries()) {
    if (status.healthy && url !== _activeConnectionUrl) {
      const previousUrl = _activeConnectionUrl;
      _activeConnectionUrl = url;
      logging.warn("system", "Failover to alternate RPC endpoint", {
        from: previousUrl || "none",
        to: url,
        reason: "Previous endpoint unhealthy",
      });
      return true;
    }
  }

  // If no healthy connection found, keep the current one
  return false;
}

/**
 * Get the active Solana connection
 */
export async function getConnection(): Promise<Connection> {
  if (!_activeConnectionUrl) {
    await init();

    if (!_activeConnectionUrl) {
      throw new Error(
        "No active Solana RPC connection available. All endpoints may be down.",
      );
    }
  }

  logging.info("system", "Getting active Solana connection", {
    url: _activeConnectionUrl,
  });

  return _connections.get(_activeConnectionUrl)!;
}

/**
 * Get connection status for all RPC endpoints
 */
export function getConnectionStatus(): Array<ConnectionStatus> {
  return Array.from(_connectionStatus.values());
}

/**
 * Get the active RPC URL
 */
export function getActiveRpcUrl(): string {
  return _activeConnectionUrl || "";
}

/**
 * Validate connection can retrieve balance
 */
export async function validateConnection(
  publicKey?: PublicKey,
): Promise<boolean> {
  try {
    const connection = await getConnection();
    // Use provided public key or system program address as a fallback
    const testKey = publicKey ||
      new PublicKey("11111111111111111111111111111111");

    // Simple getBalance check
    await connection.getBalance(testKey);
    return true;
  } catch (error) {
    logging.error("system", "Failed to validate Solana connection", error);
    return false;
  }
}

/**
 * Cleanup resources
 */
export function shutdown(): void {
  if (_healthCheckInterval !== null) {
    clearInterval(_healthCheckInterval);
    _healthCheckInterval = null;
  }

  _connections.clear();
  _connectionStatus.clear();
  _activeConnectionUrl = null;
  _initPromise = null;
}

export default {
  init,
  getConnection,
  checkConnectionHealth,
  validateConnection,
  getConnectionStatus,
  getActiveRpcUrl,
  shutdown,
};
