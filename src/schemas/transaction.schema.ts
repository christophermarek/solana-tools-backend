import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Schema for transaction ID parameter
 */
export const transactionIdParamSchema = z.object({
  transactionId: z.coerce.number().int().positive(),
});

export type TransactionIdParamPayload = z.infer<
  typeof transactionIdParamSchema
>;

/**
 * Schema for wallet ID parameter
 */
export const walletIdParamSchema = z.object({
  walletId: z.coerce.number().int().positive(),
});

export type WalletIdParamPayload = z.infer<typeof walletIdParamSchema>;

/**
 * Schema for transaction signature parameter
 */
export const transactionSignatureParamSchema = z.object({
  signature: z.string().min(32).max(88),
});

export type TransactionSignatureParamPayload = z.infer<
  typeof transactionSignatureParamSchema
>;

/**
 * Schema for creating a draft transaction
 */
export const createTransactionSchema = z.object({
  fromWalletId: z.number().int().positive(),
  destination: z.object({
    type: z.enum(["INTERNAL", "EXTERNAL"]),
    walletId: z.number().int().positive().optional(),
    address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/).optional(),
  }).refine(
    (data) =>
      (data.type === "INTERNAL" && data.walletId !== undefined) ||
      (data.type === "EXTERNAL" && data.address !== undefined),
    { message: "Must provide walletId for INTERNAL or address for EXTERNAL" },
  ),
  amount: z.number().positive(),
  tokenType: z.enum(["SOL", "WSOL"]).default("SOL"),
});

export type CreateTransactionPayload = z.infer<typeof createTransactionSchema>;

/**
 * Schema for submitting a transaction
 */
export const submitTransactionSchema = z.object({
  priorityFee: z.number().min(0).optional(),
});

export type SubmitTransactionPayload = z.infer<typeof submitTransactionSchema>;

/**
 * Schema for transaction history query parameters
 */
export const transactionHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["DRAFT", "PENDING", "CONFIRMED", "FAILED", "CANCELLED"])
    .optional(),
  tokenType: z.enum(["SOL", "WSOL"]).optional(),
});

export type TransactionHistoryQueryPayload = z.infer<
  typeof transactionHistoryQuerySchema
>;
