import { RouterMiddleware } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging, { getRequestId } from "../../utils/logging.ts";
import { ResponseUtil } from "../../routes/response.ts";
import { ExecuteBotPayload } from "./_dto.ts";
import { BotType } from "../../services/bot/_types.ts";
import * as botExecuteService from "../../services/bot/execute.ts";

export const executeBot: RouterMiddleware<string> = async (ctx) => {
  const requestId = getRequestId(ctx);
  logging.info(requestId, "Bot execution requested");

  try {
    const body = ctx.state.bodyData as ExecuteBotPayload;
    const { botType, parameters } = body;

    logging.info(requestId, "Executing bot", {
      botType,
      walletId: parameters.walletId,
      mintPublicKey: parameters.mintPublicKey,
      volumeAmountSol: parameters.volumeAmountSol,
      blocksToWaitBeforeSell: parameters.blocksToWaitBeforeSell,
      executionConfig: parameters.executionConfig,
    });

    const [executionId, error] = await botExecuteService.startBotExecution(
      botType as BotType,
      parameters,
      requestId,
    );

    if (error) {
      if (
        error.includes("Maximum concurrent bots") ||
        error.includes("ERROR_VOLUME_BOT_FAILED")
      ) {
        logging.warn(requestId, "Bot execution rejected - pool limit reached");
        ResponseUtil.error(ctx, "Maximum concurrent bots reached", 429);
      } else if (error.includes("Wallet not found")) {
        logging.warn(requestId, "Bot execution rejected - wallet not found", {
          walletId: parameters.walletId,
        });
        ResponseUtil.notFound(ctx, error);
      } else if (error.includes("Wallet is inactive")) {
        logging.warn(requestId, "Bot execution rejected - wallet inactive", {
          walletId: parameters.walletId,
        });
        ResponseUtil.badRequest(ctx, error);
      } else {
        logging.error(requestId, "Bot execution failed", { error });
        ResponseUtil.serverError(ctx, new Error(error));
      }
      return;
    }

    logging.info(requestId, "Bot execution started successfully", {
      executionId: executionId!,
      botType,
      walletId: parameters.walletId,
    });

    ResponseUtil.success(ctx, {
      executionId: executionId!,
      status: "PENDING",
      message: "Bot execution started. Use the execution ID to check status.",
    });

    logging.debug(requestId, "Response body", ctx.response.body);
  } catch (error) {
    logging.error(requestId, "Error executing bot", error);
    ResponseUtil.serverError(ctx, error);
  }
};
