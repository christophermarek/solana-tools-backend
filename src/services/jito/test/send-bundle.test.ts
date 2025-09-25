import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import { sendBundle } from "../send-bundle.ts";
import { createTestToken } from "../../pump-fun/test/fixtures.ts";
import { getBuyInstructionsBySolAmount } from "../../pump-fun/get-buy-instructions.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as logging from "../../../utils/logging.ts";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { Bundle } from "jito-ts/dist/sdk/block-engine/types.js";
import { fundExistingWallets, getWalletBalances } from "./funding-fixture.ts";

Deno.test({
  name: "Test send bundle with 2 buy transactions from different wallets",
  async fn() {
    const env = await loadEnv();
    assertExists(
      env.PUMP_FUN_WALLET_PRIVATE_KEY,
      "PUMP_FUN_WALLET_PRIVATE_KEY should be configured",
    );
    assertExists(env.RPC_URL, "RPC_URL should be configured");

    const testToken = await createTestToken();
    logging.info("send-bundle-test", "Using test token", {
      mint: testToken.mint.publicKey.toString(),
      pumpLink: testToken.pumpLink,
    });

    const wallet1 = keypairRepo.toKeypair(env.PUMP_FUN_WALLET_PRIVATE_KEY);
    const wallet2 = Keypair.generate();
    const wallet3 = Keypair.generate();

    assertExists(wallet1, "Wallet1 keypair should be created");

    const walletsToFund = [wallet2, wallet3];
    logging.info("send-bundle-test", "Funding test wallets", {
      walletCount: walletsToFund.length,
    });

    const fundingResult = await fundExistingWallets(walletsToFund, 0.1);
    if (!fundingResult.success) {
      logging.warn("send-bundle-test", "Failed to fund wallets", {
        error: fundingResult.error,
        fundedCount: fundingResult.fundedWallets.length,
      });
    } else {
      logging.info("send-bundle-test", "Wallets funded successfully", {
        fundedCount: fundingResult.fundedWallets.length,
        totalFunded: fundingResult.totalFunded,
      });

      const balanceResults = await getWalletBalances(walletsToFund);
      logging.info("send-bundle-test", "Wallet balances after funding", {
        balances: balanceResults.map((r) => ({
          wallet: r.wallet,
          balance: r.balance,
          success: r.success,
        })),
      });
    }

    const buyAmountSol = 0.002;

    logging.info("send-bundle-test", "Creating buy transactions", {
      wallet1: wallet1.publicKey.toString(),
      wallet2: wallet2.publicKey.toString(),
      wallet3: wallet3.publicKey.toString(),
      mint: testToken.mint.publicKey.toString(),
      buyAmountSol,
    });

    const [buy1Transaction, buy1Error] = await getBuyInstructionsBySolAmount(
      wallet1,
      testToken.mint.publicKey,
      buyAmountSol,
    );

    const [buy2Transaction, buy2Error] = await getBuyInstructionsBySolAmount(
      wallet2,
      testToken.mint.publicKey,
      buyAmountSol,
    );

    if (buy1Error || buy2Error) {
      throw new Error(
        `Failed to create buy transactions: buy1=${buy1Error}, buy2=${buy2Error}`,
      );
    }

    const transactions = [
      buy1Transaction! as unknown as VersionedTransaction,
      buy2Transaction! as unknown as VersionedTransaction,
    ];

    const bundle = new Bundle(transactions, 5);

    logging.info("send-bundle-test", "Created bundle", {
      transactionCount: bundle.packets.length,
    });

    const [result, error] = await sendBundle(bundle);

    if (error) {
      throw new Error(`Bundle send failed: ${error}`);
    }

    assertExists(result, "Bundle result should exist");
    assertExists(result.bundleId, "Bundle ID should exist");
    assertEquals(result.success, true, "Bundle should be successful");

    logging.info("send-bundle-test", "Bundle sent successfully", {
      bundleId: result.bundleId,
    });
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
