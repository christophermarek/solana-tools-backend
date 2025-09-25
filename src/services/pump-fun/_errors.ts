export const PUMP_FUN_ERRORS = {
  ERROR_CREATING_KEYPAIR: "Error creating keypair",
  ERROR_INITIALIZING_SDK: "Error initializing SDK",
  ERROR_CREATING_AND_BUYING: "Error creating and buying token",
  ERROR_GETTING_BONDING_CURVE_ACCOUNT: "Error getting bonding curve account",
  ERROR_BUYING_TOKEN: "Error buying token",
  ERROR_SELLING_TOKEN: "Error selling token",
  ERROR_GETTING_SPL_BALANCE: "Error getting SPL token balance",
  ERROR_NO_RESULTS_BUY: "No results from buy operation",
  ERROR_NO_RESULTS_SELL: "No results from sell operation",
  ERROR_NO_RESULTS_CREATE_AND_BUY: "No results from create and buy operation",
  ERROR_NO_CURVE_AFTER_BUY: "Failed to get bonding curve account after buy",
  ERROR_NO_CURVE_AFTER_SELL: "Failed to get bonding curve account after sell",
  ERROR_NO_CURVE_AFTER_CREATE_AND_BUY:
    "Failed to get bonding curve account after create and buy",
  ERROR_UNKNOWN_BUY: "Unknown error occurred during buy",
  ERROR_UNKNOWN_SELL: "Unknown error occurred during sell",
  ERROR_UNKNOWN_CREATE_AND_BUY: "Unknown error occurred during create and buy",
  ERROR_GETTING_BUY_INSTRUCTIONS: "Error getting buy instructions",
  ERROR_GETTING_SELL_INSTRUCTIONS: "Error getting sell instructions",
  ERROR_GETTING_CREATE_INSTRUCTIONS: "Error getting create instructions",
  ERROR_UNKNOWN_GET_BUY_INSTRUCTIONS:
    "Unknown error occurred while getting buy instructions",
  ERROR_UNKNOWN_GET_SELL_INSTRUCTIONS:
    "Unknown error occurred while getting sell instructions",
  ERROR_UNKNOWN_GET_CREATE_INSTRUCTIONS:
    "Unknown error occurred while getting create instructions",
} as const;

export interface SDKError {
  type: "SDK_ERROR";
  message: string;
}

export type PumpFunErrors =
  | typeof PUMP_FUN_ERRORS[keyof typeof PUMP_FUN_ERRORS]
  | SDKError;
