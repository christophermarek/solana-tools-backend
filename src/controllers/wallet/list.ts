import { Status } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as keypairRepo from "../../db/repositories/keypairs.ts";
import logging, { getRequestId } from "../../utils/logging.ts";

export const listWallets: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);

  const url = new URL(ctx.request.url);
  const activeOnly = url.searchParams.get("activeOnly") === "true";

  logging.info(
    requestId,
    `Listing wallets${activeOnly ? " (active only)" : " (including inactive)"} with cached balances`,
  );

  try {
    const keypairs = activeOnly
      ? await keypairRepo.listActive()
      : await keypairRepo.listAll();

    logging.info(
      requestId,
      `Found ${keypairs.length} wallets${
        activeOnly ? " (active only)" : " (including inactive)"
      }`,
    );

    // Map keypairs to wallet response objects
    const wallets = keypairs.map((kp) => ({
      id: kp.id,
      publicKey: kp.public_key,
      label: kp.label,
      created: kp.created_at,
      isActive: kp.is_active,
      solBalance: kp.sol_balance !== null && kp.sol_balance !== undefined ? Number(kp.sol_balance) / 1000000000 : null,
      wsolBalance: kp.wsol_balance !== null && kp.wsol_balance !== undefined ? Number(kp.wsol_balance) / 1000000000 : null,
      totalBalance: calculateTotalBalance(kp.sol_balance, kp.wsol_balance),
      lastBalanceUpdate: kp.last_balance_update,
      balanceStatus: kp.balance_status
    }));

    const walletsWithNullBalance = wallets.filter((w) =>
      w.solBalance === null && w.wsolBalance === null
    );

    logging.debug(
      requestId,
      `Prepared ${wallets.length} wallet objects for response`,
    );

    ctx.response.status = Status.OK;
    ctx.response.body = {
      success: true,
      wallets,
      meta: {
        refreshed: false,
        activeOnly,
        totalWallets: wallets.length,
        activeWallets: wallets.filter((w) => w.isActive).length,
        inactiveWallets: wallets.filter((w) => !w.isActive).length,
        walletsWithNullBalance: walletsWithNullBalance.length,
      },
    };

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error listing wallets", error);

    ctx.response.status = Status.InternalServerError;
    ctx.response.body = {
      success: false,
      message: "Failed to list wallets",
      error: error instanceof Error ? error.message : String(error),
    };

    logging.debug(requestId, "Error response body", ctx.response.body);
  }
};

function calculateTotalBalance(
  solBalance: bigint | number | null | undefined,
  wsolBalance: bigint | number | null | undefined,
): number | null {
  if (solBalance === null && wsolBalance === null) return null;
  if (solBalance === undefined && wsolBalance === undefined) return null;

  const solValue = solBalance !== null && solBalance !== undefined ? Number(solBalance) / 1000000000 : 0;
  const wsolValue = wsolBalance !== null && wsolBalance !== undefined ? Number(wsolBalance) / 1000000000 : 0;

  return solValue + wsolValue;
}
