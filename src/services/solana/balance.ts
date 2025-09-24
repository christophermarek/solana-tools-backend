import { PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as logging from "../../utils/logging.ts";
import * as connectionService from "./connection.ts";
import * as rateLimiter from "./rate-limiter.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { TAG } from "./_constants.ts";
import { SOLANA_ERRORS, SolanaErrors } from "./_errors.ts";
import {
  BalanceResult,
  GetBalanceParams,
  GetBalanceResult,
  GetSolBalanceParams,
  GetSolBalanceResult,
  GetTotalSolBalanceParams,
  GetTotalSolBalanceResult,
  GetWsolBalanceParams,
  GetWsolBalanceResult,
  WalletBalance,
} from "./_types.ts";
import { lamportsToSol, solToLamports } from "./_utils.ts";

export async function getSolBalance(
  params: GetSolBalanceParams,
): Promise<[GetSolBalanceResult, null] | [null, SolanaErrors]> {
  const { publicKey, requestId = TAG } = params;

  try {
    await rateLimiter.waitForRateLimit("getBalance", requestId);

    const [connection, connectionError] = await connectionService
      .getConnection();
    if (connectionError) {
      return [null, connectionError];
    }

    logging.debug(requestId, "Fetching SOL balance", {
      publicKey: publicKey.toString(),
    });

    const startTime = performance.now();
    const balance = await connection.getBalance(publicKey);
    const endTime = performance.now();

    logging.debug(requestId, "Fetched SOL balance successfully", {
      publicKey: publicKey.toString(),
      balanceLamports: balance,
      balanceSol: lamportsToSol(balance),
      responseTimeMs: Math.round(endTime - startTime),
    });

    return [{ balance }, null];
  } catch (error) {
    logging.error(requestId, "Failed to fetch SOL balance", error);
    return [null, SOLANA_ERRORS.ERROR_BALANCE_FETCH_FAILED];
  }
}

export async function getWsolBalance(
  params: GetWsolBalanceParams,
): Promise<[GetWsolBalanceResult, null] | [null, SolanaErrors]> {
  const { publicKey, requestId = TAG } = params;

  try {
    await rateLimiter.waitForRateLimit("getTokenAccountBalance", requestId);

    const [connection, connectionError] = await connectionService
      .getConnection();
    if (connectionError) {
      return [null, connectionError];
    }

    const ataAddress = await spl.getAssociatedTokenAddress(
      new PublicKey(spl.NATIVE_MINT),
      publicKey,
    );

    logging.debug(requestId, "Fetching WSOL balance", {
      publicKey: publicKey.toString(),
      tokenAccount: ataAddress.toString(),
    });

    try {
      const startTime = performance.now();
      const balance = await connection.getTokenAccountBalance(ataAddress);
      const endTime = performance.now();

      logging.debug(requestId, "Fetched WSOL balance successfully", {
        publicKey: publicKey.toString(),
        tokenAccount: ataAddress.toString(),
        balance: Number(balance.value.amount),
        responseTimeMs: Math.round(endTime - startTime),
      });

      return [{ balance: Number(balance.value.amount) }, null];
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("could not find account") ||
          error.message.includes("not found"))
      ) {
        logging.debug(requestId, "WSOL token account not found, returning 0", {
          publicKey: publicKey.toString(),
          tokenAccount: ataAddress.toString(),
        });
        return [{ balance: 0 }, null];
      }

      throw error;
    }
  } catch (error) {
    logging.error(requestId, "Failed to fetch WSOL balance", error);
    return [null, SOLANA_ERRORS.ERROR_BALANCE_FETCH_FAILED];
  }
}

export async function getTotalSolBalance(
  params: GetTotalSolBalanceParams,
): Promise<[GetTotalSolBalanceResult, null] | [null, SolanaErrors]> {
  const { publicKey, requestId = TAG } = params;

  try {
    const [nativeResult, wrappedResult] = await Promise.all([
      getSolBalance({ publicKey, requestId }),
      getWsolBalance({ publicKey, requestId }),
    ]);

    if (nativeResult[1] || wrappedResult[1]) {
      return [null, SOLANA_ERRORS.ERROR_BALANCE_FETCH_FAILED];
    }

    const nativeSolLamports = nativeResult[0].balance;
    const wrappedSolLamports = wrappedResult[0].balance;
    const totalLamports = nativeSolLamports + wrappedSolLamports;

    const balance: BalanceResult = {
      nativeSol: lamportsToSol(nativeSolLamports),
      wrappedSol: lamportsToSol(wrappedSolLamports),
      totalLamports,
      totalSol: lamportsToSol(totalLamports),
    };

    return [{ balance }, null];
  } catch (error) {
    logging.error(requestId, "Failed to fetch total SOL balance", error);
    return [null, SOLANA_ERRORS.ERROR_BALANCE_FETCH_FAILED];
  }
}

export async function getBalanceByPublicKey(
  params: GetBalanceParams,
): Promise<[GetBalanceResult, null] | [null, SolanaErrors]> {
  const { publicKey: publicKeyStr, requestId = TAG } = params;

  logging.info(requestId, `Getting balance for wallet: ${publicKeyStr}`);

  try {
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(publicKeyStr);
    } catch (error) {
      const errorMessage = `Invalid public key format: ${publicKeyStr}`;
      logging.error(requestId, errorMessage, error);
      return [null, SOLANA_ERRORS.ERROR_INVALID_PUBLIC_KEY];
    }

    const dbKeypair = await keypairRepo.findByPublicKey(publicKeyStr);
    if (!dbKeypair) {
      logging.info(requestId, `Wallet not found in database: ${publicKeyStr}`);
      return [{ balance: null }, null];
    }

    const [balanceResult, error] = await getTotalSolBalance({
      publicKey,
      requestId,
    });

    if (error) {
      return [null, error];
    }

    const solLamports = solToLamports(balanceResult.balance.nativeSol);
    const wsolLamports = solToLamports(balanceResult.balance.wrappedSol);

    const updatedKeypair = await keypairRepo.updateBalanceByPublicKey(
      publicKeyStr,
      {
        sol_balance: solLamports,
        wsol_balance: wsolLamports,
        balance_status: keypairRepo.BalanceStatus.FRESH,
      },
    );

    const walletBalance: WalletBalance = {
      id: dbKeypair.id,
      publicKey: dbKeypair.public_key,
      label: dbKeypair.label,
      solBalance: balanceResult.balance.nativeSol,
      wsolBalance: balanceResult.balance.wrappedSol,
      totalBalance: balanceResult.balance.totalSol,
      lastUpdated: updatedKeypair.last_balance_update
        ? new Date(updatedKeypair.last_balance_update)
        : new Date(),
      balanceStatus: updatedKeypair.balance_status,
    };

    logging.debug(requestId, `Successfully retrieved balance for wallet`, {
      publicKey: publicKeyStr,
      solBalance: walletBalance.solBalance,
      wsolBalance: walletBalance.wsolBalance,
      totalBalance: walletBalance.totalBalance,
      solLamports,
      wsolLamports,
    });

    return [{ balance: walletBalance }, null];
  } catch (error) {
    const errorMessage =
      `Failed to fetch balance for public key ${publicKeyStr}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    logging.error(requestId, errorMessage, error);
    return [null, SOLANA_ERRORS.ERROR_BALANCE_FETCH_FAILED];
  }
}

export default {
  getSolBalance,
  getWsolBalance,
  getTotalSolBalance,
  getBalanceByPublicKey,
};
