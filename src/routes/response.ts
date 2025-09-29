import { Context, RouterContext } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import logging from "../utils/logging.ts";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ message: string }>;
}

export class ResponseUtil {
  static success<T>(
    ctx: Context | RouterContext<string>,
    data: T,
    status = 200,
  ) {
    ctx.response.status = status;
    ctx.response.body = {
      success: true,
      data,
    } as ApiResponse<T>;
    logging.debug(ctx.state.requestId, "Response body", ctx.response.body);
  }

  static error(
    ctx: Context | RouterContext<string>,
    message: string,
    status = 400,
    errors?: Array<{ message: string }>,
  ) {
    ctx.response.status = status;
    ctx.response.body = {
      success: false,
      message,
      ...(errors && { errors }),
    } as ApiResponse<never>;
    logging.debug(ctx.state.requestId, "Response body", ctx.response.body);
  }

  static created<T>(
    ctx: Context | RouterContext<string>,
    data: T,
  ) {
    this.success(ctx, data, 201);
  }

  static notFound(
    ctx: Context | RouterContext<string>,
    message = "Resource not found",
  ) {
    this.error(ctx, message, 404);
  }

  static badRequest(
    ctx: Context | RouterContext<string>,
    message: string,
    errors?: Array<{ message: string }>,
  ) {
    this.error(ctx, message, 400, errors);
  }

  static serverError(
    ctx: Context | RouterContext<string>,
    error: unknown,
  ) {
    const message = error instanceof Error
      ? error.message
      : "Internal server error";
    const stack = error instanceof Error ? error.stack : undefined;

    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message,
      ...(Deno.env.get("ENV") === "development" && { stack }),
    } as ApiResponse<never>;
  }
}
