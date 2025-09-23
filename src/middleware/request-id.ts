import { Context, Middleware, Next } from "https://deno.land/x/oak@v12.6.2/mod.ts";

interface AppState {
  requestId: string;
}

export function createRequestIdMiddleware(): Middleware<AppState> {
  return async (ctx: Context<AppState>, next: Next) => {
    if (!ctx.state) {
      ctx.state = {} as AppState;
    }

    const uuid = crypto.randomUUID();
    const requestId = uuid.split("-")[0];
    ctx.state.requestId = requestId;

    await next();
  };
}
