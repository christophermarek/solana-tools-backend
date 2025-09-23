import { Context, Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";

export function createResponseTimeMiddleware(): Middleware {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
  };
}
