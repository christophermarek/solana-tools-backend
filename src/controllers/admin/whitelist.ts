import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import {
  WhitelistActionPayload,
  WhitelistAddResponse,
  WhitelistDeleteResponse,
} from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";
import whitelistRepository from "../../db/repositories/whitelist.ts";

export const manageWhitelist: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<WhitelistActionPayload>
> = async (ctx: AppRouterContext<WhitelistActionPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(
    requestId,
    `Admin ${telegramUser.telegram_id} managing whitelist`,
  );

  try {
    const { telegramID, action } = ctx.state.bodyData;

    if (action === "add") {
      const whitelistedUser = await whitelistRepository
        .addTelegramUserToWhitelist(
          telegramID,
          requestId,
        );

      logging.info(
        requestId,
        `Admin ${telegramUser.telegram_id} added user ${telegramID} to whitelist`,
      );

      const response: WhitelistAddResponse = {
        user: whitelistedUser,
      };

      ResponseUtil.success(ctx, response);
    } else if (action === "delete") {
      await whitelistRepository.removeTelegramUserFromWhitelist(
        telegramID,
        requestId,
      );

      logging.info(
        requestId,
        `Admin ${telegramUser.telegram_id} removed user ${telegramID} from whitelist`,
      );

      const response: WhitelistDeleteResponse = {};

      ResponseUtil.success(ctx, response);
    }
  } catch (error) {
    logging.error(requestId, "Error managing whitelist", error);
    ResponseUtil.serverError(ctx, error);
  }
};
