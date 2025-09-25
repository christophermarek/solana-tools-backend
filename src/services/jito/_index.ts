import { searcherClient } from "jito-ts/dist/sdk/block-engine/searcher.js";
import { JitoError, JitoErrors } from "./_errors.ts";
import { JitoService } from "./_types.ts";
import { getBlockEngineUrl, TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";

export * from "./_constants.ts";
export * from "./_errors.ts";
export * from "./_types.ts";
export * from "./send-bundle.ts";

let globalJitoService: JitoService | null = null;

export function getJitoService(): [JitoService, null] | [null, JitoErrors] {
  if (!globalJitoService || !globalJitoService.isInitialized) {
    const [service, error] = initJito();
    if (error) {
      return [null, error];
    }
    globalJitoService = service;
  }
  return [globalJitoService, null];
}

export function clearJitoService(): void {
  globalJitoService = null;
}

export function isJitoServiceInitialized(): boolean {
  return globalJitoService !== null && globalJitoService.isInitialized;
}

function initJito(): [JitoService, null] | [null, JitoErrors] {
  logging.info(TAG, "Initializing global Jito service singleton");

  try {
    const blockEngineUrl = getBlockEngineUrl();

    logging.info(TAG, "Jito configuration", {
      blockEngineUrl,
    });

    const client = searcherClient(blockEngineUrl);

    const service: JitoService = {
      client,
      isInitialized: true,
    };

    logging.info(
      TAG,
      "Global Jito service singleton initialized successfully",
      client,
    );
    return [service, null];
  } catch (error) {
    logging.error(TAG, "Failed to initialize Jito service", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while initializing Jito service";
    return [null, { type: "JITO_ERROR", message: errorMessage } as JitoError];
  }
}
