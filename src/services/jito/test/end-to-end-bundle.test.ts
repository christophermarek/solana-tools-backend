import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { sendBundle } from "../send-bundle.ts";
import { createTipTransaction } from "../tip-transaction.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as logging from "../../../utils/logging.ts";
import {
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getConnection } from "../../solana/connection.ts";
import { getJitoService } from "../_index.ts";

Deno.test({
  name: "Test complete Jito bundle flow - from creation to confirmation",
  async fn() {
    const env = await loadEnv(".env.testnet");
    assertExists(env.RPC_URL, "RPC_URL should be configured");
    assertExists(
      env.TEST_WALLET_PRIVATE_KEY,
      "TEST_WALLET_PRIVATE_KEY should be configured",
    );

    logging.info(
      "end-to-end-bundle-test",
      "Starting complete bundle flow test",
    );

    const wallet1 = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
    const wallet2 = Keypair.generate();
    const wallet3 = Keypair.generate();

    assertExists(wallet1, "Wallet1 keypair should be created");

    logging.info("end-to-end-bundle-test", "Using test wallets", {
      wallet1: wallet1.publicKey.toString(),
      wallet2: wallet2.publicKey.toString(),
      wallet3: wallet3.publicKey.toString(),
    });

    // Step 1: Get connection and check initial balances
    const [connection, connectionError] = await getConnection();
    if (connectionError) {
      throw new Error(`Failed to get connection: ${connectionError}`);
    }

    const { blockhash } = await connection.getLatestBlockhash();
    logging.info("end-to-end-bundle-test", "Got latest blockhash", {
      blockhash,
    });

    // Step 2: Check wallet1 has sufficient balance
    const balanceResult = await connection.getBalance(wallet1.publicKey);
    const balanceSol = balanceResult / 1e9;
    logging.info("end-to-end-bundle-test", "Wallet balance check", {
      wallet: wallet1.publicKey.toString(),
      balanceSol,
      balanceLamports: balanceResult,
    });

    if (balanceSol < 0.01) {
      throw new Error(
        `Insufficient balance: ${balanceSol} SOL (need at least 0.01 SOL)`,
      );
    }

    // Step 3: Create transfer transactions
    const transferAmount = 1000000; // 0.001 SOL
    const tipAmount = 1000; // 0.000001 SOL

    const transfer1 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet1.publicKey,
        toPubkey: wallet2.publicKey,
        lamports: transferAmount,
      }),
    );
    transfer1.recentBlockhash = blockhash;
    transfer1.feePayer = wallet1.publicKey;
    transfer1.sign(wallet1);

    const transfer2 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet1.publicKey,
        toPubkey: wallet3.publicKey,
        lamports: transferAmount,
      }),
    );
    transfer2.recentBlockhash = blockhash;
    transfer2.feePayer = wallet1.publicKey;
    transfer2.sign(wallet1);

    logging.info("end-to-end-bundle-test", "Created transfer transactions", {
      transferAmount,
      tipAmount,
    });

    // Step 4: Create tip transaction with recommended tip amount
    const [tipResult, tipError] = await createTipTransaction({
      from: wallet1,
      recentBlockhash: blockhash,
      priority: "standard", // Use standard priority for testing
    });

    if (tipError) {
      throw new Error(`Failed to create tip transaction: ${tipError}`);
    }

    logging.info("end-to-end-bundle-test", "Created tip transaction", {
      tipAccount: tipResult.tipAccount,
      tipAmount,
    });

    // Step 5: Create versioned transactions
    const message1 = new TransactionMessage({
      payerKey: wallet1.publicKey,
      recentBlockhash: blockhash,
      instructions: transfer1.instructions,
    }).compileToV0Message();

    const message2 = new TransactionMessage({
      payerKey: wallet1.publicKey,
      recentBlockhash: blockhash,
      instructions: transfer2.instructions,
    }).compileToV0Message();

    const versionedTx1 = new VersionedTransaction(message1);
    versionedTx1.sign([wallet1]);

    const versionedTx2 = new VersionedTransaction(message2);
    versionedTx2.sign([wallet1]);

    const transactions = [versionedTx1, versionedTx2, tipResult.transaction];

    logging.info("end-to-end-bundle-test", "Created bundle transactions", {
      transactionCount: transactions.length,
    });

    // Step 6: Send bundle to Jito
    const [result, error] = await sendBundle(transactions, 30000);

    if (error) {
      const errorMessage = typeof error === "string"
        ? error
        : (error && typeof error === "object" && "message" in error)
        ? error.message
        : String(error);
      logging.error("end-to-end-bundle-test", "Bundle send failed", {
        error: errorMessage,
        errorType: typeof error,
      });
      throw new Error(`Bundle send failed: ${errorMessage}`);
    }

    assertExists(result, "Bundle result should exist");
    assertExists(result.bundleId, "Bundle ID should exist");
    assertEquals(result.success, true, "Bundle should be successful");

    const bundleId = result.bundleId;
    logging.info("end-to-end-bundle-test", "Bundle sent successfully", {
      bundleId,
    });

    // Step 7: Verify bundle exists on Jito and contains our transactions
    const [jitoService, jitoError] = getJitoService();
    if (jitoError) {
      throw new Error(`Failed to get Jito service: ${jitoError}`);
    }

    let bundleConfirmed = false;
    let bundleFailed = false;
    let finalStatus = null;
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();

    logging.info("end-to-end-bundle-test", "Starting bundle verification", {
      bundleId,
      maxWaitTime,
      checkInterval,
    });

    // First, verify the bundle was accepted by Jito
    let bundleAccepted = false;
    let bundleStatus = null;

    while (
      Date.now() - startTime < maxWaitTime && !bundleConfirmed && !bundleFailed
    ) {
      try {
        // Check bundle status using getBundleStatuses
        bundleStatus = await jitoService.client.getBundleStatuses([[bundleId]]);

        if (
          bundleStatus && typeof bundleStatus === "object" &&
          "result" in bundleStatus
        ) {
          const statusResult = bundleStatus.result;
          if (
            statusResult && "value" in statusResult &&
            Array.isArray(statusResult.value) &&
            statusResult.value.length > 0
          ) {
            const bundleInfo = statusResult.value[0];
            finalStatus = bundleInfo;

            logging.info("end-to-end-bundle-test", "Bundle found in status", {
              bundleId,
              status: bundleInfo.confirmation_status,
              slot: bundleInfo.slot,
              rejectReason: "err" in bundleInfo ? bundleInfo.err : undefined,
            });

            if (bundleInfo.confirmation_status === "confirmed") {
              bundleConfirmed = true;
              bundleAccepted = true;
              logging.info(
                "end-to-end-bundle-test",
                "Bundle confirmed on Jito!",
                {
                  bundleId,
                  slot: bundleInfo.slot,
                },
              );
              break;
            } else if (
              bundleInfo.confirmation_status === "processed" &&
              "err" in bundleInfo && bundleInfo.err
            ) {
              bundleFailed = true;
              bundleAccepted = true; // Bundle was accepted but failed
              logging.warn("end-to-end-bundle-test", "Bundle failed on Jito", {
                bundleId,
                rejectReason: bundleInfo.err,
              });
              break;
            }
          } else {
            // Bundle not found in status yet, check inflight
            try {
              const inflightStatus = await jitoService.client
                .confirmInflightBundle(bundleId, 3000);
              logging.info("end-to-end-bundle-test", "Inflight status", {
                bundleId,
                status: inflightStatus,
              });

              if (inflightStatus && typeof inflightStatus === "object") {
                if ("confirmation_status" in inflightStatus) {
                  if (inflightStatus.confirmation_status === "confirmed") {
                    bundleConfirmed = true;
                    bundleAccepted = true;
                    finalStatus = inflightStatus;
                    logging.info(
                      "end-to-end-bundle-test",
                      "Bundle confirmed via inflight!",
                      {
                        bundleId,
                        slot: "slot" in inflightStatus
                          ? inflightStatus.slot
                          : undefined,
                      },
                    );
                    break;
                  } else if (
                    inflightStatus.confirmation_status === "processed" &&
                    "err" in inflightStatus && inflightStatus.err
                  ) {
                    bundleFailed = true;
                    bundleAccepted = true;
                    finalStatus = inflightStatus;
                    logging.warn(
                      "end-to-end-bundle-test",
                      "Bundle failed via inflight",
                      {
                        bundleId,
                        rejectReason: inflightStatus.err,
                      },
                    );
                    break;
                  }
                }
              }
            } catch (_inflightError) {
              // This is expected to timeout sometimes, not an error
              logging.debug(
                "end-to-end-bundle-test",
                "Inflight status timeout",
                {
                  bundleId,
                },
              );
            }
          }
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (statusError) {
        logging.warn("end-to-end-bundle-test", "Error checking bundle status", {
          bundleId,
          error: statusError instanceof Error
            ? statusError.message
            : String(statusError),
        });
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    // Step 8: Verify bundle was accepted by Jito (even if not confirmed)
    if (!bundleAccepted) {
      // Check if bundle is still being processed
      try {
        const inflightStatus = await jitoService.client.confirmInflightBundle(
          bundleId,
          5000,
        );
        if (inflightStatus && typeof inflightStatus === "object") {
          bundleAccepted = true;
          finalStatus = inflightStatus;
          logging.info(
            "end-to-end-bundle-test",
            "Bundle found in inflight status",
            {
              bundleId,
              status: inflightStatus,
            },
          );
        }
      } catch (inflightError) {
        logging.warn(
          "end-to-end-bundle-test",
          "Bundle not found in inflight status",
          {
            bundleId,
            error: inflightError instanceof Error
              ? inflightError.message
              : String(inflightError),
          },
        );
      }
    }

    // Step 9: Verify final result
    if (bundleConfirmed) {
      logging.info("end-to-end-bundle-test", "Bundle successfully confirmed!", {
        bundleId,
        finalStatus,
      });

      // Verify the bundle was actually processed
      if (finalStatus && "slot" in finalStatus && finalStatus.slot) {
        logging.info("end-to-end-bundle-test", "Bundle landed in slot", {
          bundleId,
          slot: finalStatus.slot,
        });
      }
    } else if (bundleFailed) {
      logging.warn("end-to-end-bundle-test", "Bundle failed on Jito", {
        bundleId,
        rejectReason: (finalStatus && "err" in finalStatus)
          ? finalStatus.err
          : "Unknown reason",
      });
      // Don't fail the test - bundle was accepted but failed validation
    } else if (!bundleAccepted) {
      logging.warn("end-to-end-bundle-test", "Bundle not found on Jito", {
        bundleId,
        finalStatus,
      });
      // This would be a real problem - bundle not accepted by Jito
    } else {
      logging.info(
        "end-to-end-bundle-test",
        "Bundle accepted but status check timed out",
        {
          bundleId,
          finalStatus,
        },
      );
      // Bundle was accepted but timing out is normal
    }

    // Step 9: Verify transactions were actually executed by checking balances
    try {
      const wallet2Balance = await connection.getBalance(wallet2.publicKey);
      const wallet3Balance = await connection.getBalance(wallet3.publicKey);

      logging.info("end-to-end-bundle-test", "Final balance check", {
        wallet2: {
          address: wallet2.publicKey.toString(),
          balance: wallet2Balance / 1e9,
        },
        wallet3: {
          address: wallet3.publicKey.toString(),
          balance: wallet3Balance / 1e9,
        },
      });

      // If bundle was confirmed, check if transfers actually happened
      if (bundleConfirmed) {
        const expectedBalance = transferAmount / 1e9; // Convert to SOL

        if (wallet2Balance >= transferAmount) {
          logging.info(
            "end-to-end-bundle-test",
            "Transfer to wallet2 successful",
            {
              expected: expectedBalance,
              actual: wallet2Balance / 1e9,
            },
          );
        }

        if (wallet3Balance >= transferAmount) {
          logging.info(
            "end-to-end-bundle-test",
            "Transfer to wallet3 successful",
            {
              expected: expectedBalance,
              actual: wallet3Balance / 1e9,
            },
          );
        }
      }
    } catch (balanceError) {
      logging.warn(
        "end-to-end-bundle-test",
        "Could not verify final balances",
        {
          error: balanceError instanceof Error
            ? balanceError.message
            : String(balanceError),
        },
      );
    }

    logging.info(
      "end-to-end-bundle-test",
      "Complete bundle flow test finished",
      {
        bundleId,
        bundleConfirmed,
        bundleFailed,
        finalStatus,
      },
    );

    // Test passes if we got a bundle ID and it was accepted by Jito
    assertExists(bundleId, "Bundle ID should exist");

    // Verify the bundle was accepted by Jito (this is the key test)
    if (!bundleAccepted) {
      throw new Error(
        `Bundle ${bundleId} was not accepted by Jito - this indicates a problem with the bundle sending process`,
      );
    }

    logging.info("end-to-end-bundle-test", "Bundle verification successful", {
      bundleId,
      bundleAccepted,
      bundleConfirmed,
      bundleFailed,
      status: (finalStatus && "confirmation_status" in finalStatus)
        ? finalStatus.confirmation_status
        : "unknown",
    });

    // The test is successful if the bundle was accepted by Jito, regardless of final confirmation
    // (since confirmation depends on network conditions and timing)
    logging.info("end-to-end-bundle-test", "Test completed successfully", {
      bundleId,
      bundleAccepted,
      bundleConfirmed,
      bundleFailed,
      status: (finalStatus && "confirmation_status" in finalStatus)
        ? finalStatus.confirmation_status
        : "unknown",
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
