import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as transactionService from "../../services/transaction/index.ts";
import { CreateTransactionPayload } from "../../schemas/transaction.schema.ts";
import { ResponseUtil } from "../../routes/response.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

export const createDraftTransaction: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Creating draft transaction");

  try {
    const body = await ctx.request.body().value as CreateTransactionPayload;

    const transaction = await transactionService.createDraftTransaction(
      body,
      requestId,
    );

    ResponseUtil.success(ctx, transaction, Status.Created);
  } catch (error) {
    logging.error(requestId, "Failed to create draft transaction", error);

    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("Invalid destination"))
    ) {
      ResponseUtil.badRequest(ctx, error.message);
    } else if (
      error instanceof Error &&
      error.message.includes("Insufficient")
    ) {
      ResponseUtil.badRequest(ctx, error.message);
    } else {
      ResponseUtil.serverError(ctx, error);
    }
  }
};
