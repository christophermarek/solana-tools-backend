export const JITO_ERRORS = {
  ERROR_INITIALIZING_CLIENT: "Error initializing Jito client",
  ERROR_CREATING_SEARCHER_CLIENT: "Error creating searcher client",
  ERROR_SENDING_BUNDLE: "Error sending bundle",
  ERROR_GETTING_BUNDLE_STATUS: "Error getting bundle status",
  ERROR_UNKNOWN: "Unknown error occurred in Jito service",
} as const;

export interface JitoError {
  type: "JITO_ERROR";
  message: string;
}

export type JitoErrors =
  | typeof JITO_ERRORS[keyof typeof JITO_ERRORS]
  | JitoError;
