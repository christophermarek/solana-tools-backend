import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as pumpfunMintsRepo from "../../db/repositories/pumpfun-mints.ts";
import { UntrackMintPayload, UntrackMintResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const untrackMint: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<UntrackMintPayload>
> = async (ctx: AppRouterContext<UntrackMintPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Untracking mint");

  try {
    const { mint_public_key } = ctx.state.bodyData;

    const existingMint = await pumpfunMintsRepo.findByMintPublicKey(
      mint_public_key,
      requestId,
    );

    if (!existingMint) {
      ResponseUtil.notFound(ctx, "Mint tracking not found");
      return;
    }

    if (existingMint.telegram_user_id !== telegramUser.telegram_id) {
      ResponseUtil.badRequest(
        ctx,
        "You can only untrack mints that you are tracking",
      );
      return;
    }

    await pumpfunMintsRepo.deleteByMintPublicKey(
      mint_public_key,
      telegramUser.telegram_id,
      requestId,
    );

    const responseData: UntrackMintResponse = {
      message: "Mint tracking successfully removed",
    };

    logging.info(requestId, "Mint untracked successfully", {
      mint: mint_public_key,
      user: telegramUser.telegram_id,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error untracking mint", error);
    ResponseUtil.serverError(ctx, error);
  }
};
