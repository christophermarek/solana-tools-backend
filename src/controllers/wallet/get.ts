import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { WalletParamPayload } from "../../schemas/wallet.schema.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

export const getWallet: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.params as WalletParamPayload;
  const publicKey = params.publicKey;

  logging.info(requestId, `Getting wallet with public key: ${publicKey}`);

  try {
    const dbKeypair = await keypairRepo.findByPublicKey(publicKey);

    if (!dbKeypair) {
      logging.info(requestId, `Wallet not found: ${publicKey}`);

      ctx.response.status = Status.NotFound;
      ctx.response.body = {
        success: false,
        message: `Wallet with public key ${publicKey} not found`,
      };

      logging.debug(requestId, "Not found response", ctx.response.body);
      return;
    }

    logging.info(requestId, `Found wallet: ${publicKey} (ID: ${dbKeypair.id})`);

    ctx.response.status = Status.OK;
    ctx.response.body = {
      success: true,
      wallet: {
        id: dbKeypair.id,
        publicKey: dbKeypair.public_key,
        label: dbKeypair.label,
        created: dbKeypair.created_at,
        isActive: dbKeypair.is_active,
        solBalance: dbKeypair.sol_balance
          ? Number(dbKeypair.sol_balance)
          : null,
        wsolBalance: dbKeypair.wsol_balance
          ? Number(dbKeypair.wsol_balance)
          : null,
        lastBalanceUpdate: dbKeypair.last_balance_update,
      },
    };

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, `Error getting wallet: ${publicKey}`, error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to get wallet",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};
