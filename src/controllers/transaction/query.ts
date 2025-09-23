import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as transactionService from "../../services/transaction/index.ts";
import {
  TransactionHistoryQueryPayload,
  TransactionIdParamPayload,
  TransactionSignatureParamPayload,
  WalletIdParamPayload,
} from "../../schemas/transaction.schema.ts";
import { ResponseUtil } from "../../routes/response.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
export const getTransactionDetails: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as TransactionIdParamPayload;
  logging.info(
    requestId,
    `Getting transaction details: ${params.transactionId}`,
  );

  try {
    const transaction = await transactionService.getTransactionById(
      params.transactionId,
      requestId,
    );

    if (!transaction) {
      ResponseUtil.notFound(
        ctx,
        `Transaction with ID ${params.transactionId} not found`,
      );
      return;
    }

    ResponseUtil.success(ctx, transaction);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction details: ${params.transactionId}`,
      error,
    );
    ResponseUtil.serverError(ctx, error);
  }
};

export const getTransactionBySignature: RouterMiddleware<string> = async (
  ctx,
) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as TransactionSignatureParamPayload;
  logging.info(
    requestId,
    `Getting transaction by signature: ${params.signature}`,
  );

  try {
    const transaction = await transactionService.getTransactionBySignature(
      params.signature,
      requestId,
    );

    if (!transaction) {
      ResponseUtil.notFound(
        ctx,
        `Transaction with signature ${params.signature} not found`,
      );
      return;
    }

    ResponseUtil.success(ctx, transaction);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get transaction by signature: ${params.signature}`,
      error,
    );
    ResponseUtil.serverError(ctx, error);
  }
};

export const getWalletTransactions: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as WalletIdParamPayload;

  const url = new URL(ctx.request.url);
  const limit = url.searchParams.get("limit")
    ? parseInt(url.searchParams.get("limit")!)
    : 20;
  const offset = url.searchParams.get("offset")
    ? parseInt(url.searchParams.get("offset")!)
    : 0;

  logging.info(
    requestId,
    `Getting transaction history for wallet: ${params.walletId}`,
    { limit, offset },
  );

  try {
    const result = await transactionService.getWalletTransactionHistory(
      params.walletId,
      limit,
      offset,
      requestId,
    );

    ResponseUtil.success(ctx, result);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get wallet transaction history: ${params.walletId}`,
      error,
    );

    if (error instanceof Error && error.message.includes("not found")) {
      ResponseUtil.notFound(ctx, error.message);
    } else {
      ResponseUtil.serverError(ctx, error);
    }
  }
};

export const listTransactions: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);

  const url = new URL(ctx.request.url);
  const queryParams: TransactionHistoryQueryPayload = {
    limit: url.searchParams.get("limit")
      ? parseInt(url.searchParams.get("limit")!)
      : 20,
    offset: url.searchParams.get("offset")
      ? parseInt(url.searchParams.get("offset")!)
      : 0,
  };

  if (url.searchParams.has("status")) {
    queryParams.status = url.searchParams.get("status") as any;
  }

  if (url.searchParams.has("tokenType")) {
    queryParams.tokenType = url.searchParams.get("tokenType") as any;
  }

  logging.info(requestId, `Listing transactions with filters`, queryParams);

  try {
    const result = await transactionService.listTransactions(
      queryParams,
      requestId,
    );

    ResponseUtil.success(ctx, result);
  } catch (error) {
    logging.error(requestId, "Failed to list transactions", error);
    ResponseUtil.serverError(ctx, error);
  }
};
