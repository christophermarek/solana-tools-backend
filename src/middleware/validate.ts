import { Next, RouterContext } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { z, ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { ResponseUtil } from "../routes/response.ts";

interface ValidationOptions {
  bodySchema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  paramsSchema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  querySchema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
}

export function validateRequest(options: ValidationOptions) {
  return async <P extends string>(ctx: RouterContext<P>, next: Next) => {
    try {
      if (options.bodySchema) {
        const body = ctx.request.body();
        const value = await body.value;
        const validatedBody = await options.bodySchema.parseAsync(value);
        ctx.state.bodyData = validatedBody;
      }

      if (options.paramsSchema) {
        const validatedParams = await options.paramsSchema.parseAsync(
          ctx.params,
        );
        ctx.state.paramsData = validatedParams;
      }

      if (options.querySchema) {
        const queryParams = Object.fromEntries(ctx.request.url.searchParams);
        const validatedQuery = await options.querySchema.parseAsync(
          queryParams,
        );
        ctx.state.queryData = validatedQuery;
      }

      await next();
    } catch (error: unknown) {
      ResponseUtil.badRequest(
        ctx,
        "Validation failed",
        error instanceof ZodError ? error.errors : [{
          message: error instanceof Error ? error.message : "Unknown error",
        }],
      );
    }
  };
}
