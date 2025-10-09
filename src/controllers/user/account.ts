import type { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import type { AccountDataResponse } from "./_dto.ts";
import * as usersRepository from "../../db/repositories/users.ts";
import type { AppContext, AppState } from "../../middleware/_context.ts";
import { getContext } from "../../middleware/_context.ts";

export const getAccountData: RouterMiddleware<
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

  logging.info(requestId, "Getting account data", {
    telegramId: telegramUser.telegram_id,
  });

  try {
    const result = await usersRepository.getUser(
      telegramUser.telegram_id,
      requestId,
    );

    if (!result) {
      logging.error(requestId, "User not found", new Error("User not found"));
      ResponseUtil.serverError(ctx, new Error("User not found"));
      return;
    }

    const response: AccountDataResponse = {
      account: {
        id: result.id,
        telegramId: result.telegram_id,
        creditsExpireAt: result.credits_expire_at,
        createdAt: result.created_at,
      },
    };

    logging.info(requestId, "Retrieved account data", {
      telegramId: telegramUser.telegram_id,
      userId: result.id,
      creditsExpireAt: result.credits_expire_at,
    });

    ResponseUtil.success<AccountDataResponse>(ctx, response);
  } catch (error) {
    logging.error(requestId, "Error getting account data", error);
    ResponseUtil.serverError(ctx, error);
  }
};
