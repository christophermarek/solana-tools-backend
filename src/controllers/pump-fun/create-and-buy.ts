import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { createAndBuy } from "../../services/pump-fun/create-and-buy.ts";
import { CreateAndBuyPayload } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { validateImageForPumpFun } from "../../services/pump-fun/validate-image.ts";
import { type CreateTokenMetadata } from "pumpdotfun-repumped-sdk";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const createAndBuyToken: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<CreateAndBuyPayload>
> = async (ctx: AppRouterContext<CreateAndBuyPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Creating and buying token");

  try {
    const { walletId, tokenMeta, buyAmountSol, slippageBps, priorityFee } =
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

    let imageBlob: Blob;

    if (tokenMeta.imageBase64) {
      const [imageValidation, imageError] = validateImageForPumpFun(
        tokenMeta.imageBase64,
        requestId,
      );

      if (imageError) {
        logging.warn(requestId, "Image validation failed", imageError);
        ResponseUtil.badRequest(ctx, imageError.message);
        return;
      }

      imageBlob = imageValidation.blob;
    } else {
      logging.info(requestId, "No image provided, using empty blob");
      imageBlob = new Blob();
    }

    const description = tokenMeta.description ||
      `${tokenMeta.name} - ${tokenMeta.symbol}`;

    const fullTokenMeta: CreateTokenMetadata = {
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      description,
      file: imageBlob,
      ...(tokenMeta.twitter && { twitter: tokenMeta.twitter }),
      ...(tokenMeta.telegram && { telegram: tokenMeta.telegram }),
      ...(tokenMeta.website && { website: tokenMeta.website }),
    } as CreateTokenMetadata;

    const [result, error] = await createAndBuy(
      keypair,
      fullTokenMeta,
      buyAmountSol,
      telegramUser.telegram_id,
      slippageBps,
      priorityFee,
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
      amountBought: result!.amountBought,
      totalSolSpent: result!.totalSolSpent,
    };

    logging.info(requestId, "Token created and bought successfully", {
      mint: result!.mint.publicKey.toString(),
      pumpLink: result!.pumpLink,
      amountBought: result!.amountBought,
      totalSolSpent: result!.totalSolSpent,
    });

    ResponseUtil.created(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error creating and buying token", error);
    ResponseUtil.serverError(ctx, error);
  }
};
