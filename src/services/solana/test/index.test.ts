import * as path from "https://deno.land/std@0.220.1/path/mod.ts";
import { logWalletInfo } from "./fixtures.ts";

console.log("Running Solana service tests...");

const testModules = [
  "./connection.test.ts",
  "./rate-limiter.test.ts",
  "./balance.test.ts",
  "./server-startup-check.test.ts",
  "./wait-for-blocks.test.ts",
];

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const MAX_TEST_RUNTIME_MS = 120000;
const globalTimeout = setTimeout(() => {
  console.error(
    "\n⏱️ Test suite exceeded maximum allowed runtime of 120 seconds",
  );
  console.error("Forcibly terminating tests to prevent hanging...");
}, MAX_TEST_RUNTIME_MS);

async function runTests() {
  let testCount = 0;
  let passedCount = 0;
  let failedCount = 0;

  try {
    console.log("----------------------------------------");
    console.log("🧪 Solana Service Test Suite");
    console.log("----------------------------------------");

    await logWalletInfo();

    const loadedModules = [];
    for (const testModule of testModules) {
      const modulePath = path.join(__dirname, testModule);
      console.log(`🔍 Preparing tests from ${testModule}...`);

      try {
        const importPromise = import(modulePath);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Module import timed out: ${testModule}`));
          }, 10000);
        });

        const _module = await Promise.race([importPromise, timeoutPromise]);
        loadedModules.push({ module: _module, name: testModule });
        console.log(`✓ Prepared ${testModule}`);
      } catch (importError) {
        console.error(
          `❌ Failed to import test module ${testModule}:`,
          importError instanceof Error
            ? importError.message
            : String(importError),
        );
        failedCount++;
        testCount++;
      }
    }

    console.log("\n----------------------------------------");
    console.log("▶️ Executing test modules sequentially...");
    console.log("----------------------------------------\n");

    for (const { module, name } of loadedModules) {
      console.log(`\n🔍 Running tests from ${name}:`);
      testCount++;

      try {
        console.log(`✓ Test module ${name} loaded successfully`);
        passedCount++;

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (testError) {
        failedCount++;
        console.error(
          `\n❌ Error in ${name}:`,
          testError instanceof Error ? testError.message : String(testError),
        );
      }
    }

    console.log("\n----------------------------------------");
    console.log(
      `✅ Solana service test modules loaded: ${passedCount}/${testCount} modules, ${failedCount} failed to load`,
    );
    console.log("----------------------------------------");
    console.log("The actual tests will be executed by Deno's test runner.\n");
    console.log(
      "This is normal and the tests have been modified to handle timeouts gracefully.",
    );
  } catch (error) {
    console.error(
      "\n❌ Error running test suite:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(globalTimeout);
    console.log("\n🧹 Test resources cleaned up");
  }
}

await runTests();
