import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import * as botExecuteService from "../../services/bot/execute.ts";
import {
  AppRouterContextWithParams,
  AppStateWithParams,
  getContext,
} from "../../middleware/_context.ts";

export const getBotExecutionStatus: RouterMiddleware<
  string,
  Record<string, string>,
  AppStateWithParams<{ executionId: string }>
> = async (ctx: AppRouterContextWithParams<{ executionId: string }>) => {
  const [contextData, contextError] = getContext(ctx);

  if (contextError) {
    ResponseUtil.serverError(ctx, contextError);
    return;
  }

  const [requestId, _telegramUser] = contextData;
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
