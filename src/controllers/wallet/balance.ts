import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as balanceService from "../../services/balance.service.ts";
import {
  WalletParamPayload,
} from "../../schemas/wallet.schema.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

export const getBalance: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as WalletParamPayload;
  const publicKey = params.publicKey;

  logging.info(
    requestId,
    `Getting balance for wallet with public key: ${publicKey}`,
  );

  try {
    const balance = await balanceService.getBalanceByPublicKey(
      publicKey,
      requestId,
    );

    if (!balance) {
      logging.info(requestId, `Wallet not found: ${publicKey}`);

      ctx.response.status = Status.NotFound;
      ctx.response.body = {
        success: false,
        message: `Wallet with public key ${publicKey} not found`,
      };

      logging.debug(requestId, "Not found response", ctx.response.body);
      return;
    }

    logging.info(requestId, `Retrieved balance for wallet: ${publicKey}`, {
      solBalance: balance.solBalance,
      wsolBalance: balance.wsolBalance,
      totalBalance: balance.totalBalance,
      balanceStatus: balance.balanceStatus,
    });

    ctx.response.status = Status.OK;
    ctx.response.body = {
      success: true,
      balance,
    };

    logging.debug(requestId, "Response body with balance", ctx.response.body);
  } catch (error) {
    logging.error(requestId, `Error getting balance for: ${publicKey}`, error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to get wallet balance",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};

export const refreshWalletBalance: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as WalletParamPayload;
  const publicKey = params.publicKey;

  logging.info(
    requestId,
    `Refreshing balance for wallet with public key: ${publicKey}`,
  );

  try {
    const balance = await balanceService.getBalanceByPublicKey(
      publicKey,
      requestId,
    );

    if (!balance) {
      logging.info(requestId, `Wallet not found: ${publicKey}`);

      ctx.response.status = Status.NotFound;
      ctx.response.body = {
        success: false,
        message: `Wallet with public key ${publicKey} not found`,
      };

      logging.debug(requestId, "Not found response", ctx.response.body);
      return;
    }

    logging.info(requestId, `Refreshed balance for wallet: ${publicKey}`, {
      solBalance: balance.solBalance,
      wsolBalance: balance.wsolBalance,
      totalBalance: balance.totalBalance,
      balanceStatus: balance.balanceStatus,
      lastUpdated: balance.lastUpdated,
    });

    ctx.response.status = Status.OK;
    ctx.response.body = {
      success: true,
      balance,
    };

    logging.debug(requestId, "Response body with refreshed balance", ctx.response.body);
  } catch (error) {
    logging.error(requestId, `Error refreshing balance for: ${publicKey}`, error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to refresh wallet balance",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};

