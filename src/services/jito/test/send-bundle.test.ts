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
import { Bundle } from "jito-ts/dist/sdk/block-engine/types.js";
import { getConnection } from "../../solana/connection.ts";
import { fundWalletsWithTestnetAirdrop } from "./funding-fixture.ts";

Deno.test({
  name: "Test Jito bundle on testnet with simple transfers",
  async fn() {
    const env = await loadEnv();
    assertExists(env.RPC_URL, "RPC_URL should be configured");
    assertExists(
      env.PUMP_FUN_WALLET_PRIVATE_KEY,
      "PUMP_FUN_WALLET_PRIVATE_KEY should be configured",
    );

    logging.info("testnet-bundle-test", "Starting testnet Jito bundle test");

    const wallet1 = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    const wallet2 = Keypair.generate();
    const wallet3 = Keypair.generate();

    assertExists(wallet1, "Wallet1 keypair should be created");

    logging.info("testnet-bundle-test", "Using configured wallet", {
      wallet1: wallet1.publicKey.toString(),
      wallet2: wallet2.publicKey.toString(),
      wallet3: wallet3.publicKey.toString(),
    });

    const [connection, connectionError] = await getConnection();
    if (connectionError) {
      throw new Error(`Failed to get connection: ${connectionError}`);
    }

    const { blockhash } = await connection.getLatestBlockhash();

    const transfer1 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet1.publicKey,
        toPubkey: wallet2.publicKey,
        lamports: 1000000, // 0.001 SOL
      }),
    );
    transfer1.recentBlockhash = blockhash;
    transfer1.feePayer = wallet1.publicKey;
    transfer1.sign(wallet1);

    const transfer2 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet1.publicKey,
        toPubkey: wallet3.publicKey,
        lamports: 1000000, // 0.001 SOL
      }),
    );
    transfer2.recentBlockhash = blockhash;
    transfer2.feePayer = wallet1.publicKey;
    transfer2.sign(wallet1);

    const [tipResult, tipError] = await createTipTransaction({
      from: wallet1,
      tipAmountLamports: 1000, // 0.000001 SOL tip
      recentBlockhash: blockhash,
    });

    if (tipError) {
      throw new Error(`Failed to create tip transaction: ${tipError}`);
    }

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
    const bundle = new Bundle(transactions, 5);

    logging.info("testnet-bundle-test", "Created testnet bundle", {
      transactionCount: bundle.packets.length,
    });

    const [result, error] = await sendBundle(bundle, 30000);

    if (error) {
      const errorMessage = typeof error === "string"
        ? error
        : (error && typeof error === "object" && "message" in error)
        ? error.message
        : String(error);
      logging.error("testnet-bundle-test", "Bundle send failed", {
        error: errorMessage,
        errorType: typeof error,
      });
      throw new Error(`Bundle send failed: ${errorMessage}`);
    }

    assertExists(result, "Bundle result should exist");
    assertExists(result.bundleId, "Bundle ID should exist");
    assertEquals(result.success, true, "Bundle should be successful");

    logging.info("testnet-bundle-test", "Testnet bundle sent successfully", {
      bundleId: result.bundleId,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
