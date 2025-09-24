import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { buy } from "../../services/pump-fun/buy.ts";
import { BuyTokenPayload } from "../../schemas/pump-fun.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import { Keypair, PublicKey } from "@solana/web3.js";

export const buyToken: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Buying token");

  try {
    const body = await ctx.request.body({ type: "json" })
      .value as BuyTokenPayload;
    const { walletId, mintPublicKey, buyAmountSol } = body;

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

    const mintPublicKeyObj = new PublicKey(mintPublicKey);
    const mintKeypair = { publicKey: mintPublicKeyObj } as Keypair;

    const [result, error] = await buy(keypair, mintKeypair, buyAmountSol);

    if (error) {
      logging.error(requestId, `Failed to buy token: ${error}`, error);
      ResponseUtil.serverError(ctx, new Error(`Failed to buy token: ${error}`));
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
