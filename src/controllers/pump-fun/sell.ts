import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { sell } from "../../services/pump-fun/sell.ts";
import { SellTokenPayload } from "../../schemas/pump-fun.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

export const sellToken: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Selling token");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as SellTokenPayload;
    const { walletId, mintPublicKey, sellAmountSol, sellAmountSPL } = body;

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

    const sellParams = {
      ...(sellAmountSol !== undefined && { sellAmountSol }),
      ...(sellAmountSPL !== undefined && { sellAmountSPL }),
    };

    const [result, error] = await sell(keypair, mintKeypair, sellParams);

    if (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      logging.error(requestId, `Failed to sell token: ${errorMessage}`, error);
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

    logging.info(requestId, "Token sold successfully", {
      mint: mintPublicKey,
      sellType: sellAmountSol !== undefined ? "SOL value" : "SPL tokens",
      sellAmount: sellAmountSol !== undefined ? sellAmountSol : sellAmountSPL,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error selling token", error);
    ResponseUtil.serverError(ctx, error);
  }
};
