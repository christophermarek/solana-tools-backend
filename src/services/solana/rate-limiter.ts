import * as logging from "../../utils/logging.ts";
import { getConfig } from "../../utils/env.ts";
import { TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";
import { RateLimitResult } from "./_types.ts";
type RequestWindow = {
  method: string;
  timestamps: number[];
};

const _requestWindows: Map<string, RequestWindow> = new Map();
let _requestsPerSecond = 5; // Default
let _enabled = true;

export async function init(): Promise<[boolean, null] | [null, SolanaErrors]> {
  try {
    const config = await getConfig();
    _requestsPerSecond = config.RPC_REQUESTS_PER_SECOND;
    _enabled = config.NODE_ENV === "mainnet" || _requestsPerSecond > 0;

    logging.info(TAG, "Initialized Solana RPC rate limiter", {
      enabled: _enabled,
      requestsPerSecond: _requestsPerSecond,
      environment: config.NODE_ENV,
    });

    return [true, null];
  } catch (error) {
    logging.error(TAG, "Failed to initialize rate limiter", error);
    return [null, SOLANA_ERRORS.ERROR_SERVICE_INITIALIZATION_FAILED];
  }
}

export function canMakeRequest(
  method: string,
  requestId?: string,
): [RateLimitResult, null] | [null, SolanaErrors] {
  if (!_enabled) {
    return [{ canMakeRequest: true, waitTimeMs: 0 }, null];
  }

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey) || { method, timestamps: [] };

  window.timestamps = window.timestamps.filter((ts) => now - ts < 1000);

  const canRequest = window.timestamps.length < _requestsPerSecond;
  const waitTimeMs = canRequest
    ? 0
    : Math.max(0, 1000 - (now - (window.timestamps[0] || now)));

  if (!canRequest && requestId) {
    logging.warn(requestId || TAG, "Rate limit reached for Solana RPC", {
      method,
      currentRate: window.timestamps.length,
      limit: _requestsPerSecond,
      waitTimeMs,
    });
  }

  return [{ canMakeRequest: canRequest, waitTimeMs }, null];
}

export function recordRequest(method: string): void {
  if (!_enabled) return;

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey) || { method, timestamps: [] };

  window.timestamps.push(now);

  window.timestamps = window.timestamps.filter((ts) => now - ts < 1000);

  _requestWindows.set(windowKey, window);
}

export function getWaitTime(method: string): number {
  if (!_enabled) return 0;

  const now = Date.now();
  const windowKey = method;
  const window = _requestWindows.get(windowKey);

  if (!window || window.timestamps.length < _requestsPerSecond) {
    return 0;
  }

  const oldestTimestamp = window.timestamps.sort((a, b) => a - b)[0];

  return Math.max(0, 1000 - (now - oldestTimestamp));
}

export async function waitForRateLimit(
  method: string,
  requestId?: string,
): Promise<[void, null] | [null, SolanaErrors]> {
  if (!_enabled) {
    return [undefined, null];
  }

  const [rateLimitResult, rateLimitError] = canMakeRequest(method, requestId);
  if (rateLimitError) {
    return [null, rateLimitError];
  }

  if (rateLimitResult.canMakeRequest) {
    recordRequest(method);
    return [undefined, null];
  }

  const waitTimeMs = rateLimitResult.waitTimeMs;

  if (waitTimeMs > 0) {
    if (requestId) {
      logging.debug(requestId, "Waiting for rate limit", {
        method,
        waitTimeMs,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
  }

  recordRequest(method);
  return [undefined, null];
}

export default {
  init,
  canMakeRequest,
  recordRequest,
  getWaitTime,
  waitForRateLimit,
};
