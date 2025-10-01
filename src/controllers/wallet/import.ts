import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { ImportWalletPayload, ImportWalletResponse } from "./_dto.ts";
import { mapWalletFromDb } from "../../services/wallet/_utils.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const importWallet: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<ImportWalletPayload>
> = async (ctx: AppRouterContext<ImportWalletPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Importing existing wallet");

  try {
    const { secretKey, label } = ctx.state.bodyData;

    const [dbKeypair, error] = await keypairRepo.importWallet(
      secretKey,
      telegramUser.id,
      label,
      requestId,
    );
    if (!dbKeypair) {
      logging.error(requestId, `Failed to import wallet: ${error}`, error);
      ResponseUtil.serverError(
        ctx,
        new Error(`Failed to import wallet: ${error}`),
      );
      return;
    }

    const wallet = mapWalletFromDb(dbKeypair);

    logging.info(
      requestId,
      `Successfully imported wallet: ${wallet.publicKey}`,
    );

    const responseData: ImportWalletResponse = { wallet };
    ResponseUtil.created(ctx, responseData);

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error importing wallet", error);
    ResponseUtil.serverError(ctx, error);
  }
};
