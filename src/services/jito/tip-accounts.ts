import { JitoError, JitoErrors } from "./_errors.ts";
import { TAG } from "./_constants.ts";
import * as logging from "../../utils/logging.ts";
import { getJitoService } from "./_index.ts";

export interface TipAccount {
  account: string;
  mint: string;
}

export interface TipAccountsResult {
  tipAccounts: TipAccount[];
  success: boolean;
  error?: string;
}

export async function getTipAccounts(
  timeoutMs: number = 10000,
): Promise<[TipAccountsResult, null] | [null, JitoErrors]> {
  logging.info(TAG, "Getting tip accounts from Jito", { timeoutMs });

  try {
    const [service, error] = getJitoService();
    if (error) {
      return [null, error];
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`getTipAccounts timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const tipAccountsPromise = service.client.getTipAccounts();
    const result = await Promise.race([tipAccountsPromise, timeoutPromise]);

    logging.info(TAG, "Tip accounts response", {
      result: result,
      resultType: typeof result,
      isArray: Array.isArray(result),
      hasError: result && typeof result === "object" && "error" in result,
    });

    if (result && typeof result === "object" && "error" in result) {
      logging.error(TAG, "Failed to get tip accounts", {
        error: result.error,
      });
      return [
        null,
        {
          type: "JITO_ERROR",
          message: `Failed to get tip accounts: ${result.error}`,
        } as JitoError,
      ];
    }

    const accountsArray =
      result && typeof result === "object" && "result" in result
        ? result.result
        : Array.isArray(result)
        ? result
        : [];

    const tipAccounts = Array.isArray(accountsArray)
      ? accountsArray.map((account: string) => ({
        account: account,
        mint: "So11111111111111111111111111111111111111112",
      }))
      : [];

    logging.info(TAG, "Retrieved tip accounts successfully", {
      count: tipAccounts.length,
    });

    return [
      {
        tipAccounts,
        success: true,
      },
      null,
    ];
  } catch (error) {
    logging.error(TAG, "Failed to get tip accounts", {
      error: error instanceof Error ? error.message : String(error),
      errorType: typeof error,
      errorDetails: JSON.stringify(error, null, 2),
      errorStack: error instanceof Error ? error.stack : undefined,
      timeoutMs,
    });

    console.error("Full error object:", error);
    console.error("Error stringified:", JSON.stringify(error, null, 2));

    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while getting tip accounts";
    return [null, { type: "JITO_ERROR", message: errorMessage } as JitoError];
  }
}
