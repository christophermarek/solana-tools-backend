import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";
import { createAuthenticateAdminRoleMiddleware } from "../middleware/authenticate-admin-role.ts";
import { whitelistRequestDto } from "../controllers/admin/_dto.ts";
import { manageWhitelist } from "../controllers/admin/index.ts";

const router = new Router({
  prefix: "/api/v1/admin",
});

router.use(createAuthenticateTelegramUserMiddleware());
router.use(createAuthenticateAdminRoleMiddleware());

router.post(
  "/whitelist",
  validateRequest({ bodySchema: whitelistRequestDto }),
  manageWhitelist,
);

export { router as adminRouter };
