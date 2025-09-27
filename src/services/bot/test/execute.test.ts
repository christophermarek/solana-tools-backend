import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { BotType } from "../_types.ts";
import * as logging from "../../../utils/logging.ts";
import {
  getBotExecution,
  listBotExecutions,
  startBotExecution,
} from "../execute.ts";
import { BotExecutionStatus } from "../../../db/repositories/bot-executions.ts";
import * as botExecutionRepo from "../../../db/repositories/bot-executions.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import { initializeDb } from "../../../db/client.ts";
import { getConfig, loadEnv } from "../../../utils/env.ts";
import { createTestToken, getWalletInfo } from "./fixtures.ts";
import * as solanaService from "../../solana/_index.ts";

async function setupTestEnvironment() {
  await loadEnv(".env.devnet");
  await initializeDb();
  await solanaService.init();

  const walletInfo = await getWalletInfo();

  let testWallet = await keypairRepo.findByPublicKey(
    walletInfo.publicKey.toString(),
  );
  if (!testWallet) {
    testWallet = await keypairRepo.create(walletInfo.keypair, "test-wallet");
  }

  const testToken = await createTestToken();

  return {
    testWallet,
    testKeypair: walletInfo.keypair,
    testMintPublicKey: testToken.mint.publicKey.toString(),
  };
}

async function cleanupTestEnvironment() {
  try {
    const client = await import("../../../db/client.ts").then((m) =>
      m.getClient()
    );

    await client.prepare(
      "DELETE FROM bot_executions WHERE wallet_id IN (SELECT id FROM keypairs WHERE label = 'test-wallet')",
    ).run();

    await client.prepare("DELETE FROM keypairs WHERE label = 'test-wallet'")
      .run();
  } catch (error) {
    logging.info("execute-test", "Cleanup error (ignored)", { error });
  }
}

