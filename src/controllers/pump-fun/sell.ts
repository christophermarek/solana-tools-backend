import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { sell } from "../../services/pump-fun/sell.ts";
import { SellTokenPayload } from "./_dto.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { validateWalletAndGetKeypair } from "../../services/wallet/_utils.ts";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AppRouterContext,
  AppStateWithBody,
  getContext,
} from "../../middleware/_context.ts";

export const sellToken: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithBody<SellTokenPayload>
> = async (ctx: AppRouterContext<SellTokenPayload>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  logging.info(requestId, "Selling token");

  try {
    const {
      walletId,
      mintPublicKey,
      sellAmountSol,
      sellAmountSPL,
      slippageBps,
    } = ctx.state.bodyData;

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

    const sellParams = {
      ...(sellAmountSol !== undefined && { sellAmountSol }),
      ...(sellAmountSPL !== undefined && { sellAmountSPL }),
      ...(slippageBps !== undefined && { slippageBps }),
    };

    const [result, error] = await sell(keypair, mintKeypair, sellParams);

    if (error) {
      const errorMessage = typeof error === "string" ? error : error.message;
      logging.error(requestId, `Failed to sell token: ${errorMessage}`, error);
      ResponseUtil.serverError(ctx, new Error(errorMessage));
      return;
    }

    const responseData = {
      signature: result!.signature,
      curve: {
        virtualSolReserves: result!.curve.virtualSolReserves.toString(),
        virtualTokenReserves: result!.curve.virtualTokenReserves.toString(),
        realSolReserves: result!.curve.realSolReserves.toString(),
        realTokenReserves: result!.curve.realTokenReserves.toString(),
      },
      amountSold: result!.amountSold,
      totalSolReceived: result!.totalSolReceived,
      transactionFee: result!.transactionFee,
    };

    logging.info(requestId, "Token sold successfully", {
      mint: mintPublicKey,
      signature: result!.signature,
      sellType: sellAmountSol !== undefined ? "SOL value" : "SPL tokens",
      sellAmount: sellAmountSol !== undefined ? sellAmountSol : sellAmountSPL,
      amountSold: result!.amountSold,
      totalSolReceived: result!.totalSolReceived,
      transactionFee: result!.transactionFee,
    });

    ResponseUtil.success(ctx, responseData);
  } catch (error) {
    logging.error(requestId, "Error selling token", error);
    ResponseUtil.serverError(ctx, error);
  }
};
