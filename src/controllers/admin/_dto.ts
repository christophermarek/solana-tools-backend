import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { DbUser } from "../../db/repositories/users.ts";

export const whitelistRequestDto = z.object({
  telegramID: z.string().min(1, "Telegram ID is required"),
  action: z.enum(["add", "delete"], {
    errorMap: () => ({ message: "Action must be either 'add' or 'delete'" }),
  }),
});

export type WhitelistActionPayload = z.infer<typeof whitelistRequestDto>;

export interface WhitelistAddResponse {
  user: DbUser;
}

export interface WhitelistDeleteResponse {}
