import { Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { AppContext, AppState } from "./_context.ts";

export function createRequestIdMiddleware(): Middleware<AppState> {
  return async (ctx: AppContext, next: Next) => {
    if (!ctx.state) {
      ctx.state = {} as AppState;
    }

    const uuid = crypto.randomUUID();
    const requestId = uuid.split("-")[0];
    ctx.state.requestId = requestId;

    await next();
  };
}
