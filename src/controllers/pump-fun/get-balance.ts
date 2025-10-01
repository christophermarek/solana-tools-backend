import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getSPLBalance } from "../../services/pump-fun/get-spl-balance.ts";
import { GetTokenBalancePayload } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { PublicKey } from "@solana/web3.js";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const getTokenBalance: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<GetTokenBalancePayload>
> = async (ctx: AppRouterContext<GetTokenBalancePayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Getting token balance");

  try {
    const { walletId, mintPublicKey } = ctx.state.bodyData;

    const [validation, validationError] = await validateWalletAndGetKeypair(
      walletId,
      telegramUser.id,
      requestId,
    );
    if (validationError) {
      if (validationError === "Wallet not found") {
        ResponseUtil.notFound(ctx, `Wallet with ID ${walletId} not found`);
      } else if (validationError === "Wallet is inactive") {
        ResponseUtil.badRequest(ctx, `Wallet with ID ${walletId} is inactive`);
      } else {
        ResponseUtil.serverError(ctx, new Error(validationError));
      }
      return;
    }

    const walletPublicKey = new PublicKey(validation!.wallet.public_key);
    const mintPublicKeyObj = new PublicKey(mintPublicKey);

    const [balance, error] = await getSPLBalance(
      walletPublicKey,
      mintPublicKeyObj,
    );

    if (error) {
      logging.error(requestId, `Failed to get token balance: ${error}`, error);
      ResponseUtil.serverError(
        ctx,
        new Error(`Failed to get token balance: ${error}`),
      );
      return;
    }

    const responseData = {
      walletId,
      walletPublicKey: validation!.wallet.public_key,
      mintPublicKey,
      balance,
    };

    logging.info(requestId, "Token balance retrieved successfully", {
      walletId,
      mintPublicKey,
      balance,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error getting token balance", error);
    ResponseUtil.serverError(ctx, error);
  }
};
