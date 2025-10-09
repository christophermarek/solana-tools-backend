import type { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import type { RedeemCreditsResponse } from "./_dto.ts";
import * as usersRepository from "../../db/repositories/users.ts";
import * as settingsRepository from "../../db/repositories/settings.ts";
import type { AppContext, AppState } from "../../middleware/_context.ts";
import { getContext } from "../../middleware/_context.ts";

export const redeemCredits: RouterMiddleware<
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
  const body = ctx.state.bodyData as { daysToRedeem: number };

  logging.info(requestId, "Processing credit redemption", {
    telegramId: telegramUser.telegram_id,
    daysToRedeem: body.daysToRedeem,
  });

  try {
    const solPerCreditResult = await settingsRepository.getSolPerCredit(
      requestId,
    );

    if (solPerCreditResult[1]) {
      logging.error(
        requestId,
        "Failed to get SOL_PER_CREDIT setting",
        solPerCreditResult[1],
      );
      ResponseUtil.serverError(
        ctx,
        new Error("Failed to get SOL_PER_CREDIT setting"),
      );
      return;
    }

    if (!solPerCreditResult[0]) {
      logging.error(
        requestId,
        "SOL_PER_CREDIT setting is null",
        new Error("SOL_PER_CREDIT setting is null"),
      );
      ResponseUtil.serverError(
        ctx,
        new Error("SOL_PER_CREDIT setting is null"),
      );
      return;
    }

    const solPerDay = solPerCreditResult[0];
    const processResult = await usersRepository.processPayments(
      {
        telegram_id: telegramUser.telegram_id,
        daysToRedeem: body.daysToRedeem,
        solPerDay,
      },
      requestId,
    );

    if (processResult[1]) {
      const response: RedeemCreditsResponse = {
        success: false,
        message: processResult[1],
        creditsExpireAt: telegramUser.credits_expire_at,
        totalDaysRedeemed: 0,
        totalSolSpent: 0,
        paymentsProcessed: 0,
      };

      logging.warn(requestId, "Payment processing failed", {
        telegramId: telegramUser.telegram_id,
        error: processResult[1],
      });

      ResponseUtil.success<RedeemCreditsResponse>(ctx, response);
      return;
    }

    if (!processResult[0]) {
      logging.error(
        requestId,
        "Process result is null",
        new Error("Process result is null"),
      );
      ResponseUtil.serverError(ctx, new Error("Process result is null"));
      return;
    }

    const processData = processResult[0];
    const currentExpiry = telegramUser.credits_expire_at
      ? new Date(telegramUser.credits_expire_at)
      : new Date();

    const newExpiryDate = new Date(currentExpiry);
    newExpiryDate.setDate(
      newExpiryDate.getDate() + processData.totalDaysRedeemed,
    );

    const updateResult = await usersRepository.updateUser(
      telegramUser.telegram_id,
      { credits_expire_at: newExpiryDate },
      requestId,
    );

    if (updateResult[1]) {
      logging.error(
        requestId,
        "Failed to update user credits",
        updateResult[1],
      );
      ResponseUtil.serverError(ctx, new Error(updateResult[1]));
      return;
    }

    const response: RedeemCreditsResponse = {
      success: true,
      message:
        `Successfully redeemed ${processData.totalDaysRedeemed} days of credits`,
      creditsExpireAt: newExpiryDate.toISOString(),
      totalDaysRedeemed: processData.totalDaysRedeemed,
      totalSolSpent: processData.totalSolSpent,
      paymentsProcessed: processData.paymentsProcessed,
    };

    logging.info(requestId, "Credit redemption completed", {
      telegramId: telegramUser.telegram_id,
      daysRedeemed: processData.totalDaysRedeemed,
      totalSolSpent: processData.totalSolSpent,
      paymentsProcessed: processData.paymentsProcessed,
      newExpiryDate: newExpiryDate.toISOString(),
    });

    ResponseUtil.success<RedeemCreditsResponse>(ctx, response);
  } catch (error) {
    logging.error(requestId, "Error processing credit redemption", error);
    ResponseUtil.serverError(ctx, error);
  }
};
