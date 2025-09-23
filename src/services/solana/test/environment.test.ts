import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";

// Setup and teardown
Deno.test({
  name: "Solana environment configuration tests",
  async fn() {
    // Load environment variables
    const env = await loadEnv();

    // Test required environment variables
    assertRequiredVariables(env);

    // Test RPC configuration
    testRpcConfiguration(env);

    // Test environment-specific settings
    testEnvironmentSpecificSettings(env);

    console.log("✅ Environment configuration tests passed");
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

function assertRequiredVariables(env: any) {
  // Check for required variables
  const requiredVariables = [
    "RPC_URLS",
    "RPC_TIMEOUT_MS",
    "RPC_HEALTH_CHECK_INTERVAL_MS",
    "RPC_REQUESTS_PER_SECOND",
    "NODE_ENV",
    "HELIUS_MAINNET_RPC",
    "HELIUS_DEVNET_RPC",
  ];

  for (const variable of requiredVariables) {
    assertExists(env[variable], `${variable} should be defined`);
  }

  console.log("✅ Required environment variables are defined");
}

function testRpcConfiguration(env: any) {
  // Check RPC URLs
  assertEquals(
    Array.isArray(env.RPC_URLS),
    true,
    "RPC_URLS should be an array",
  );
  assertEquals(
    env.RPC_URLS.length > 0,
    true,
    "At least one RPC URL should be defined",
  );

  // Verify all URLs are valid
  for (const url of env.RPC_URLS) {
    try {
      new URL(url);
      const isHttpsOrLocalhost = url.startsWith("https://") ||
        url.includes("localhost") || url.includes("127.0.0.1");
      assertEquals(
        isHttpsOrLocalhost,
        true,
        `RPC URL should use HTTPS or be localhost: ${url}`,
      );
    } catch (error) {
      throw new Error(`Invalid RPC URL format: ${url}`);
    }
  }

  // Check Helius RPC endpoints
  try {
    new URL(env.HELIUS_MAINNET_RPC);
    assertEquals(
      env.HELIUS_MAINNET_RPC.includes("helius-rpc.com"),
      true,
      "HELIUS_MAINNET_RPC should be a Helius endpoint",
    );
    assertEquals(
      env.HELIUS_MAINNET_RPC.includes("api-key"),
      true,
      "HELIUS_MAINNET_RPC should include an API key",
    );
  } catch (error) {
    throw new Error(
      `Invalid HELIUS_MAINNET_RPC format: ${env.HELIUS_MAINNET_RPC}`,
    );
  }

  try {
    new URL(env.HELIUS_DEVNET_RPC);
    assertEquals(
      env.HELIUS_DEVNET_RPC.includes("helius-rpc.com"),
      true,
      "HELIUS_DEVNET_RPC should be a Helius endpoint",
    );
    assertEquals(
      env.HELIUS_DEVNET_RPC.includes("api-key"),
      true,
      "HELIUS_DEVNET_RPC should include an API key",
    );
  } catch (error) {
    throw new Error(
      `Invalid HELIUS_DEVNET_RPC format: ${env.HELIUS_DEVNET_RPC}`,
    );
  }

  // Check timeout and health check interval
  assertEquals(
    typeof env.RPC_TIMEOUT_MS,
    "number",
    "RPC_TIMEOUT_MS should be a number",
  );
  assertEquals(
    env.RPC_TIMEOUT_MS > 0,
    true,
    "RPC_TIMEOUT_MS should be positive",
  );

  assertEquals(
    typeof env.RPC_HEALTH_CHECK_INTERVAL_MS,
    "number",
    "RPC_HEALTH_CHECK_INTERVAL_MS should be a number",
  );
  assertEquals(
    env.RPC_HEALTH_CHECK_INTERVAL_MS > 0,
    true,
    "RPC_HEALTH_CHECK_INTERVAL_MS should be positive",
  );

  // Check rate limiting
  assertEquals(
    typeof env.RPC_REQUESTS_PER_SECOND,
    "number",
    "RPC_REQUESTS_PER_SECOND should be a number",
  );
  assertEquals(
    env.RPC_REQUESTS_PER_SECOND >= 0,
    true,
    "RPC_REQUESTS_PER_SECOND should be non-negative",
  );

  console.log("✅ RPC configuration is valid");
  console.log(`📊 RPC URLs configured: ${env.RPC_URLS.length}`);
  env.RPC_URLS.forEach((url: string, index: number) => {
    const displayUrl = url.length > 40 ? url.substring(0, 37) + "..." : url;
    console.log(`  - URL ${index + 1}: ${displayUrl}`);
  });

  // Log Helius endpoints
  console.log("🔌 Helius RPC endpoints:");
  console.log(`  - Mainnet: ${env.HELIUS_MAINNET_RPC.substring(0, 40)}...`);
  console.log(`  - Devnet: ${env.HELIUS_DEVNET_RPC.substring(0, 40)}...`);
}

function testEnvironmentSpecificSettings(env: any) {
  // Check environment setting
  const validEnvironments = ["development", "test", "production"];
  assertEquals(
    validEnvironments.includes(env.NODE_ENV),
    true,
    `NODE_ENV should be one of: ${validEnvironments.join(", ")}`,
  );

  // Log current environment
  console.log(`🌍 Current environment: ${env.NODE_ENV}`);

  // Environment-specific checks
  if (env.NODE_ENV === "production") {
    // Production should have multiple RPC endpoints for redundancy
    assertEquals(
      env.RPC_URLS.length >= 2,
      true,
      "Production environment should have at least 2 RPC endpoints for redundancy",
    );

    // Production should use only HTTPS URLs, not localhost
    for (const url of env.RPC_URLS) {
      assertEquals(
        url.startsWith("https://"),
        true,
        `Production RPC URL should use HTTPS: ${url}`,
      );
    }

    console.log("✅ Production-specific configuration is valid");
  } else if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    // Development can use fewer endpoints and localhost
    console.log(
      `ℹ️ ${env.NODE_ENV} environment - relaxed requirements for RPC endpoints`,
    );
  }
}
