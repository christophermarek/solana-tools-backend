import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { WalletParamPayload } from "../../schemas/wallet.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { mapWalletFromDb } from "../../services/wallet/_utils.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const getWallet: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.state.paramsData as WalletParamPayload;
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

    ResponseUtil.success(ctx, { wallet });

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
