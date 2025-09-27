import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import * as botExecuteService from "../../services/bot/execute.ts";

export const getBotExecutionStatus: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  const executionId = parseInt(ctx.params.executionId);

  if (isNaN(executionId)) {
    ResponseUtil.badRequest(ctx, "Invalid execution ID");
    return;
  }

  logging.info(requestId, "Getting bot execution status", { executionId });

  try {
    const [execution, error] = await botExecuteService.getBotExecution(
      executionId,
      requestId,
    );

    if (error) {
      if (error === "Bot execution not found") {
        ResponseUtil.notFound(
          ctx,
          `Bot execution with ID ${executionId} not found`,
        );
      } else {
        ResponseUtil.serverError(ctx, new Error(error));
      }
      return;
    }

    const response = {
      id: execution!.id,
      botType: execution!.bot_type,
      botParams: JSON.parse(execution!.bot_params),
      walletId: execution!.wallet_id,
      status: execution!.status,
      totalCycles: execution!.total_cycles,
      successfulCycles: execution!.successful_cycles,
      failedCycles: execution!.failed_cycles,
      executionTimeMs: execution!.execution_time_ms,
      botSpecificResults: execution!.bot_specific_results
        ? JSON.parse(execution!.bot_specific_results)
        : null,
      errors: execution!.errors ? JSON.parse(execution!.errors) : null,
      createdAt: execution!.created_at,
      startedAt: execution!.started_at,
      completedAt: execution!.completed_at,
      updatedAt: execution!.updated_at,
    };

    logging.info(requestId, "Retrieved bot execution status", {
      executionId,
      status: execution!.status,
    });

    ResponseUtil.success(ctx, response);
  } catch (error) {
    logging.error(requestId, "Error getting bot execution status", error);
    ResponseUtil.serverError(ctx, error);
  }
};

export const listBotExecutions: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
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
      walletId,
      botId,
      requestId,
    );

    if (error) {
      ResponseUtil.serverError(ctx, new Error(error));
      return;
    }

    const response = executions!.map((execution) => ({
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
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
    }));

    logging.info(requestId, "Retrieved bot executions", {
      count: response.length,
      walletId,
    });

    ResponseUtil.success(ctx, { executions: response });
  } catch (error) {
    logging.error(requestId, "Error listing bot executions", error);
    ResponseUtil.serverError(ctx, error);
  }
};
