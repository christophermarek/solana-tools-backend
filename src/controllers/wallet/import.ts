import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { ImportWalletPayload } from "../../schemas/wallet.ts";
import { mapWalletFromDb } from "../../services/wallet/_utils.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const importWallet: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Importing existing wallet");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as ImportWalletPayload;
    const { secretKey, label } = body;

    const [dbKeypair, error] = await keypairRepo.importWallet(
      secretKey,
      label,
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

    ResponseUtil.created(ctx, { wallet });

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error importing wallet", error);
    ResponseUtil.serverError(ctx, error);
  }
};
