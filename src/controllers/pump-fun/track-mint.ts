import type { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as pumpfunMintsRepo from "../../db/repositories/pumpfun-mints.ts";
import type { TrackMintPayload, TrackMintResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import type {
  AppRouterContext,
  AppStateWithBody,
} from "../../middleware/_context.ts";
import { getContext } from "../../middleware/_context.ts";

export const trackMint: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<TrackMintPayload>
> = async (ctx: AppRouterContext<TrackMintPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Tracking mint");

  try {
    const { mint_public_key } = ctx.state.bodyData;

    const existingMint = await pumpfunMintsRepo.findByMintPublicKey(
      mint_public_key,
      requestId,
    );

    if (existingMint) {
      if (existingMint.telegram_user_id === telegramUser.telegram_id) {
        const responseData: TrackMintResponse = {
          mint: existingMint,
          message: "Mint is already being tracked",
        };
        ResponseUtil.success(ctx, responseData);
        return;
      } else {
        ResponseUtil.badRequest(
          ctx,
          "Mint is already being tracked by another user",
        );
        return;
      }
    }

    // Create new mint tracking entry
    const newMint = await pumpfunMintsRepo.create(
      {
        mint_public_key,
        telegram_user_id: telegramUser.telegram_id,
      },
      requestId,
    );

    const responseData: TrackMintResponse = {
      mint: newMint,
      message: "Mint successfully tracked",
    };

    logging.info(requestId, "Mint tracked successfully", {
      mint: mint_public_key,
      user: telegramUser.telegram_id,
    });

    ResponseUtil.created(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error tracking mint", error);
    ResponseUtil.serverError(ctx, error);
  }
};
