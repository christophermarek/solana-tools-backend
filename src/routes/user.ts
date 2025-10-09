import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";
import { validateRequest } from "../middleware/validate.ts";
import {
  getAccountData,
  getPaymentHistory,
  redeemCredits,
} from "../controllers/user/index.ts";
import { redeemCreditsRequestSchema } from "../controllers/user/_dto.ts";

const router = new Router({
  prefix: "/api/v1/users",
});

router.use(createAuthenticateTelegramUserMiddleware());

router.get("/account", getAccountData);

router.get("/payment-history", getPaymentHistory);

router.post(
  "/redeem",
  validateRequest({ bodySchema: redeemCreditsRequestSchema }),
  redeemCredits,
);

export const userRouter = router;
