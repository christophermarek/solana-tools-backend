import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { buy } from "../../services/pump-fun/buy.ts";
import { BuyTokenPayload } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const buyToken: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<BuyTokenPayload>
> = async (ctx: AppRouterContext<BuyTokenPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Buying token");

  try {
    const { walletId, mintPublicKey, buyAmountSol, slippageBps } =
      ctx.state.bodyData;

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

    const keypair = validation!.keypair;

    const mintPublicKeyObj = new PublicKey(mintPublicKey);
    const mintKeypair = { publicKey: mintPublicKeyObj } as Keypair;

    const [result, buyError] = await buy(
      keypair,
      mintKeypair,
      buyAmountSol,
      slippageBps,
    );

    if (buyError) {
      const errorMessage = typeof buyError === "string"
        ? buyError
        : buyError.message;
      logging.error(
        requestId,
        `Failed to buy token: ${errorMessage}`,
        buyError,
      );
      ResponseUtil.serverError(ctx, new Error(errorMessage));
      return;
    }

    const responseData = {
      transaction: result!.transactionResult,
      curve: {
        virtualSolReserves: result!.curve.virtualSolReserves.toString(),
        virtualTokenReserves: result!.curve.virtualTokenReserves.toString(),
        realSolReserves: result!.curve.realSolReserves.toString(),
        realTokenReserves: result!.curve.realTokenReserves.toString(),
      },
    };

    logging.info(requestId, "Token bought successfully", {
      mint: mintPublicKey,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error buying token", error);
    ResponseUtil.serverError(ctx, error);
  }
};
