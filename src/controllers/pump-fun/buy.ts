import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { buy } from "../../services/pump-fun/buy.ts";
import { BuyTokenPayload } from "./_dto.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

export const buyToken: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Buying token");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as BuyTokenPayload;
    const { walletId, mintPublicKey, buyAmountSol } = body;

    const [validation, validationError] = await validateWalletAndGetKeypair(
      walletId,
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

    const [result, buyError] = await buy(keypair, mintKeypair, buyAmountSol);

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
