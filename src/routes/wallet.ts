import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";
import {
  bulkEditWalletsSchema,
  createWalletsSchema,
  importWalletSchema,
  refreshWalletBalancesSchema,
  walletParamSchema,
} from "../controllers/wallet/_dto.ts";

import {
  bulkEditWallets,
  createWallets,
  getWallet,
  importWallet,
  listWallets,
  refreshWalletBalance,
} from "../controllers/wallet/index.ts";

const router = new Router({
  prefix: "/api/v1/wallets",
});

router.use(createAuthenticateTelegramUserMiddleware());

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

router.post(
  "/balance/refresh",
  validateRequest({ bodySchema: refreshWalletBalancesSchema }),
  refreshWalletBalance,
);

export const walletRouter = router;
