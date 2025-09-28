import { AppContext } from "../middleware/_context.ts";
export function colorize(text: string, color: string): string {
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

export function getMethodColor(method: string): string {
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

export function getStatusColor(status: number): string {
  if (status >= 500) return "brightRed";
  if (status >= 400) return "red";
  if (status >= 300) return "yellow";
  if (status >= 200) return "green";
  return "cyan";
}

export function getResponseTimeColor(ms: number): string {
  if (ms >= 1000) return "red";
  if (ms >= 500) return "yellow";
  if (ms >= 100) return "cyan";
  return "green";
}

export function truncateObject(obj: unknown, maxLength = 500): string {
  if (obj === null || obj === undefined) return String(obj);

  try {
    const str = JSON.stringify(obj, (_key, value) => {
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

export function formatRequestId(requestId: string, useColors = true): string {
  return useColors
    ? colorize(`[${requestId}]`, "brightBlue")
    : `[${requestId}]`;
}

export function getRequestId(ctx: AppContext): string {
  return ctx.state.requestId || "unknown";
}

export function debug(
  requestId: string,
  message: string,
  data?: unknown,
): void {
  const requestIdFormatted = formatRequestId(requestId);
  console.log(
    `${requestIdFormatted} 🔍 DEBUG: ${message}`,
    data ? truncateObject(data) : "",
  );
}

export function info(requestId: string, message: string, data?: unknown): void {
  const requestIdFormatted = formatRequestId(requestId);
  console.log(
    `${requestIdFormatted} ℹ️ INFO: ${message}`,
    data ? truncateObject(data) : "",
  );
}

export function warn(requestId: string, message: string, data?: unknown): void {
  const requestIdFormatted = formatRequestId(requestId);
  console.log(
    `${requestIdFormatted} ⚠️ WARN: ${message}`,
    data ? truncateObject(data) : "",
  );
}

export function error(requestId: string, message: string, err: unknown): void {
  const requestIdFormatted = formatRequestId(requestId);
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorStack = err instanceof Error ? err.stack : undefined;

  console.error(`${requestIdFormatted} ❌ ERROR: ${message} - ${errorMessage}`);
  if (errorStack) {
    console.error(`${requestIdFormatted} ❌ STACK: ${errorStack}`);
  }
}

export function logRequest(
  requestId: string,
  method: string,
  url: string,
  body?: unknown,
): void {
  const requestIdFormatted = formatRequestId(requestId);
  const methodFormatted = colorize(method.padEnd(7), getMethodColor(method));
  console.log(`${requestIdFormatted} 🔹 ${methodFormatted} ${url}`);

  if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    console.log(
      `${requestIdFormatted} 🔹 Request body: ${truncateObject(body)}`,
    );
  }
}

export function logResponse(
  requestId: string,
  method: string,
  url: string,
  status: number,
  timeMs: number,
  body?: unknown,
): void {
  const requestIdFormatted = formatRequestId(requestId);
  const methodFormatted = colorize(method.padEnd(7), getMethodColor(method));
  const statusFormatted = colorize(`${status}`, getStatusColor(status));
  const timeFormatted = colorize(`${timeMs}ms`, getResponseTimeColor(timeMs));

  console.log(
    `${requestIdFormatted} ✅ ${methodFormatted} ${url} ${statusFormatted} - ${timeFormatted}`,
  );

  if (body) {
    console.log(
      `${requestIdFormatted} ✅ Response body: ${truncateObject(body)}`,
    );
  }
}

export function formatErrorResponse(message: string, err: unknown) {
  return {
    success: false,
    message,
    error: err instanceof Error ? err.message : String(err),
  };
}

export function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }, 2);
}

export default {
  debug,
  info,
  warn,
  error,
  getRequestId,
  formatRequestId,
  logRequest,
  logResponse,
  formatErrorResponse,
  safeStringify,
};
