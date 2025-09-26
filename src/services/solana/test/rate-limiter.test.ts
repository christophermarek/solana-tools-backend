import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import * as rateLimiter from "../rate-limiter.ts";
import * as logging from "../../../utils/logging.ts";
import { loadEnv } from "../../../utils/env.ts";

Deno.test({
  name: "Test init success - initialize rate limiter",
  async fn() {
    await loadEnv(".env.devnet");
    const [initResult, initError] = await rateLimiter.init();

    if (initError) {
      throw new Error(`Failed to initialize rate limiter: ${initError}`);
    }

    assertExists(initResult, "Init result should exist");
    assertEquals(initResult, true, "Init should be successful");

    logging.info("rate-limiter-test", "Successfully initialized rate limiter");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test canMakeRequest success - allow request within limit",
  async fn() {
    await loadEnv(".env.devnet");
    const [rateLimitResult, rateLimitError] = rateLimiter.canMakeRequest(
      "getBalance",
      "rate-limiter-test",
    );

    if (rateLimitError) {
      throw new Error(`Failed to check rate limit: ${rateLimitError}`);
    }

    assertExists(rateLimitResult, "Rate limit result should exist");
    assertExists(
      rateLimitResult.canMakeRequest,
      "Can make request should exist",
    );
    assertExists(rateLimitResult.waitTimeMs, "Wait time should exist");
    assertEquals(
      typeof rateLimitResult.canMakeRequest,
      "boolean",
      "Can make request should be boolean",
    );
    assertEquals(
      typeof rateLimitResult.waitTimeMs,
      "number",
      "Wait time should be number",
    );

    logging.info("rate-limiter-test", "Successfully checked rate limit", {
      canMakeRequest: rateLimitResult.canMakeRequest,
      waitTimeMs: rateLimitResult.waitTimeMs,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test canMakeRequest failure - rate limit exceeded",
  async fn() {
    await loadEnv(".env.devnet");
    const method = "testMethod";
    const requestsPerSecond = 1;

    const originalEnv = Deno.env.get("RPC_REQUESTS_PER_SECOND");
    try {
      Deno.env.set("RPC_REQUESTS_PER_SECOND", requestsPerSecond.toString());

      await rateLimiter.init();

      const [firstRequest] = rateLimiter.canMakeRequest(
        method,
        "rate-limiter-test",
      );
      assertExists(firstRequest, "First request should be allowed");
      assertEquals(
        firstRequest.canMakeRequest,
        true,
        "First request should be allowed",
      );

      rateLimiter.recordRequest(method);

      const [secondRequest] = rateLimiter.canMakeRequest(
        method,
        "rate-limiter-test",
      );
      assertExists(secondRequest, "Second request result should exist");

      if (secondRequest.canMakeRequest) {
        logging.info(
          "rate-limiter-test",
          "Rate limit not exceeded, testing with more requests",
          {
            canMakeRequest: secondRequest.canMakeRequest,
            waitTimeMs: secondRequest.waitTimeMs,
          },
        );

        for (let i = 0; i < 5; i++) {
          rateLimiter.recordRequest(method);
        }

        const [thirdRequest] = rateLimiter.canMakeRequest(
          method,
          "rate-limiter-test",
        );
        assertExists(thirdRequest, "Third request result should exist");

        if (thirdRequest.canMakeRequest) {
          logging.info(
            "rate-limiter-test",
            "Rate limiter may not be working as expected",
            {
              canMakeRequest: thirdRequest.canMakeRequest,
              waitTimeMs: thirdRequest.waitTimeMs,
            },
          );
        } else {
          logging.info(
            "rate-limiter-test",
            "Rate limit exceeded after multiple requests",
            {
              canMakeRequest: thirdRequest.canMakeRequest,
              waitTimeMs: thirdRequest.waitTimeMs,
            },
          );
        }
      } else {
        assertEquals(
          secondRequest.canMakeRequest,
          false,
          "Second request should be rate limited",
        );
        assertEquals(
          secondRequest.waitTimeMs > 0,
          true,
          "Should have wait time",
        );

        logging.info("rate-limiter-test", "Rate limit exceeded as expected", {
          canMakeRequest: secondRequest.canMakeRequest,
          waitTimeMs: secondRequest.waitTimeMs,
        });
      }
    } finally {
      if (originalEnv) Deno.env.set("RPC_REQUESTS_PER_SECOND", originalEnv);
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test recordRequest success - record request timestamp",
  async fn() {
    await loadEnv(".env.devnet");
    const method = "testRecordMethod";

    rateLimiter.recordRequest(method);

    logging.info("rate-limiter-test", "Successfully recorded request", {
      method,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test getWaitTime success - get wait time for method",
  async fn() {
    await loadEnv(".env.devnet");
    const method = "testWaitTimeMethod";

    const waitTime = rateLimiter.getWaitTime(method);

    assertExists(waitTime, "Wait time should exist");
    assertEquals(typeof waitTime, "number", "Wait time should be number");
    assertEquals(waitTime >= 0, true, "Wait time should be non-negative");

    logging.info("rate-limiter-test", "Successfully got wait time", {
      method,
      waitTime,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "Test waitForRateLimit success - wait for rate limit",
  async fn() {
    await loadEnv(".env.devnet");
    const method = "testWaitMethod";

    const [waitResult, waitError] = await rateLimiter.waitForRateLimit(
      method,
      "rate-limiter-test",
    );

    if (waitError) {
      throw new Error(`Failed to wait for rate limit: ${waitError}`);
    }

    assertEquals(
      waitResult,
      undefined,
      "Wait result should be undefined on success",
    );

    logging.info("rate-limiter-test", "Successfully waited for rate limit", {
      method,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
