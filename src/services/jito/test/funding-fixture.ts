import { assertExists } from "https://deno.land/std@0.220.1/assert/mod.ts";
import { loadEnv } from "../../../utils/env.ts";
import * as keypairRepo from "../../../db/repositories/keypairs.ts";
import * as solanaService from "../../solana/_index.ts";
import * as logging from "../../../utils/logging.ts";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getConnection } from "../../solana/connection.ts";

export interface FundingResult {
  success: boolean;
  fundedWallets: Keypair[];
  totalFunded: number;
  error?: string;
}

export interface WalletFundingInfo {
  keypair: Keypair;
  amountSol: number;
  success: boolean;
  error?: string;
}

const TAG = "funding-fixture";

const MIN_FUNDING_AMOUNT_SOL = 0.01;
const DEFAULT_FUNDING_AMOUNT_SOL = 0.1;

export async function checkFundingWalletBalance(): Promise<{
  hasEnoughBalance: boolean;
  currentBalance: number;
  requiredBalance: number;
  canFund: number;
}> {
  const env = await loadEnv();
  const fundingWallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
  assertExists(fundingWallet, "Funding wallet keypair should be created");

  const [balanceResult, balanceError] = await solanaService.getSolBalance({
    publicKey: fundingWallet.publicKey,
  });

  if (balanceError) {
    throw new Error(`Failed to get funding wallet balance: ${balanceError}`);
  }

  const currentBalance = solanaService.lamportsToSol(balanceResult.balance);
  const requiredBalance = MIN_FUNDING_AMOUNT_SOL * 10;
  const canFund = Math.floor(currentBalance / MIN_FUNDING_AMOUNT_SOL);

  logging.info(TAG, "Funding wallet balance check", {
    currentBalance,
    requiredBalance,
    canFund,
    hasEnoughBalance: currentBalance >= requiredBalance,
  });

  return {
    hasEnoughBalance: currentBalance >= requiredBalance,
    currentBalance,
    requiredBalance,
    canFund,
  };
}

export async function fundWallets(
  wallets: Keypair[],
  amountPerWalletSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
): Promise<FundingResult> {
  logging.info(TAG, "Starting wallet funding process", {
    walletCount: wallets.length,
    amountPerWallet: amountPerWalletSol,
  });

  const balanceCheck = await checkFundingWalletBalance();
  if (!balanceCheck.hasEnoughBalance) {
    const error =
      `Insufficient funding wallet balance. Current: ${balanceCheck.currentBalance} SOL, Required: ${balanceCheck.requiredBalance} SOL`;
    logging.error(TAG, "Insufficient funding wallet balance", error);
    return {
      success: false,
      fundedWallets: [],
      totalFunded: 0,
      error,
    };
  }

  const totalRequired = wallets.length * amountPerWalletSol;
  if (balanceCheck.currentBalance < totalRequired) {
    const error =
      `Insufficient balance for all wallets. Current: ${balanceCheck.currentBalance} SOL, Required: ${totalRequired} SOL`;
    logging.error(TAG, "Insufficient balance for all wallets", error);
    return {
      success: false,
      fundedWallets: [],
      totalFunded: 0,
      error,
    };
  }

  const env = await loadEnv();
  const fundingWallet = keypairRepo.toKeypair(env.TEST_WALLET_PRIVATE_KEY);
  assertExists(fundingWallet, "Funding wallet keypair should be created");

  const [connection, connectionError] = await getConnection();
  if (connectionError) {
    return {
      success: false,
      fundedWallets: [],
      totalFunded: 0,
      error: `Failed to get connection: ${connectionError}`,
    };
  }

  const fundedWallets: Keypair[] = [];
  const fundingResults: WalletFundingInfo[] = [];

  for (const wallet of wallets) {
    try {
      logging.info(TAG, "Funding wallet", {
        wallet: wallet.publicKey.toString(),
        amount: amountPerWalletSol,
      });

      const amountLamports = solanaService.solToLamports(amountPerWalletSol);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fundingWallet.publicKey,
          toPubkey: wallet.publicKey,
          lamports: amountLamports,
        }),
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fundingWallet.publicKey;

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fundingWallet],
        {
          commitment: "confirmed",
          maxRetries: 3,
        },
      );

      logging.info(TAG, "Wallet funded successfully", {
        wallet: wallet.publicKey.toString(),
        amount: amountPerWalletSol,
        signature,
      });

      fundedWallets.push(wallet);
      fundingResults.push({
        keypair: wallet,
        amountSol: amountPerWalletSol,
        success: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      logging.error(TAG, "Failed to fund wallet", {
        wallet: wallet.publicKey.toString(),
        error: errorMessage,
      });

      fundingResults.push({
        keypair: wallet,
        amountSol: amountPerWalletSol,
        success: false,
        error: errorMessage,
      });
    }
  }

  const successfulFunds = fundingResults.filter((r) => r.success);
  const totalFunded = successfulFunds.length * amountPerWalletSol;

  logging.info(TAG, "Funding process completed", {
    totalWallets: wallets.length,
    successfulFunds: successfulFunds.length,
    failedFunds: fundingResults.length - successfulFunds.length,
    totalFunded,
  });

  return {
    success: successfulFunds.length > 0,
    fundedWallets,
    totalFunded,
    error: successfulFunds.length < wallets.length
      ? `Only ${successfulFunds.length}/${wallets.length} wallets were funded successfully`
      : undefined,
  };
}

