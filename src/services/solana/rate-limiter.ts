import * as logging from "../../utils/logging.ts";
import { initializeConfig } from "../../utils/config.ts";
// Types for rate limiter
type RequestWindow = {
  method: string;
  timestamps: number[];
};

// Private variables
const _requestWindows: Map<string, RequestWindow> = new Map();
let _requestsPerSecond = 5; // Default
let _enabled = true;

/**
 * Initialize the rate limiter
 */
export async function init(): Promise<void> {
  const config = await initializeConfig();
  _requestsPerSecond = config.RPC_REQUESTS_PER_SECOND;
  _enabled = config.NODE_ENV === "production" || _requestsPerSecond > 0;

  logging.info("system", "Initialized Solana RPC rate limiter", {
    enabled: _enabled,
    requestsPerSecond: _requestsPerSecond,
    environment: config.NODE_ENV,
  });
}

/**
 * Check if a request can be made for the given method
 */
export function canMakeRequest(method: string, requestId?: string): boolean {
  if (!_enabled) return true;

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey) || { method, timestamps: [] };

  // Remove timestamps older than 1 second
  window.timestamps = window.timestamps.filter((ts) => now - ts < 1000);

  // Check if we're under the limit
  const canRequest = window.timestamps.length < _requestsPerSecond;

  if (!canRequest && requestId) {
    logging.warn(requestId || "system", "Rate limit reached for Solana RPC", {
      method,
      currentRate: window.timestamps.length,
      limit: _requestsPerSecond,
      waitTimeMs: 1000 - (now - (window.timestamps[0] || now)),
    });
  }

  return canRequest;
}

/**
 * Record a request for the given method
 */
export function recordRequest(method: string): void {
  if (!_enabled) return;

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey) || { method, timestamps: [] };

  // Add current timestamp
  window.timestamps.push(now);

  // Remove timestamps older than 1 second
  window.timestamps = window.timestamps.filter((ts) => now - ts < 1000);

  // Update the window
  _requestWindows.set(windowKey, window);
}

/**
 * Get the time to wait before making another request
 */
export function getWaitTime(method: string): number {
  if (!_enabled) return 0;

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey);

  if (!window || window.timestamps.length < _requestsPerSecond) {
    return 0;
  }

  // Sort timestamps to get the oldest one
  const oldestTimestamp = window.timestamps.sort((a, b) => a - b)[0];

  // Calculate time to wait until the oldest timestamp is more than 1 second old
  return Math.max(0, 1000 - (now - oldestTimestamp));
}

/**
 * Wait until a request can be made
 */
export async function waitForRateLimit(
  method: string,
  requestId?: string,
): Promise<void> {
  if (!_enabled) return;

  // Check if we need to wait
  if (canMakeRequest(method, requestId)) {
    recordRequest(method);
    return;
  }

  // Calculate wait time
  const waitTimeMs = getWaitTime(method);

  if (waitTimeMs > 0) {
    if (requestId) {
      logging.debug(requestId, "Waiting for rate limit", {
        method,
        waitTimeMs,
      });
    }

    // Wait for the required time
    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));

    // Record the request
    recordRequest(method);
  } else {
    // We're good to go, record the request
    recordRequest(method);
  }
}

export default {
  init,
  canMakeRequest,
  recordRequest,
  getWaitTime,
  waitForRateLimit,
};
