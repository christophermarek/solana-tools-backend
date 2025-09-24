import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import {
  bulkEditWalletsSchema,
  createWalletsSchema,
  importWalletSchema,
  refreshWalletBalancesSchema,
  walletParamSchema,
} from "../schemas/wallet.ts";

import {
  bulkEditWallets,
  createWallets,
  getBalance,
  getWallet,
  importWallet,
  listWallets,
  refreshWalletBalance,
} from "../controllers/wallet/index.ts";

const router = new Router({
  prefix: "/api/v1/wallets",
});

router.get("/", listWallets);

router.post(
  "/",
  validateRequest({ bodySchema: createWalletsSchema }),
  createWallets,
);

router.post(
  "/import",
  validateRequest({ bodySchema: importWalletSchema }),
  importWallet,
);

router.patch(
  "/",
  validateRequest({ bodySchema: bulkEditWalletsSchema }),
  bulkEditWallets,
);

router.get(
  "/:publicKey",
  validateRequest({ paramsSchema: walletParamSchema }),
  getWallet,
);

router.get(
  "/:publicKey/balance",
  validateRequest({ paramsSchema: walletParamSchema }),
  getBalance,
);

router.post(
  "/balance/refresh",
  validateRequest({ bodySchema: refreshWalletBalancesSchema }),
  refreshWalletBalance,
);

export const walletRouter = router;
