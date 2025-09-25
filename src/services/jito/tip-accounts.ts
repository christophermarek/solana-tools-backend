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

export async function getTipAccounts(): Promise<
  [TipAccountsResult, null] | [null, JitoErrors]
> {
  logging.info(TAG, "Getting tip accounts from Jito");

  try {
    const [service, error] = getJitoService();
    if (error) {
      return [null, error];
    }

    const result = await service.client.getTipAccounts();

    if (!result.ok) {
      logging.error(TAG, "Failed to get tip accounts", {
        error: result.error,
        errorCode: result.error.code,
        errorDetails: result.error.details,
      });
      return [
        null,
        {
          type: "JITO_ERROR",
          message:
            `Failed to get tip accounts: ${result.error.details} (code: ${result.error.code})`,
        } as JitoError,
      ];
    }

    const tipAccounts = result.value.map((account: any) => ({
      account: account.account,
      mint: account.mint,
    }));

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
    logging.error(TAG, "Failed to get tip accounts", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred while getting tip accounts";
    return [null, { type: "JITO_ERROR", message: errorMessage } as JitoError];
  }
}
