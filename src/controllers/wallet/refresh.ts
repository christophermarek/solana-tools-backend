import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getBalanceByPublicKey } from "../../services/solana/balance.ts";
import { WalletParamPayload } from "../../schemas/wallet.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";

export const refreshWalletBalance: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const params = ctx.state.paramsData as WalletParamPayload;
  const publicKey = params.publicKey;

  logging.info(
    requestId,
    `Refreshing balance for wallet with public key: ${publicKey}`,
  );

  try {
    const balance = await getBalanceByPublicKey(publicKey, requestId);

    if (!balance) {
      logging.info(requestId, `Wallet not found: ${publicKey}`);
      ResponseUtil.notFound(
        ctx,
        `Wallet with public key ${publicKey} not found`,
      );
      return;
    }

    logging.info(requestId, `Refreshed balance for wallet: ${publicKey}`, {
      solBalance: balance.solBalance,
      wsolBalance: balance.wsolBalance,
      totalBalance: balance.totalBalance,
      balanceStatus: balance.balanceStatus,
      lastUpdated: balance.lastUpdated,
    });

    ResponseUtil.success(ctx, { balance });

    logging.debug(
      requestId,
      "Response body with refreshed balance",
      ctx.response.body,
    );
  } catch (error) {
    logging.error(
      requestId,
      `Error refreshing balance for: ${publicKey}`,
      error,
    );
    ResponseUtil.serverError(ctx, error);
  }
};
