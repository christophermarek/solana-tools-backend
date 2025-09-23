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

function colorize(text: string, color: string): string {
  const colors: Record<string, string> = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    yellow: "\x1b[33m",
    brightBlue: "\x1b[94m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    bold: "\x1b[1m",
  };

  return `${colors[color] || ""}${text}${colors.reset}`;
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "green";
    case "POST":
      return "blue";
    case "PUT":
      return "yellow";
    case "DELETE":
      return "red";
    case "PATCH":
      return "magenta";
    default:
      return "cyan";
  }
}

function getStatusColor(status: number): string {
  if (status >= 500) return "brightRed";
  if (status >= 400) return "red";
  if (status >= 300) return "yellow";
  if (status >= 200) return "green";
  return "cyan";
}

function getResponseTimeColor(ms: number): string {
  if (ms >= 1000) return "red";
  if (ms >= 500) return "yellow";
  if (ms >= 100) return "cyan";
  return "green";
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

  const requestIdStr = colorize(`[${requestId}]`, "brightBlue");
  const methodStr = colorize(method.padEnd(7), getMethodColor(method));

  if (phase === "request") {
    return `${requestIdStr} 🔹 ${methodStr} ${url}`;
  } else if (status !== undefined && timeMs !== undefined) {
    const statusStr = colorize(`${status}`, getStatusColor(status));
    const timeStr = colorize(`${timeMs}ms`, getResponseTimeColor(timeMs));
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
              ? colorize(`[${requestId}]`, "brightBlue")
              : `[${requestId}]`;
            console.log(
              `${requestIdStr} 🔹 Headers:`,
              Object.fromEntries(headers.entries()),
            );
          }

          const requestIdStr = useColors
            ? colorize(`[${requestId}]`, "brightBlue")
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
          ? colorize(`[${requestId}]`, "brightBlue")
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
        ? colorize(`[${requestId}]`, "brightBlue")
        : `[${requestId}]`;
      console.error(
        `${requestIdStr} ❌ Error processing ${method} ${url} (${ms}ms)`,
        error,
      );

      throw error;
    }
  };
}
