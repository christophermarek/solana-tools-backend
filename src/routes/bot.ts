import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { executeBotSchema } from "../controllers/bot/_dto.ts";
import {
  executeBot,
  getBotExecutionStatus,
  listBotExecutions,
  listBots,
} from "../controllers/bot/index.ts";
import { createAuthenticateTelegramUserMiddleware } from "../middleware/authenticate-telegram-user.ts";

const router = new Router({
  prefix: "/api/v1/bots",
});

router.use(createAuthenticateTelegramUserMiddleware());

router.get("/", listBots);

router.post(
  "/execute",
  validateRequest({ bodySchema: executeBotSchema }),
  executeBot,
);

router.get("/executions", listBotExecutions);

router.get("/executions/:executionId", getBotExecutionStatus);

export const botRouter = router;
