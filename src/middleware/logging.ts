import {
  Context,
  Middleware,
  Next,
  State,
} from "https://deno.land/x/oak@v12.6.2/mod.ts";
import * as logging from "../utils/logging.ts";

interface AppState extends State {
  requestId: string;
  parsedBody?: unknown;
}

function formatLog(options: {
  requestId: string;
  method: string;
  url: string;
  status?: number;
  timeMs?: number;
  phase: "request" | "response";
  useColors: boolean;
}): string {
  const { requestId, method, url, status, timeMs, phase, useColors } = options;

  if (!useColors) {
    if (phase === "request") {
      return `[${requestId}] ${method} ${url}`;
    } else {
      return `[${requestId}] ${method} ${url} ${status} - ${timeMs}ms`;
    }
  }

  const requestIdStr = logging.colorize(`[${requestId}]`, "brightBlue");
  const methodStr = logging.colorize(
    method.padEnd(7),
    logging.getMethodColor(method),
  );

  if (phase === "request") {
    return `${requestIdStr} 🔹 ${methodStr} ${url}`;
  } else if (status !== undefined && timeMs !== undefined) {
    const statusStr = logging.colorize(
      `${status}`,
      logging.getStatusColor(status),
    );
    const timeStr = logging.colorize(
      `${timeMs}ms`,
      logging.getResponseTimeColor(timeMs),
    );
    return `${requestIdStr} ✅ ${methodStr} ${url} ${statusStr} - ${timeStr}`;
  }

  return `${requestIdStr} ${methodStr} ${url}`;
}

function formatBody(body: unknown, maxLength: number): string {
  if (body === null || body === undefined) return String(body);

  try {
    const str = JSON.stringify(body, (_key, value) => {
      if (typeof value === "bigint") {
        return String(value);
      }
      return value;
    }, 2);

    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "... [truncated]";
  } catch (error) {
    return `[Error serializing object: ${
      error instanceof Error ? error.message : String(error)
    }]`;
  }
}

export interface DetailedLoggerOptions {
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  logHeaders?: boolean;
  maxBodyLength?: number;
  useColors?: boolean;
}

export function getRequestId(ctx: { state: { requestId?: string } }): string {
  return logging.getRequestId(ctx);
}

export function createDetailedLogger(
  options: DetailedLoggerOptions = {},
): Middleware<AppState> {
  const {
    logRequestBody = true,
    logResponseBody = true,
    logHeaders = false,
    maxBodyLength = 1000,
    useColors = true,
  } = options;

  return async (ctx: Context<AppState>, next: Next) => {
    if (!ctx.state.requestId) {
      const uuid = crypto.randomUUID();
      const requestId = uuid.split("-")[0];
      ctx.state.requestId = requestId;
    }

    const start = Date.now();
    const requestId = ctx.state.requestId;

    const method = ctx.request.method;
    const url = ctx.request.url.pathname + ctx.request.url.search;

    console.log(formatLog({
      requestId,
      method,
      url,
      phase: "request",
      useColors,
    }));

    try {
      if (logRequestBody && ["POST", "PUT", "PATCH"].includes(method)) {
        try {
          const bodyResult = await ctx.request.body().value;
          ctx.state.parsedBody = bodyResult;

          const headers = ctx.request.headers;
          if (logHeaders) {
            const requestIdStr = useColors
              ? logging.colorize(`[${requestId}]`, "brightBlue")
              : `[${requestId}]`;
            console.log(
              `${requestIdStr} 🔹 Headers:`,
              Object.fromEntries(headers.entries()),
            );
          }

          const requestIdStr = useColors
            ? logging.colorize(`[${requestId}]`, "brightBlue")
            : `[${requestId}]`;
          console.log(
            `${requestIdStr} 🔹 Request body: ${
              formatBody(bodyResult, maxBodyLength)
            }`,
          );
        } catch (error) {
          logging.warn(requestId, "Could not parse request body", error);
        }
      }

      await next();

      const ms = Date.now() - start;
      const status = ctx.response.status;

      console.log(formatLog({
        requestId,
        method,
        url,
        status,
        timeMs: ms,
        phase: "response",
        useColors,
      }));

      if (logResponseBody && ctx.response.body) {
        const requestIdStr = useColors
          ? logging.colorize(`[${requestId}]`, "brightBlue")
          : `[${requestId}]`;
        console.log(
          `${requestIdStr} ✅ Response body: ${
            formatBody(ctx.response.body, maxBodyLength)
          }`,
        );
      }
    } catch (error) {
      const ms = Date.now() - start;
      const requestIdStr = useColors
        ? logging.colorize(`[${requestId}]`, "brightBlue")
        : `[${requestId}]`;
      console.error(
        `${requestIdStr} ❌ Error processing ${method} ${url} (${ms}ms)`,
        error,
      );

      throw error;
    }
  };
}
