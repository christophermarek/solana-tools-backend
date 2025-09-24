import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { createAndBuy } from "../../services/pump-fun/create-and-buy.ts";
import { CreateAndBuyPayload } from "../../schemas/pump-fun.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";

export const createAndBuyToken: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Creating and buying token");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as CreateAndBuyPayload;
    const { walletId, tokenMeta, buyAmountSol } = body;

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

    const fullTokenMeta = {
      ...tokenMeta,
      description: tokenMeta.description ||
        `${tokenMeta.name} - ${tokenMeta.symbol}`,
      file: new Blob(),
    };

    const [result, error] = await createAndBuy(
      keypair,
      fullTokenMeta,
      buyAmountSol,
    );

    if (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      logging.error(
        requestId,
        `Failed to create and buy token: ${errorMessage}`,
        error,
      );
      ResponseUtil.serverError(ctx, new Error(errorMessage));
      return;
    }

    const responseData = {
      transaction: result!.transactionResult,
      mint: {
        publicKey: result!.mint.publicKey.toString(),
        secretKey: result!.mint.secretKey.toString(),
      },
      curve: {
        virtualSolReserves: result!.curve.virtualSolReserves.toString(),
        virtualTokenReserves: result!.curve.virtualTokenReserves.toString(),
        realSolReserves: result!.curve.realSolReserves.toString(),
        realTokenReserves: result!.curve.realTokenReserves.toString(),
      },
      pumpLink: result!.pumpLink,
    };

    logging.info(requestId, "Token created and bought successfully", {
      mint: result!.mint.publicKey.toString(),
      pumpLink: result!.pumpLink,
    });

    ResponseUtil.created(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error creating and buying token", error);
    ResponseUtil.serverError(ctx, error);
  }
};
