import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";
import { createAuthenticateAdminRoleMiddleware } from "../middleware/authenticate-admin-role.ts";
import { whitelistRequestDto } from "../controllers/whitelist/_dto.ts";
import { manageWhitelist } from "../controllers/whitelist/index.ts";

const router = new Router({
  prefix: "/api/v1/whitelist",
});

router.use(createAuthenticateTelegramUserMiddleware());
router.use(createAuthenticateAdminRoleMiddleware());

router.post(
  "/",
  validateRequest({ bodySchema: whitelistRequestDto }),
  manageWhitelist,
);

export { router as adminRouter };
