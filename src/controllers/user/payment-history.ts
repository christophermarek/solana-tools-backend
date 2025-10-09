import type { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import type { PaymentHistoryResponse } from "./_dto.ts";
import * as userPaymentHistoryRepository from "../../db/repositories/user-payment-history.ts";
import type { AppContext, AppState } from "../../middleware/_context.ts";
import { getContext } from "../../middleware/_context.ts";

export const getPaymentHistory: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = async (ctx: AppContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;

  logging.info(requestId, "Getting payment history", {
    telegramId: telegramUser.telegram_id,
  });

  try {
    const result = await userPaymentHistoryRepository
      .listByTelegramUserId(
        telegramUser.telegram_id,
        requestId,
      );

    if (result[1]) {
      logging.error(requestId, "Failed to get payment history", result[1]);
      ResponseUtil.serverError(ctx, new Error(result[1]));
      return;
    }

    if (!result[0]) {
      logging.error(
        requestId,
        "Payment history is null",
        new Error("Payment history is null"),
      );
      ResponseUtil.serverError(ctx, new Error("Payment history is null"));
      return;
    }

    const response = {
      paymentHistory: result[0].map((item) => ({
        id: item.id,
        telegramId: item.telegram_id,
        amountInSol: item.amount_in_sol,
        signature: item.signature,
        depositedAt: item.deposited_at,
        processedAt: item.processed_at,
      })),
    };

    logging.info(requestId, "Retrieved payment history", {
      count: response.paymentHistory.length,
      telegramId: telegramUser.telegram_id,
    });

    ResponseUtil.success<PaymentHistoryResponse>(ctx, response);
  } catch (error) {
    logging.error(requestId, "Error getting payment history", error);
    ResponseUtil.serverError(ctx, error);
  }
};
