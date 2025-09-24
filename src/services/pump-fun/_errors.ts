export const PUMP_FUN_ERRORS = {
  ERROR_CREATING_KEYPAIR: "Error creating keypair",
  ERROR_INITIALIZING_SDK: "Error initializing SDK",
  ERROR_CREATING_AND_BUYING: "Error creating and buying token",
  ERROR_GETTING_BONDING_CURVE_ACCOUNT: "Error getting bonding curve account",
  ERROR_BUYING_TOKEN: "Error buying token",
  ERROR_SELLING_TOKEN: "Error selling token",
  ERROR_GETTING_SPL_BALANCE: "Error getting SPL token balance",
} as const;

export type PumpFunErrors =
  typeof PUMP_FUN_ERRORS[keyof typeof PUMP_FUN_ERRORS];
