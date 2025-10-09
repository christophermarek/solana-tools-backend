import type { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";
import type { AppContext, AppState } from "./_context.ts";

interface ErrorWithStatus extends Error {
  status?: number;
}

export enum MiddlewareErrorType {
  MISSING_X_TELEGRAM_ID_HEADER = "MISSING_X_TELEGRAM_ID_HEADER",
  USER_NOT_WHITELISTED = "USER_NOT_WHITELISTED",
  FAILED_TO_AUTHENTICATE_TELEGRAM_USER = "FAILED_TO_AUTHENTICATE_TELEGRAM_USER",
  MISSING_AUTHORIZATION_HEADER = "MISSING_AUTHORIZATION_HEADER",
  INVALID_API_KEY = "INVALID_API_KEY",
  USER_NOT_AUTHENTICATED = "USER_NOT_AUTHENTICATED",
  ADMIN_ROLE_REQUIRED = "ADMIN_ROLE_REQUIRED",
  USER_CREDITS_EXPIRED = "USER_CREDITS_EXPIRED",
}

export class MiddlewareError extends Error {
  public readonly type: MiddlewareErrorType;
  public readonly status: number;

  constructor(type: MiddlewareErrorType, status: number = 500) {
    super(getMiddlewareErrorMessage(type));
    this.name = "MiddlewareError";
    this.type = type;
    this.status = status;
  }
}

function getMiddlewareErrorMessage(type: MiddlewareErrorType): string {
  switch (type) {
    case MiddlewareErrorType.MISSING_X_TELEGRAM_ID_HEADER:
      return "Missing X-TELEGRAM-ID header";
    case MiddlewareErrorType.USER_NOT_WHITELISTED:
      return "User not whitelisted";
    case MiddlewareErrorType.FAILED_TO_AUTHENTICATE_TELEGRAM_USER:
      return "Failed to authenticate telegram user";
    case MiddlewareErrorType.MISSING_AUTHORIZATION_HEADER:
      return "Missing Authorization header";
    case MiddlewareErrorType.INVALID_API_KEY:
      return "Invalid API key provided";
    case MiddlewareErrorType.USER_NOT_AUTHENTICATED:
      return "User not authenticated";
    case MiddlewareErrorType.ADMIN_ROLE_REQUIRED:
      return "Admin role required";
    case MiddlewareErrorType.USER_CREDITS_EXPIRED:
      return "User credits have expired";
    default:
      return "Unknown middleware error";
  }
}

export function createErrorHandler(): Middleware<AppState> {
  return async (ctx: AppContext, next: Next) => {
    try {
      await next();
    } catch (err: unknown) {
      const requestId = logging.getRequestId(ctx);
      const status = err instanceof Error
        ? (err as ErrorWithStatus).status || 500
        : 500;
      const message = err instanceof Error
        ? err.message
        : "Internal Server Error";

      ctx.response.status = status;
      ctx.response.body = {
        success: false,
        message,
        ...((Deno.env.get("NODE_ENV") === "devnet" ||
          Deno.env.get("NODE_ENV") === "testnet") &&
          { stack: err instanceof Error ? err.stack : undefined }),
      };

      logging.error(requestId, `[${status}] ${message}`, err);
    }
  };
}