export async function fundWalletsWithRetry(
  wallets: Keypair[],
  amountPerWalletSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
  maxRetries: number = 3,
): Promise<FundingResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logging.info(TAG, `Funding attempt ${attempt}/${maxRetries}`, {
      walletCount: wallets.length,
      amountPerWallet: amountPerWalletSol,
    });

    const result = await fundWallets(wallets, amountPerWalletSol);

    if (result.success) {
      logging.info(TAG, "Funding successful", {
        attempt,
        fundedWallets: result.fundedWallets.length,
        totalFunded: result.totalFunded,
      });
      return result;
    }

    lastError = result.error;
    logging.warn(TAG, `Funding attempt ${attempt} failed`, {
      error: result.error,
      nextAttempt: attempt < maxRetries,
    });

    if (attempt < maxRetries) {
      const delayMs = attempt * 2000;
      logging.info(TAG, `Waiting ${delayMs}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: false,
    fundedWallets: [],
    totalFunded: 0,
    error:
      `All ${maxRetries} funding attempts failed. Last error: ${lastError}`,
  };
}

export async function createAndFundWallets(
  count: number,
  amountPerWalletSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
): Promise<FundingResult> {
  logging.info(TAG, "Creating and funding new wallets", {
    count,
    amountPerWallet: amountPerWalletSol,
  });

  const wallets: Keypair[] = [];
  for (let i = 0; i < count; i++) {
    wallets.push(Keypair.generate());
  }

  return await fundWalletsWithRetry(wallets, amountPerWalletSol);
}

export async function fundExistingWallets(
  wallets: Keypair[],
  amountPerWalletSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
): Promise<FundingResult> {
  logging.info(TAG, "Funding existing wallets", {
    count: wallets.length,
    amountPerWallet: amountPerWalletSol,
  });

  return await fundWalletsWithRetry(wallets, amountPerWalletSol);
}

async function heliusAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  lamports: number,
): Promise<number> {
  try {
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature);
    return lamports;
  } catch (error) {
    throw new Error(
      `Helius airdrop failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function fundWalletsWithTestnetAirdrop(
  wallets: Keypair[],
  targetAmountSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
): Promise<FundingResult> {
  logging.info(TAG, "Funding wallets with testnet airdrop", {
    walletCount: wallets.length,
    targetAmount: targetAmountSol,
  });

  const [connection, connectionError] = await getConnection();
  if (connectionError) {
    return {
      success: false,
      fundedWallets: [],
      totalFunded: 0,
      error: `Failed to get connection: ${connectionError}`,
    };
  }

  const fundedWallets: Keypair[] = [];
  const fundingResults: WalletFundingInfo[] = [];
  let totalFunded = 0;

  for (const wallet of wallets) {
    try {
      logging.info(TAG, "Testnet airdropping to wallet", {
        wallet: wallet.publicKey.toString(),
        targetAmount: targetAmountSol,
      });

      const airdropAmount = targetAmountSol * LAMPORTS_PER_SOL;
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        airdropAmount,
      );
      await connection.confirmTransaction(signature);

      const [balanceResult, balanceError] = await solanaService.getSolBalance({
        publicKey: wallet.publicKey,
      });

      if (balanceError) {
        throw new Error(`Failed to get balance after airdrop: ${balanceError}`);
      }

      const newBalance = balanceResult.balance;
      const actualBalance = solanaService.lamportsToSol(newBalance);

      logging.info(TAG, "Testnet wallet airdrop successful", {
        wallet: wallet.publicKey.toString(),
        newBalance: actualBalance,
        targetAmount: targetAmountSol,
        signature,
      });

      fundedWallets.push(wallet);
      fundingResults.push({
        keypair: wallet,
        amountSol: actualBalance,
        success: true,
      });
      totalFunded += actualBalance;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      logging.error(TAG, "Failed to testnet airdrop to wallet", {
        wallet: wallet.publicKey.toString(),
        error: errorMessage,
        errorDetails: JSON.stringify(error, null, 2),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      fundingResults.push({
        keypair: wallet,
        amountSol: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  const successfulFunds = fundingResults.filter((r) => r.success);

  logging.info(TAG, "Testnet airdrop funding process completed", {
    totalWallets: wallets.length,
    successfulFunds: successfulFunds.length,
    failedFunds: fundingResults.length - successfulFunds.length,
    totalFunded,
  });

  return {
    success: successfulFunds.length > 0,
    fundedWallets,
    totalFunded,
    error: successfulFunds.length < wallets.length
      ? `Only ${successfulFunds.length}/${wallets.length} wallets were funded successfully`
      : undefined,
  };
}

export async function fundWalletsWithAirdrop(
  wallets: Keypair[],
  targetAmountSol: number = DEFAULT_FUNDING_AMOUNT_SOL,
): Promise<FundingResult> {
  logging.info(TAG, "Funding wallets with airdrop", {
    walletCount: wallets.length,
    targetAmount: targetAmountSol,
  });

  const [connection, connectionError] = await getConnection();
  if (connectionError) {
    return {
      success: false,
      fundedWallets: [],
      totalFunded: 0,
      error: `Failed to get connection: ${connectionError}`,
    };
  }

  const fundedWallets: Keypair[] = [];
  const fundingResults: WalletFundingInfo[] = [];
  let totalFunded = 0;
  let airdropFailed = false;

  for (const wallet of wallets) {
    try {
      logging.info(TAG, "Airdropping to wallet", {
        wallet: wallet.publicKey.toString(),
        targetAmount: targetAmountSol,
      });

      const airdropAmount = targetAmountSol * LAMPORTS_PER_SOL;
      await heliusAirdrop(connection, wallet.publicKey, airdropAmount);

      const [balanceResult, balanceError] = await solanaService.getSolBalance({
        publicKey: wallet.publicKey,
      });

      if (balanceError) {
        throw new Error(`Failed to get balance after airdrop: ${balanceError}`);
      }

      const newBalance = balanceResult.balance;

      const actualBalance = solanaService.lamportsToSol(newBalance);
      logging.info(TAG, "Wallet airdrop successful", {
        wallet: wallet.publicKey.toString(),
        newBalance: actualBalance,
        targetAmount: targetAmountSol,
      });

      fundedWallets.push(wallet);
      fundingResults.push({
        keypair: wallet,
        amountSol: actualBalance,
        success: true,
      });
      totalFunded += actualBalance;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      logging.error(TAG, "Failed to airdrop to wallet", {
        wallet: wallet.publicKey.toString(),
        error: errorMessage,
        errorDetails: JSON.stringify(error, null, 2),
      });

      airdropFailed = true;
      fundingResults.push({
        keypair: wallet,
        amountSol: 0,
        success: false,
        error: errorMessage,
      });
    }
  }

  if (airdropFailed) {
    logging.warn(TAG, "Airdrop failed, falling back to manual funding", {
      failedCount: fundingResults.filter((r) => !r.success).length,
    });

    const balanceCheck = await checkFundingWalletBalance();
    if (!balanceCheck.hasEnoughBalance) {
      return {
        success: false,
        fundedWallets: [],
        totalFunded: 0,
        error:
          `Airdrop failed and insufficient balance in main wallet. Current: ${balanceCheck.currentBalance} SOL, Required: ${balanceCheck.requiredBalance} SOL`,
      };
    }

    const manualFundingResult = await fundWalletsWithRetry(
      wallets,
      targetAmountSol,
    );
    if (manualFundingResult.success) {
      return manualFundingResult;
    } else {
      return {
        success: false,
        fundedWallets: [],
        totalFunded: 0,
        error:
          `Both airdrop and manual funding failed. Airdrop error: Rate limit exceeded. Manual funding error: ${manualFundingResult.error}`,
      };
    }
  }

  const successfulFunds = fundingResults.filter((r) => r.success);

  logging.info(TAG, "Airdrop funding process completed", {
    totalWallets: wallets.length,
    successfulFunds: successfulFunds.length,
    failedFunds: fundingResults.length - successfulFunds.length,
    totalFunded,
  });

  return {
    success: successfulFunds.length > 0,
    fundedWallets,
    totalFunded,
    error: successfulFunds.length < wallets.length
      ? `Only ${successfulFunds.length}/${wallets.length} wallets were funded successfully`
      : undefined,
  };
}

export async function getWalletBalances(wallets: Keypair[]): Promise<{
  wallet: string;
  balance: number;
  success: boolean;
  error?: string;
}[]> {
  const results = [];

  for (const wallet of wallets) {
    try {
      const [balanceResult, balanceError] = await solanaService.getSolBalance({
        publicKey: wallet.publicKey,
      });

      if (balanceError) {
        results.push({
          wallet: wallet.publicKey.toString(),
          balance: 0,
          success: false,
          error: balanceError,
        });
      } else {
        const balance = solanaService.lamportsToSol(balanceResult.balance);
        results.push({
          wallet: wallet.publicKey.toString(),
          balance,
          success: true,
        });
      }
    } catch (error) {
      results.push({
        wallet: wallet.publicKey.toString(),
        balance: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

export interface CleanupResult {
  success: boolean;
  totalReturned: number;
  returnedWallets: string[];
  error?: string;
}

export async function cleanupTestWallets(
  testWallets: Keypair[],
  mainWallet: Keypair,
  reserveAmountSol: number = 0.001,
): Promise<CleanupResult> {
  logging.info(TAG, "Starting wallet cleanup process", {
    testWalletCount: testWallets.length,
    mainWallet: mainWallet.publicKey.toString(),
    reserveAmount: reserveAmountSol,
  });

  const [connection, connectionError] = await getConnection();
  if (connectionError) {
    return {
      success: false,
      totalReturned: 0,
      returnedWallets: [],
      error: `Failed to get connection: ${connectionError}`,
    };
  }

  const returnedWallets: string[] = [];
  let totalReturned = 0;

  for (const wallet of testWallets) {
    try {
      const [balanceResult, balanceError] = await solanaService.getSolBalance({
        publicKey: wallet.publicKey,
      });

      if (balanceError) {
        logging.warn(TAG, "Failed to get wallet balance for cleanup", {
          wallet: wallet.publicKey.toString(),
          error: balanceError,
        });
        continue;
      }

      const currentBalance = solanaService.lamportsToSol(balanceResult.balance);
      const amountToReturn = Math.max(0, currentBalance - reserveAmountSol);

      if (amountToReturn <= 0) {
        logging.info(TAG, "Wallet has insufficient balance for cleanup", {
          wallet: wallet.publicKey.toString(),
          currentBalance,
          reserveAmount: reserveAmountSol,
        });
        continue;
      }

      const amountLamports = solanaService.solToLamports(amountToReturn);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: mainWallet.publicKey,
          lamports: amountLamports,
        }),
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [wallet],
        {
          commitment: "confirmed",
          maxRetries: 3,
        },
      );

      logging.info(TAG, "Wallet cleanup successful", {
        wallet: wallet.publicKey.toString(),
        amountReturned: amountToReturn,
        signature,
      });

      returnedWallets.push(wallet.publicKey.toString());
      totalReturned += amountToReturn;

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      logging.error(TAG, "Failed to cleanup wallet", {
        wallet: wallet.publicKey.toString(),
        error: errorMessage,
      });
    }
  }

  logging.info(TAG, "Wallet cleanup process completed", {
    totalWallets: testWallets.length,
    returnedWallets: returnedWallets.length,
    totalReturned,
  });

  return {
    success: returnedWallets.length > 0,
    totalReturned,
    returnedWallets,
    error: returnedWallets.length < testWallets.length
      ? `Only ${returnedWallets.length}/${testWallets.length} wallets were cleaned up successfully`
      : undefined,
  };
}
