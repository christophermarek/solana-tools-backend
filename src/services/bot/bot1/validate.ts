import { BotValidator } from "../_types.ts";
import { VolumeBot1Params } from "./_types.ts";
import * as solanaService from "../../solana/_index.ts";

export const validateParams: BotValidator<VolumeBot1Params> = async (
  params,
) => {
  if (!params.wallet) {
    return [false, "Wallet is required"];
  }
  if (!params.mint) {
    return [false, "Mint is required"];
  }
  if (params.volumeAmountSol <= 0) {
    return [false, "Volume amount must be greater than 0"];
  }
  if (params.blocksToWaitBeforeSell < 0) {
    return [false, "Blocks to wait before sell must be non-negative"];
  }

  try {
    const [balanceResult, balanceError] = await solanaService.getSolBalance({
      publicKey: params.wallet.publicKey,
    });

    if (balanceError) {
      return [false, `Failed to validate wallet: ${balanceError}`];
    }

    const currentBalance = solanaService.lamportsToSol(balanceResult.balance);
    if (currentBalance < params.volumeAmountSol) {
      return [
        false,
        `Insufficient balance: ${currentBalance} SOL < ${params.volumeAmountSol} SOL required`,
      ];
    }

    const [connection, connectionError] = await solanaService.getConnection();
    if (connectionError) {
      return [false, `Failed to validate connection: ${connectionError}`];
    }

    try {
      await connection.getAccountInfo(params.mint.publicKey);
    } catch (_error) {
      return [
        false,
        `Invalid mint address: ${params.mint.publicKey.toString()}`,
      ];
    }

    return [true, null];
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown validation error";
    return [false, `Validation failed: ${errorMessage}`];
  }
};
