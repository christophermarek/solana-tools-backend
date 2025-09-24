import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import {
  createAndBuySchema,
  buyTokenSchema,
  sellTokenSchema,
  getTokenBalanceSchema,
} from "../schemas/pump-fun.ts";

import {
  createAndBuyToken,
  buyToken,
  sellToken,
  getTokenBalance,
} from "../controllers/pump-fun/index.ts";

const router = new Router({
  prefix: "/api/v1/pump-fun",
});

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

export const pumpFunRouter = router;
