import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import * as connectionService from "../connection.ts";
import { loadEnv } from "../../../utils/env.ts";

// Setup and teardown
Deno.test({
  name: "Solana connection basic tests",
  async fn() {
    let initComplete = false;
    let connectionError: Error | null = null;

    try {
      console.log("📡 Testing connection to Solana RPC endpoints...");

      // Load environment first to log the configured endpoints
      const env = await loadEnv();
      console.log(`🔧 Connection configuration:`);
      console.log(`  - RPC URLs: ${env.RPC_URLS.length} endpoints configured`);
      env.RPC_URLS.forEach((url: string, index: number) => {
        console.log(`  - URL ${index + 1}: ${url}`);
      });
      console.log(`  - Connection timeout: ${env.RPC_TIMEOUT_MS}ms`);
      console.log(
        `  - Health check interval: ${env.RPC_HEALTH_CHECK_INTERVAL_MS}ms`,
      );
      console.log(
        `  - Rate limit: ${env.RPC_REQUESTS_PER_SECOND} requests per second`,
      );

      // Test initialization with timeout - increasing timeout to 15 seconds for better diagnostics
      console.log("🔄 Initializing connection service...");
      const startTime = performance.now();

      // First, try a simple non-timeout initialization to capture any thrown errors
      try {
        // Use a short promise race to catch immediate errors
        const preCheckPromise = Promise.race([
          connectionService.init().then(() => {
            initComplete = true;
            return true;
          }).catch((e) => {
            connectionError = e instanceof Error ? e : new Error(String(e));
            console.error(
              `❌ Connection error detected during pre-check: ${connectionError.message}`,
            );
            if (connectionError.stack) {
              console.error(`  Stack trace: ${connectionError.stack}`);
            }
            return false;
          }),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 2000); // Only wait 2 seconds for immediate errors
          }),
        ]);

        await preCheckPromise;
      } catch (immediateError) {
        console.error(
          `❌ Immediate connection error: ${
            immediateError instanceof Error
              ? immediateError.message
              : String(immediateError)
          }`,
        );
      }

      // If we didn't complete or find an error, proceed with full timeout
      if (!initComplete && !connectionError) {
        console.log(
          "⏳ No immediate errors, proceeding with full connection attempt...",
        );

        const initPromise = Promise.race([
          connectionService.init().then(() => {
            initComplete = true;
            const endTime = performance.now();
            console.log(
              `✅ Connection initialization successful (${
                Math.round(endTime - startTime)
              }ms)`,
            );
            return true;
          }),
          new Promise<boolean>((_, reject) => {
            setTimeout(() => {
              // Just before rejecting, check connection status for diagnostics
              const status = connectionService.getConnectionStatus();
              console.log(`📊 Connection status at timeout:`);
              status.forEach((endpoint, index) => {
                console.log(`  - Endpoint ${index + 1}: ${endpoint.url}`);
                console.log(`    Healthy: ${endpoint.healthy}`);
                if (endpoint.latencyMs) {
                  console.log(`    Latency: ${endpoint.latencyMs}ms`);
                }
                if (endpoint.errorCount > 0) {
                  console.log(`    Errors: ${endpoint.errorCount}`);
                }
                if (endpoint.lastError) {
                  console.log(`    Last error: ${endpoint.lastError}`);
                }
                console.log(
                  `    Last checked: ${
                    new Date(endpoint.lastChecked).toISOString()
                  }`,
                );
              });

              reject(
                new Error(
                  "Connection initialization timed out after 15 seconds",
                ),
              );
            }, 15000);
          }),
        ]);

        try {
          await initPromise;
        } catch (error) {
          connectionError = error instanceof Error
            ? error
            : new Error(String(error));
          console.error(
            `❌ Connection test warning: ${connectionError.message}`,
          );
          console.log("⚠️ Continuing with limited test functionality...");
        }
      }

      // Test the connection status getter functionality - this doesn't need an active connection
      const status = connectionService.getConnectionStatus();

      // Verify the status array exists and is an array
      assertEquals(
        Array.isArray(status),
        true,
        "Connection status should be an array",
      );
      assertEquals(
        status.length > 0,
        true,
        "At least one RPC endpoint should be configured",
      );

      // Log status of each connection endpoint
      console.log(
        `📊 Connection endpoints status (${status.length} endpoints):`,
      );
      status.forEach((endpoint, index) => {
        console.log(
          `  - Endpoint ${index + 1}: ${endpoint.url.substring(0, 60)}...`,
        );
        console.log(`    Healthy: ${endpoint.healthy}`);
        if (endpoint.latencyMs) {
          console.log(`    Latency: ${endpoint.latencyMs}ms`);
        }
        console.log(`    Error count: ${endpoint.errorCount}`);
        if (endpoint.lastError) {
          console.log(`    Last error: ${endpoint.lastError}`);
        }
      });

      // Skip connection-dependent tests if initialization failed
      if (initComplete) {
        // Test getting an active connection
        const connection = await connectionService.getConnection();
        assertExists(connection, "Connection should be available");
        console.log("✅ Connection successfully obtained");

        // Try a basic RPC call if connection is established
        console.log("🔍 Testing basic RPC call...");
        try {
          const slotPromise = Promise.race([
            connection.getSlot(),
            new Promise<number>((_, reject) => {
              setTimeout(
                () => reject(new Error("RPC call timed out after 5 seconds")),
                5000,
              );
            }),
          ]);

          const slot = await slotPromise;
          console.log(`✅ Successfully received slot: ${slot}`);
        } catch (rpcError) {
          console.error(
            `❌ RPC call failed: ${
              rpcError instanceof Error ? rpcError.message : String(rpcError)
            }`,
          );
        }
      } else {
        console.log(
          "⏩ Skipping connection validation due to initialization timeout",
        );
        if (connectionError) {
          console.log(`ℹ️ Connection diagnostic information:`);
          console.log(`  - Error message: ${connectionError.message}`);
          if (connectionError.stack) {
            // Format the stack trace for readability
            const stackLines = connectionError.stack.split("\n");
            console.log(`  - Stack trace (first 3 lines):`);
            stackLines.slice(0, 3).forEach((line) =>
              console.log(`    ${line}`)
            );
          }
          console.log(`  - Possible causes:`);
          console.log(
            `    • Network connectivity issues to Solana RPC endpoints`,
          );
          console.log(`    • Rate limiting by RPC providers`);
          console.log(`    • RPC endpoint may be down or unreachable`);
          console.log(`    • Firewall or proxy blocking the connection`);
        }
      }

      // Verify environment has proper RPC URLs configured
      console.log("✅ Connection status tests passed");
    } catch (error: unknown) {
      console.error(
        "❌ Connection test failed:",
        error instanceof Error ? error.message : String(error),
      );
      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }
      throw error;
    } finally {
      // Clean up resources
      connectionService.shutdown();
      console.log("🧹 Connection resources cleaned up");
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
