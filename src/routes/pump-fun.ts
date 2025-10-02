import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import {
  buyTokenSchema,
  createAndBuySchema,
  getTokenBalanceSchema,
  sellTokenSchema,
  trackMintSchema,
  untrackMintSchema,
} from "../controllers/pump-fun/_dto.ts";

import {
  buyToken,
  createAndBuyToken,
  getTokenBalance,
  listPumpfunMints,
  sellToken,
  trackMint,
  untrackMint,
} from "../controllers/pump-fun/index.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";

const router = new Router({
  prefix: "/api/v1/pump-fun",
});

router.use(createAuthenticateTelegramUserMiddleware());

router.post(
  "/create-and-buy",
  validateRequest({ bodySchema: createAndBuySchema }),
  createAndBuyToken,
);

router.post(
  "/buy",
  validateRequest({ bodySchema: buyTokenSchema }),
  buyToken,
);

router.post(
  "/sell",
  validateRequest({ bodySchema: sellTokenSchema }),
  sellToken,
);

router.post(
  "/balance",
  validateRequest({ bodySchema: getTokenBalanceSchema }),
  getTokenBalance,
);

router.get(
  "/mints",
  listPumpfunMints,
);

router.post(
  "/mints",
  validateRequest({ bodySchema: trackMintSchema }),
  trackMint,
);

router.delete(
  "/mints",
  validateRequest({ bodySchema: untrackMintSchema }),
  untrackMint,
);

export const pumpFunRouter = router;
