import { Keypair } from "@solana/web3.js";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import * as logging from "../../utils/logging.ts";
import { WALLET_ERRORS, WalletErrors } from "./_errors.ts";
import { MAX_WALLETS_PER_CREATE_REQUEST, TAG } from "./_constants.ts";
import {
  CreateWalletParams,
  CreateWalletResult,
  WalletWithBalance,
} from "./_types.ts";
import type { DbKeypair } from "../../db/repositories/keypairs.ts";

export async function createWallets(
  params: CreateWalletParams,
  requestId?: string | undefined,
): Promise<CreateWalletResult> {
  const { count = 1, label } = params;

  logging.info(
    requestId ?? TAG,
    `Creating ${count} wallets${label ? ` with label: ${label}` : ""}`,
  );

  const maxWallets = MAX_WALLETS_PER_CREATE_REQUEST;
  if (count > maxWallets) {
    logging.error(
      requestId ?? TAG,
      `Requested ${count} wallets exceeds maximum of ${maxWallets}`,
      new Error(
        `Requested ${count} wallets exceeds maximum of ${maxWallets}`,
      ),
    );
    return {
      wallets: [],
      errors: [{ index: 0, error: WALLET_ERRORS.ERROR_CREATING_WALLET }],
    };
  }

  const wallets: WalletWithBalance[] = [];
  const errors: Array<{ index: number; error: WalletErrors }> = [];

  for (let i = 0; i < count; i++) {
    try {
      const keypair: Keypair = Keypair.generate();
      const publicKey: string = keypair.publicKey.toString();

      logging.debug(
        requestId ?? TAG,
        `Generated wallet ${i + 1}/${count}: ${publicKey}`,
      );

      const dbKeypair: DbKeypair = await keypairRepo.create(
        keypair,
        label,
        requestId ?? TAG,
      );

      const newWallet: WalletWithBalance = {
        id: dbKeypair.id,
        publicKey: dbKeypair.public_key,
        label: dbKeypair.label,
        isActive: Boolean(dbKeypair.is_active),
        createdAt: new Date(dbKeypair.created_at),
        solBalance: 0,
        wsolBalance: 0,
        totalBalance: 0,
        lastBalanceUpdate: new Date(),
        balanceStatus: "UNKNOWN",
      };
      wallets.push(newWallet);
    } catch (error) {
      logging.error(
        requestId ?? TAG,
        `Failed to create wallet ${i + 1}/${count}`,
        error,
      );
      errors.push({ index: i, error: WALLET_ERRORS.ERROR_CREATING_WALLET });
    }
  }

  logging.info(
    requestId ?? TAG,
    `Created ${wallets.length}/${count} wallets successfully`,
  );

  return { wallets, errors };
}

export default {
  createWallets,
};
