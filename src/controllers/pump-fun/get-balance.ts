import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { getSPLBalance } from "../../services/pump-fun/get-spl-balance.ts";
import { GetTokenBalancePayload } from "../../schemas/pump-fun.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { PublicKey } from "@solana/web3.js";

export const getTokenBalance: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Getting token balance");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as GetTokenBalancePayload;
    const { walletId, mintPublicKey } = body;

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

    const walletPublicKey = new PublicKey(wallet.public_key);
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
      walletPublicKey: wallet.public_key,
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
