import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";
import {
  bulkEditWalletsRequestDto,
  createWalletsRequestDto,
  importWalletRequestDto,
  refreshWalletBalancesRequestDto,
  walletParamRequestDto,
} from "../controllers/wallet/_dto.ts";

import {
  bulkEditWallets,
  createWallets,
  getWallet,
  importWallet,
  listWallets,
  refreshWalletBalance,
} from "../controllers/wallet/index.ts";
import { createAuthenticateUserCreditsMiddleware } from "../middleware/authenticate-user-credits.ts";

const router = new Router({
  prefix: "/api/v1/wallets",
});

router.use(createAuthenticateTelegramUserMiddleware());
router.use(createAuthenticateUserCreditsMiddleware());

router.get("/", listWallets);

router.post(
  "/",
  validateRequest({ bodySchema: createWalletsRequestDto }),
  createWallets,
);

router.post(
  "/import",
  validateRequest({ bodySchema: importWalletRequestDto }),
  importWallet,
);

router.patch(
  "/",
  validateRequest({ bodySchema: bulkEditWalletsRequestDto }),
  bulkEditWallets,
);

router.get(
  "/:publicKey",
  validateRequest({ paramsSchema: walletParamRequestDto }),
  getWallet,
);

router.post(
  "/balance/refresh",
  validateRequest({ bodySchema: refreshWalletBalancesRequestDto }),
  refreshWalletBalance,
);

export const walletRouter = router;
