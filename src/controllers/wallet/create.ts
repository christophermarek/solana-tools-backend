import { Keypair } from "@solana/web3.js";
import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as balanceService from "../../services/balance.service.ts";
import { CreateWalletsPayload } from "../../schemas/wallet.schema.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

export const createWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Creating new wallets");

  const body = await ctx.request.body({ type: "json" })
    .value as CreateWalletsPayload;
  const count = body.count || 1;
  const label = body.label;

  try {
    logging.info(
      requestId,
      `Generating ${count} wallets${label ? ` with label: ${label}` : ""}`,
    );

    const wallets: {
      publicKey: string;
      id: number;
      label?: string;
      isActive: boolean;
      balance?: {
        solBalance: number;
        wsolBalance: number;
        totalBalance: number;
        lastUpdated: Date;
        balanceStatus: string;
      };
    }[] = [];

    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();

      logging.debug(
        requestId,
        `Generated keypair with public key: ${publicKey}`,
      );

      const dbKeypair = await keypairRepo.create(keypair, label);
      
      // Fetch balance for the newly created wallet
      try {
        const balance = await balanceService.getBalanceByPublicKey(
          publicKey,
          requestId,
        );
        
        wallets.push({
          publicKey,
          id: dbKeypair.id,
          label: dbKeypair.label,
          isActive: dbKeypair.is_active,
          balance: balance ? {
            solBalance: balance.solBalance,
            wsolBalance: balance.wsolBalance,
            totalBalance: balance.totalBalance,
            lastUpdated: balance.lastUpdated,
            balanceStatus: balance.balanceStatus,
          } : undefined,
        });
      } catch (balanceError) {
        logging.error(
          requestId, 
          `Error fetching initial balance for wallet ${publicKey}`, 
          balanceError
        );
        wallets.push({
          publicKey,
          id: dbKeypair.id,
          label: dbKeypair.label,
          isActive: dbKeypair.is_active,
        });
      }
    }

    logging.info(requestId, `Successfully created ${wallets.length} wallets`);

    ctx.response.status = Status.Created;
    ctx.response.body = {
      success: true,
      wallets,
    };

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error creating wallets", error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to create wallets",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};
