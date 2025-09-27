import { Context, RouterContext } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { DbUser } from "../db/repositories/users.ts";

export interface AppState {
  requestId: string;
  telegramUser?: DbUser;
}

export enum ContextErrorType {
  MISSING_REQUEST_ID = "MISSING_REQUEST_ID",
  MISSING_TELEGRAM_USER = "MISSING_TELEGRAM_USER",
  INVALID_STATE = "INVALID_STATE",
}

export class ContextError extends Error {
  public readonly type: ContextErrorType;

  constructor(type: ContextErrorType) {
    super(getMessage(type));
    this.name = "ContextError";
    this.type = type;
  }
}

function getMessage(type: ContextErrorType): string {
  switch (type) {
    case ContextErrorType.MISSING_REQUEST_ID:
      return "Missing request ID";
    case ContextErrorType.MISSING_TELEGRAM_USER:
      return "Missing telegram user";
    case ContextErrorType.INVALID_STATE:
      return "Invalid state";
    default:
      return "Unknown context error";
  }
}

export type AppContext = Context<AppState>;
export type AppRouterContext = RouterContext<
  string,
  Record<string, string>,
  AppState
>;

export function getContext(
  ctx: AppContext | AppRouterContext,
): [[string, DbUser], null] | [null, ContextError] {
  if (!ctx.state) {
    return [null, new ContextError(ContextErrorType.INVALID_STATE)];
  }

  if (!ctx.state.requestId) {
    return [null, new ContextError(ContextErrorType.MISSING_REQUEST_ID)];
  }

  if (!ctx.state.telegramUser) {
    return [null, new ContextError(ContextErrorType.MISSING_TELEGRAM_USER)];
  }

  return [[ctx.state.requestId, ctx.state.telegramUser], null];
}
