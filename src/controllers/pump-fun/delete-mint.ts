import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as pumpfunMintsRepo from "../../db/repositories/pumpfun-mints.ts";
import { DeleteMintPayload, DeleteMintResponse } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const deleteMint: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<DeleteMintPayload>
> = async (ctx: AppRouterContext<DeleteMintPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Deleting mint tracking");

  try {
    const { mint_public_key } = ctx.state.bodyData;

    // Check if mint exists and is owned by this user
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
        "You can only delete mints that you are tracking",
      );
      return;
    }

    // Delete the mint tracking entry
    await pumpfunMintsRepo.deleteByMintPublicKey(
      mint_public_key,
      telegramUser.telegram_id,
      requestId,
    );

    const responseData: DeleteMintResponse = {
      message: "Mint tracking successfully deleted",
    };

    logging.info(requestId, "Mint tracking deleted successfully", {
      mint: mint_public_key,
      user: telegramUser.telegram_id,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error deleting mint tracking", error);
    ResponseUtil.serverError(ctx, error);
  }
};
