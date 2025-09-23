import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as transactionService from "../../services/transaction/index.ts";
import {
  SubmitTransactionPayload,
  TransactionIdParamPayload,
} from "../../schemas/transaction.schema.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const submitTransaction: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as TransactionIdParamPayload;
  logging.info(requestId, `Submitting transaction: ${params.transactionId}`);

  try {
    const body = await ctx.request.body().value as SubmitTransactionPayload;

    const transaction = await transactionService.submitTransaction({
      transactionId: params.transactionId,
      priorityFee: body.priorityFee,
    }, requestId);

    ResponseUtil.success(ctx, transaction);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to submit transaction: ${params.transactionId}`,
      error,
    );

    if (error instanceof Error && error.message.includes("not found")) {
      ResponseUtil.notFound(ctx, error.message);
    } else if (
      error instanceof Error &&
      (error.message.includes("DRAFT") ||
        error.message.includes("already in"))
    ) {
      ResponseUtil.badRequest(ctx, error.message);
    } else {
      ResponseUtil.serverError(ctx, error);
    }
  }
};
