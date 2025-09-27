import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import { executeBotSchema } from "../schemas/bot.ts";
import {
  executeBot,
  getBotExecutionStatus,
  listBotExecutions,
  listBots,
} from "../controllers/bot/index.ts";

const router = new Router({
  prefix: "/api/v1/bots",
});

router.get("/", listBots);

router.post(
  "/execute",
  validateRequest({ bodySchema: executeBotSchema }),
  executeBot,
);

router.get("/executions", listBotExecutions);

router.get("/executions/:executionId", getBotExecutionStatus);

export const botRouter = router;
