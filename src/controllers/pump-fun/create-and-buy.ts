import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { createAndBuy } from "../../services/pump-fun/create-and-buy.ts";
import { CreateAndBuyPayload } from "../../schemas/pump-fun.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";

export const createAndBuyToken: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Creating and buying token");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as CreateAndBuyPayload;
    const { walletId, tokenMeta, buyAmountSol } = body;

    const wallet = await keypairRepo.findById(walletId, requestId);
    if (!wallet) {
      logging.error(
        requestId,
        `Wallet with ID ${walletId} not found`,
        new Error("Wallet not found"),
      );
      ResponseUtil.notFound(ctx, `Wallet with ID ${walletId} not found`);
      return;
    }

    if (!wallet.is_active) {
      logging.error(
        requestId,
        `Wallet with ID ${walletId} is inactive`,
        new Error("Wallet is inactive"),
      );
      ResponseUtil.badRequest(ctx, `Wallet with ID ${walletId} is inactive`);
      return;
    }

    const keypair = keypairRepo.toKeypair(wallet.secret_key);
    if (!keypair) {
      logging.error(
        requestId,
        `Failed to convert wallet ${walletId} to keypair`,
        new Error("Failed to convert wallet to keypair"),
      );
      ResponseUtil.serverError(
        ctx,
        new Error("Failed to convert wallet to keypair"),
      );
      return;
    }

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