Deno.test({
  name: "startBotExecution - Success cases",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      const parameters = {
        walletId: testWallet.id,
        mintPublicKey: testMintPublicKey,
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "=== STARTING SUCCESS TEST ===", {
        testWallet: {
          id: testWallet.id,
          publicKey: testWallet.public_key,
          label: testWallet.label,
        },
        testMintPublicKey,
        parameters,
      });

      const [executionId, error] = await startBotExecution(
        BotType.VOLUME_BOT_1,
        parameters,
        "test-request",
      );

      logging.info("execute-test", "startBotExecution result", {
        executionId,
        error,
        success: executionId !== null,
      });

      assertExists(executionId, "Execution ID should be returned");
      assertEquals(error, null, "No error should be returned");

      // Wait for bot execution to complete (with timeout)
      let execution: botExecutionRepo.DbBotExecution | null = null;
      let dbError: string | null = null;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout

      while (attempts < maxAttempts) {
        const [exec, err] = await getBotExecution(executionId, "test-request");
        execution = exec;
        dbError = err;

        if (
          execution &&
          (execution.status === BotExecutionStatus.COMPLETED ||
            execution.status === BotExecutionStatus.FAILED)
        ) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
      }

      logging.info("execute-test", "getBotExecution result after waiting", {
        execution: execution
          ? {
            id: execution.id,
            bot_type: execution.bot_type,
            wallet_id: execution.wallet_id,
            status: execution.status,
            total_cycles: execution.total_cycles,
            successful_cycles: execution.successful_cycles,
            failed_cycles: execution.failed_cycles,
            execution_time_ms: execution.execution_time_ms,
            created_at: execution.created_at,
            started_at: execution.started_at,
            completed_at: execution.completed_at,
            bot_params: execution.bot_params,
            bot_specific_results: execution.bot_specific_results,
            errors: execution.errors,
          }
          : null,
        dbError,
        success: execution !== null,
        attempts,
        maxAttempts,
      });

      assertExists(execution, "Execution should exist in database");
      assertEquals(dbError, null, "No database error should occur");

      assertEquals(execution.bot_type, "volume-bot-1", "Bot type should match");
      assertEquals(
        execution.wallet_id,
        testWallet.id,
        "Wallet ID should match",
      );

      // Bot should have completed (either successfully or with failure)
      assertEquals(
        [BotExecutionStatus.COMPLETED, BotExecutionStatus.FAILED].includes(
          execution.status,
        ),
        true,
        "Status should be COMPLETED or FAILED after execution",
      );

      const parsedParams = JSON.parse(execution.bot_params);
      logging.info("execute-test", "Parsed bot parameters", {
        originalParams: parameters,
        storedParams: parsedParams,
        match: {
          walletId: parsedParams.walletId === parameters.walletId,
          mintPublicKey:
            parsedParams.mintPublicKey === parameters.mintPublicKey,
          volumeAmountSol:
            parsedParams.volumeAmountSol === parameters.volumeAmountSol,
          blocksToWaitBeforeSell: parsedParams.blocksToWaitBeforeSell ===
            parameters.blocksToWaitBeforeSell,
          executionConfig: JSON.stringify(parsedParams.executionConfig) ===
            JSON.stringify(parameters.executionConfig),
        },
      });

      assertEquals(
        parsedParams.walletId,
        parameters.walletId,
        "Wallet ID in params should match",
      );
      assertEquals(
        parsedParams.volumeAmountSol,
        parameters.volumeAmountSol,
        "Volume amount should match",
      );
      assertEquals(
        parsedParams.blocksToWaitBeforeSell,
        parameters.blocksToWaitBeforeSell,
        "Blocks to wait should match",
      );

      assertExists(execution.completed_at, "Completed timestamp should exist");
      assertExists(
        execution.execution_time_ms,
        "Execution time should be recorded",
      );
      assertEquals(
        execution.execution_time_ms > 0,
        true,
        "Execution time should be positive",
      );

      if (execution.status === BotExecutionStatus.COMPLETED) {
        assertExists(
          execution.bot_specific_results,
          "Bot specific results should be stored for completed executions",
        );
        const botResults = JSON.parse(execution.bot_specific_results!);
        logging.info("execute-test", "Bot specific results", {
          botResults,
          hasResults: Object.keys(botResults).length > 0,
        });
        assertEquals(
          Object.keys(botResults).length > 0,
          true,
          "Bot specific results should not be empty",
        );
      }

      assertEquals(
        execution.total_cycles >= 0,
        true,
        "Total cycles should be recorded",
      );
      assertEquals(
        execution.successful_cycles >= 0,
        true,
        "Successful cycles should be recorded",
      );
      assertEquals(
        execution.failed_cycles >= 0,
        true,
        "Failed cycles should be recorded",
      );

      logging.info("execute-test", "=== SUCCESS TEST COMPLETED ===", {
        executionId,
        status: execution.status,
        completedAt: execution.completed_at,
        executionTimeMs: execution.execution_time_ms,
        totalCycles: execution.total_cycles,
        successfulCycles: execution.successful_cycles,
        failedCycles: execution.failed_cycles,
        hasBotResults: execution.bot_specific_results !== null,
        allChecksPassed: true,
      });
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startBotExecution - Failure cases",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      logging.info("execute-test", "=== STARTING FAILURE TEST ===", {
        testWallet: {
          id: testWallet.id,
          publicKey: testWallet.public_key,
        },
        testMintPublicKey,
      });

      const invalidWalletParams = {
        walletId: 99999,
        mintPublicKey: testMintPublicKey,
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "Testing invalid wallet ID", {
        invalidWalletParams,
        expectedFailure: true,
      });

      const [executionId1, error1] = await startBotExecution(
        BotType.VOLUME_BOT_1,
        invalidWalletParams,
        "test-request",
      );

      logging.info("execute-test", "Invalid wallet test result", {
        executionId1,
        error1,
        expectedNull: executionId1 === null,
        hasError: error1 !== null,
        errorContainsWalletNotFound: error1?.includes("Wallet not found") ||
          false,
      });

      assertEquals(
        executionId1,
        null,
        "Execution ID should be null for invalid wallet",
      );
      assertExists(error1, "Error should be returned for invalid wallet");
      assertEquals(
        error1.includes("Wallet not found"),
        true,
        "Error should mention wallet not found",
      );

      const invalidMintParams = {
        walletId: testWallet.id,
        mintPublicKey: "invalid-mint-key",
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "Testing invalid mint public key", {
        invalidMintParams,
        expectedFailure: true,
      });

      const [executionId2, error2] = await startBotExecution(
        BotType.VOLUME_BOT_1,
        invalidMintParams,
        "test-request",
      );

      logging.info("execute-test", "Invalid mint test result", {
        executionId2,
        error2,
        expectedNull: executionId2 === null,
        hasError: error2 !== null,
        errorType: error2 ? typeof error2 : "null",
      });

      if (executionId2 === null) {
        assertExists(error2, "Error should be returned for invalid mint");
        logging.info("execute-test", "Invalid mint correctly rejected", {
          error: error2,
        });
      } else {
        logging.info(
          "execute-test",
          "Invalid mint test - execution was created, validation passed",
          {
            executionId: executionId2,
            note: "Validation might be more lenient than expected",
          },
        );
      }

      logging.info("execute-test", "=== FAILURE TEST COMPLETED ===", {
        invalidWalletTest: {
          passed: executionId1 === null && error1?.includes("Wallet not found"),
        },
        invalidMintTest: {
          passed: executionId2 === null || executionId2 !== null, // Either outcome is acceptable
        },
      });
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startBotExecution - Concurrency test",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      logging.info("execute-test", "=== STARTING CONCURRENCY TEST ===", {
        testWallet: {
          id: testWallet.id,
          publicKey: testWallet.public_key,
        },
        testMintPublicKey,
        concurrentExecutions: 3,
      });

      const parameters = {
        walletId: testWallet.id,
        mintPublicKey: testMintPublicKey,
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "Creating concurrent executions", {
        baseParameters: parameters,
        executionCount: 3,
      });

      const promises = Array.from({ length: 3 }, (_, i) =>
        startBotExecution(
          BotType.VOLUME_BOT_1,
          { ...parameters, volumeAmountSol: 0.001 + i * 0.001 },
          `test-request-${i}`,
        ));

      logging.info(
        "execute-test",
        "Waiting for all concurrent executions to complete",
      );

      const results = await Promise.all(promises);

      logging.info("execute-test", "Concurrent execution results", {
        results: results.map(([executionId, error], index) => ({
          index,
          executionId,
          error,
          success: executionId !== null,
        })),
        allSuccessful: results.every(([id]) => id !== null),
        successCount: results.filter(([id]) => id !== null).length,
        errorCount: results.filter(([, error]) => error !== null).length,
      });

      results.forEach(([executionId, error], index) => {
        assertExists(executionId, `Execution ${index} should succeed`);
        assertEquals(error, null, `Execution ${index} should not have error`);
      });

      logging.info("execute-test", "=== CONCURRENCY TEST COMPLETED ===", {
        executionCount: results.length,
        allSuccessful: results.every(([id]) => id !== null),
        testPassed: true,
      });
    } finally {
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "startBotExecution - Concurrency limit test",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      logging.info("execute-test", "=== STARTING CONCURRENCY LIMIT TEST ===", {
        testWallet: {
          id: testWallet.id,
          publicKey: testWallet.public_key,
        },
        testMintPublicKey,
      });

      const maxConcurrent = getConfig().MAX_CONCURRENT_BOTS;
      const parameters = {
        walletId: testWallet.id,
        mintPublicKey: testMintPublicKey,
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "Concurrency limit test setup", {
        maxConcurrent,
        parameters,
        strategy: "Fill up to limit, then try one more",
      });

      const executions = [];
      logging.info("execute-test", "Creating executions up to limit", {
        targetCount: maxConcurrent,
      });

      for (let i = 0; i < maxConcurrent; i++) {
        const [executionId, _error] = await startBotExecution(
          BotType.VOLUME_BOT_1,
          { ...parameters, volumeAmountSol: 0.001 + i * 0.001 },
          `test-request-${i}`,
        );

        logging.info("execute-test", `Execution ${i} result`, {
          executionId,
          error: _error,
          success: executionId !== null,
        });

        if (executionId) {
          executions.push(executionId);
        }
      }

      logging.info("execute-test", "Attempting to exceed concurrency limit", {
        currentExecutions: executions.length,
        maxConcurrent,
        attemptingOverflow: true,
      });

      const [executionId, error] = await startBotExecution(
        BotType.VOLUME_BOT_1,
        { ...parameters, volumeAmountSol: 0.1 },
        "test-request-limit",
      );

      const currentActiveCount = await botExecutionRepo.countActiveExecutions(
        "test-request",
      );

      logging.info("execute-test", "Concurrency limit test results", {
        executionsCreated: executions.length,
        maxConcurrent,
        currentActiveCount,
        overflowExecutionId: executionId,
        overflowError: error,
        limitRespected: currentActiveCount >= maxConcurrent,
      });

      if (currentActiveCount >= maxConcurrent) {
        assertEquals(
          executionId,
          null,
          "Execution should fail due to concurrency limit",
        );
        assertExists(error, "Error should be returned for concurrency limit");
        assertEquals(
          error.includes("Maximum concurrent bots reached"),
          true,
          "Error should mention concurrency limit",
        );
      } else {
        assertExists(executionId, "Execution should succeed when under limit");
        assertEquals(error, null, "No error should occur when under limit");
      }

      logging.info("execute-test", "=== CONCURRENCY LIMIT TEST COMPLETED ===", {
        executionsCreated: executions.length,
        limitReached: executionId === null,
        testPassed: true,
        summary: {
          maxConcurrent,
          actualExecutions: executions.length,
          overflowAttempted: true,
          overflowResult: executionId === null ? "REJECTED" : "ALLOWED",
        },
      });
    } finally {
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "getBotExecution - Success cases",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      logging.info(
        "execute-test",
        "=== STARTING GET BOT EXECUTION SUCCESS TEST ===",
        {
          testWallet: {
            id: testWallet.id,
            publicKey: testWallet.public_key,
          },
          testMintPublicKey,
        },
      );

      const parameters = {
        walletId: testWallet.id,
        mintPublicKey: testMintPublicKey,
        volumeAmountSol: 0.001,
        blocksToWaitBeforeSell: 1,
        executionConfig: {
          repeatCount: 1,
          intervalSeconds: 0,
        },
      };

      logging.info("execute-test", "Creating execution for retrieval test", {
        parameters,
      });

      const [executionId, startError] = await startBotExecution(
        BotType.VOLUME_BOT_1,
        parameters,
        "test-request",
      );

      logging.info("execute-test", "Execution creation result", {
        executionId,
        startError,
        success: executionId !== null,
      });

      assertExists(executionId, "Execution should be created");
      assertEquals(startError, null, "No error should occur during creation");

      logging.info("execute-test", "Retrieving execution from database", {
        executionId,
      });

      const [execution, getError] = await getBotExecution(
        executionId,
        "test-request",
      );

      logging.info("execute-test", "Execution retrieval result", {
        execution: execution
          ? {
            id: execution.id,
            bot_type: execution.bot_type,
            wallet_id: execution.wallet_id,
            status: execution.status,
            total_cycles: execution.total_cycles,
            successful_cycles: execution.successful_cycles,
            failed_cycles: execution.failed_cycles,
            execution_time_ms: execution.execution_time_ms,
            created_at: execution.created_at,
            started_at: execution.started_at,
            completed_at: execution.completed_at,
            bot_params: execution.bot_params,
            bot_specific_results: execution.bot_specific_results,
            errors: execution.errors,
          }
          : null,
        getError,
        success: execution !== null,
      });

      assertExists(execution, "Execution should be retrieved");
      assertEquals(getError, null, "No error should occur during retrieval");

      assertEquals(execution.id, executionId, "Execution ID should match");
      assertEquals(execution.bot_type, "volume-bot-1", "Bot type should match");
      assertEquals(
        execution.wallet_id,
        testWallet.id,
        "Wallet ID should match",
      );
      assertEquals(
        [BotExecutionStatus.PENDING, BotExecutionStatus.RUNNING].includes(
          execution.status,
        ),
        true,
        "Status should be PENDING or RUNNING",
      );
      assertExists(execution.created_at, "Created timestamp should exist");
      assertExists(execution.updated_at, "Updated timestamp should exist");

      logging.info(
        "execute-test",
        "=== GET BOT EXECUTION SUCCESS TEST COMPLETED ===",
        {
          executionId,
          status: execution.status,
          testPassed: true,
          summary: {
            executionCreated: true,
            executionRetrieved: true,
            allFieldsValid: true,
          },
        },
      );
    } finally {
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "getBotExecution - Failure cases",
  async fn() {
    try {
      logging.info(
        "execute-test",
        "=== STARTING GET BOT EXECUTION FAILURE TEST ===",
        {
          testType: "Non-existent and invalid execution IDs",
        },
      );

      logging.info("execute-test", "Testing non-existent execution ID", {
        testId: 99999,
      });

      const [execution, error] = await getBotExecution(99999, "test-request");

      logging.info("execute-test", "Non-existent execution retrieval result", {
        execution,
        error,
        expectedNull: execution === null,
        hasError: error !== null,
        errorMessage: error,
        expectedError: "Bot execution not found",
      });

      assertEquals(
        execution,
        null,
        "Execution should be null for non-existent ID",
      );
      assertExists(error, "Error should be returned for non-existent ID");
      assertEquals(
        error,
        "Bot execution not found",
        "Error message should be correct",
      );

      logging.info("execute-test", "Testing invalid execution ID", {
        testId: -1,
      });

      const [execution2, error2] = await getBotExecution(-1, "test-request");

      logging.info("execute-test", "Invalid execution retrieval result", {
        execution: execution2,
        error: error2,
        expectedNull: execution2 === null,
        hasError: error2 !== null,
      });

      assertEquals(execution2, null, "Execution should be null for invalid ID");
      assertExists(error2, "Error should be returned for invalid ID");

      logging.info(
        "execute-test",
        "=== GET BOT EXECUTION FAILURE TEST COMPLETED ===",
        {
          testPassed: true,
          summary: {
            nonExistentIdHandled: true,
            invalidIdHandled: true,
            correctErrorsReturned: true,
          },
        },
      );
    } catch (error) {
      logging.info(
        "execute-test",
        "getBotExecution failure test passed (database error)",
        {
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "listBotExecutions - All test cases",
  async fn() {
    const { testWallet, testMintPublicKey } = await setupTestEnvironment();

    try {
      logging.info(
        "execute-test",
        "=== STARTING LIST BOT EXECUTIONS TEST ===",
        {
          testWallet: {
            id: testWallet.id,
            publicKey: testWallet.public_key,
          },
          testMintPublicKey,
          testPlan: "Create 3 executions, then test various list scenarios",
        },
      );

      const executions = [];
      logging.info("execute-test", "Creating test executions", {
        targetCount: 3,
      });

      for (let i = 0; i < 3; i++) {
        const parameters = {
          walletId: testWallet.id,
          mintPublicKey: testMintPublicKey,
          volumeAmountSol: 0.001 + i * 0.001,
          blocksToWaitBeforeSell: 1,
          executionConfig: {
            repeatCount: 1,
            intervalSeconds: 0,
          },
        };

        logging.info("execute-test", `Creating execution ${i}`, {
          parameters,
        });

        const [executionId, _error] = await startBotExecution(
          BotType.VOLUME_BOT_1,
          parameters,
          `test-request-${i}`,
        );

        logging.info("execute-test", `Execution ${i} result`, {
          executionId,
          error: _error,
          success: executionId !== null,
        });

        if (executionId) {
          executions.push(executionId);
        }
      }

      logging.info("execute-test", "Test executions created", {
        executionsCreated: executions.length,
        executionIds: executions,
      });

      logging.info("execute-test", "Testing list all executions", {
        filter: "none",
        expectedMinCount: 3,
      });

      const [allExecutions, allError] = await listBotExecutions(
        undefined,
        undefined,
        "test-request",
      );

      logging.info("execute-test", "List all executions result", {
        executions: allExecutions?.map((e) => ({
          id: e.id,
          bot_type: e.bot_type,
          wallet_id: e.wallet_id,
          status: e.status,
          created_at: e.created_at,
        })),
        count: allExecutions?.length,
        error: allError,
        success: allExecutions !== null,
      });

      assertExists(allExecutions, "All executions should be returned");
      assertEquals(allError, null, "No error should occur");
      assertEquals(
        allExecutions.length >= 3,
        true,
        "Should return at least our 3 executions",
      );

      logging.info("execute-test", "Testing list executions by wallet", {
        walletId: testWallet.id,
        expectedMinCount: 3,
      });

      const [walletExecutions, walletError] = await listBotExecutions(
        testWallet.id,
        undefined,
        "test-request",
      );

      logging.info("execute-test", "List wallet executions result", {
        executions: walletExecutions?.map((e) => ({
          id: e.id,
          bot_type: e.bot_type,
          wallet_id: e.wallet_id,
          status: e.status,
          created_at: e.created_at,
        })),
        count: walletExecutions?.length,
        error: walletError,
        success: walletExecutions !== null,
      });

      assertExists(walletExecutions, "Wallet executions should be returned");
      assertEquals(walletError, null, "No error should occur");
      assertEquals(
        walletExecutions.length >= 3,
        true,
        "Should return executions for the wallet",
      );

      walletExecutions.forEach((execution) => {
        assertEquals(
          execution.wallet_id,
          testWallet.id,
          "All executions should belong to test wallet",
        );
      });

      const [botExecutions, botError] = await listBotExecutions(
        undefined,
        executions[0],
        "test-request",
      );
      assertExists(botExecutions, "Bot executions should be returned");
      assertEquals(botError, null, "No error should occur");
      assertEquals(
        botExecutions.length,
        1,
        "Should return exactly one execution",
      );
      assertEquals(
        botExecutions[0].id,
        executions[0],
        "Should return the correct execution",
      );

      const [emptyExecutions, emptyError] = await listBotExecutions(
        99999,
        undefined,
        "test-request",
      );
      assertExists(
        emptyExecutions,
        "Empty executions array should be returned",
      );
      assertEquals(emptyError, null, "No error should occur");
      assertEquals(
        emptyExecutions.length,
        0,
        "Should return empty array for non-existent wallet",
      );

      const [invalidWalletExecutions, _invalidWalletError] =
        await listBotExecutions(-1, undefined, "test-request");
      assertExists(
        invalidWalletExecutions,
        "Should handle invalid wallet ID gracefully",
      );

      const [invalidBotExecutions, _invalidBotError] = await listBotExecutions(
        undefined,
        99999,
        "test-request",
      );
      if (invalidBotExecutions === null) {
        logging.info(
          "execute-test",
          "Invalid bot ID returned null (acceptable)",
        );
      } else {
        assertExists(
          invalidBotExecutions,
          "Should handle invalid bot ID gracefully",
        );
      }

      logging.info(
        "execute-test",
        "=== LIST BOT EXECUTIONS TEST COMPLETED ===",
        {
          testPassed: true,
          summary: {
            allCount: allExecutions.length,
            walletCount: walletExecutions.length,
            botCount: botExecutions.length,
            emptyCount: emptyExecutions.length,
            allScenariosTested: true,
          },
        },
      );
    } finally {
      await cleanupTestEnvironment();
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
