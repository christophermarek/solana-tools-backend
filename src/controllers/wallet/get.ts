import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { GetWalletResponse, WalletParamPayload } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { mapWalletFromDb } from "../../services/wallet/_utils.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppState,
  getContext,
} from "../../middleware/_context.ts";

export const getWallet: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = async (ctx: AppRouterContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, _telegramUser] = contextData;
  const params = ctx.params as WalletParamPayload;
  const publicKey = params.publicKey;

  logging.info(requestId, `Getting wallet with public key: ${publicKey}`);

  try {
    const dbKeypair: DbKeypair | null = await keypairRepo.findByPublicKey(
      publicKey,
    );

    if (!dbKeypair) {
      logging.info(requestId, `Wallet not found: ${publicKey}`);
      ResponseUtil.notFound(
        ctx,
        `Wallet with public key ${publicKey} not found`,
      );
      return;
    }

    const wallet = mapWalletFromDb(dbKeypair);
    logging.info(requestId, `Found wallet: ${publicKey} (ID: ${wallet.id})`);

    const responseData: GetWalletResponse = { wallet };
    ResponseUtil.success(ctx, responseData);

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(
      requestId,
      `Failed to get wallet: ${publicKey}`,
      error,
    );
    ResponseUtil.serverError(ctx, error);
  }
};
