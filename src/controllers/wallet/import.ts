import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as balanceService from "../../services/balance.service.ts";
import { ImportWalletPayload } from "../../schemas/wallet.schema.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

interface WalletResponse {
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
}

export const importWallet: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Importing existing wallet");

  const body = await ctx.request.body({ type: "json" })
    .value as ImportWalletPayload;
  const { secretKey, label } = body;

  try {
    logging.info(
      requestId,
      `Importing wallet${label ? ` with label: ${label}` : ""}`,
    );

    // Import the wallet
    const dbKeypair = await keypairRepo.importWallet(secretKey, label);

    let wallet: WalletResponse = {
      publicKey: dbKeypair.public_key,
      id: dbKeypair.id,
      label: dbKeypair.label,
      isActive: dbKeypair.is_active,
    };

    try {
      logging.info(requestId, `Fetching balance for imported wallet: ${dbKeypair.public_key}`);
      const balance = await balanceService.getBalanceByPublicKey(
        dbKeypair.public_key,
        requestId,
      );
      
      if (balance) {
        wallet = {
          ...wallet,
          balance: {
            solBalance: balance.solBalance,
            wsolBalance: balance.wsolBalance,
            totalBalance: balance.totalBalance,
            lastUpdated: balance.lastUpdated,
            balanceStatus: balance.balanceStatus,
          },
        };
      }
    } catch (balanceError) {
      logging.error(
        requestId, 
        `Error fetching initial balance for imported wallet ${dbKeypair.public_key}`, 
        balanceError
      );
    }

    logging.info(
      requestId,
      `Successfully imported wallet with public key: ${wallet.publicKey}`,
    );

    ctx.response.status = Status.Created;
    ctx.response.body = {
      success: true,
      wallet,
    };

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error importing wallet", error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to import wallet",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};
