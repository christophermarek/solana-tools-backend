import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { ListBotExecutionsResponse } from "./_dto.ts";
import * as botExecuteService from "../../services/bot/execute.ts";
import { AppContext, AppState, getContext } from "../../middleware/_context.ts";

export const listBotExecutions: RouterMiddleware<
  string,
  Record<string, string>,
  AppState
> = async (ctx: AppContext) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, telegramUser] = contextData;
  const walletIdParam = ctx.request.url.searchParams.get("walletId");
  const botIdParam = ctx.request.url.searchParams.get("botId");
  const walletId = walletIdParam ? parseInt(walletIdParam) : undefined;
  const botId = botIdParam ? parseInt(botIdParam) : undefined;

  if (walletIdParam && isNaN(walletId!)) {
    ResponseUtil.badRequest(ctx, "Invalid wallet ID");
    return;
  }

  if (botIdParam && isNaN(botId!)) {
    ResponseUtil.badRequest(ctx, "Invalid bot ID");
    return;
  }

  logging.info(requestId, "Listing bot executions", { walletId, botId });

  try {
    const [executions, error] = await botExecuteService.listBotExecutions(
      telegramUser.id,
      walletId,
      botId,
      requestId,
    );

    if (error) {
      ResponseUtil.serverError(ctx, new Error(error));
      return;
    }

    const response: ListBotExecutionsResponse = {
      executions: executions!.map((execution) => ({
        id: execution.id,
        botType: execution.bot_type,
        botParams: JSON.parse(execution.bot_params),
        walletId: execution.wallet_id,
        status: execution.status,
        totalCycles: execution.total_cycles,
        successfulCycles: execution.successful_cycles,
        failedCycles: execution.failed_cycles,
        executionTimeMs: execution.execution_time_ms,
        createdAt: execution.created_at,
        startedAt: execution.started_at ?? null,
        completedAt: execution.completed_at ?? null,
      })),
    };

    logging.info(requestId, "Retrieved bot executions", {
      count: response.executions.length,
      walletId,
    });

    ResponseUtil.success(ctx, response);
  } catch (error) {
    logging.error(requestId, "Error listing bot executions", error);
    ResponseUtil.serverError(ctx, error);
  }
};
