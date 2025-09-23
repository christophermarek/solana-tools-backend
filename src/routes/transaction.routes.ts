import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import { validateRequest } from "../middleware/validate.ts";
import {
  createTransactionSchema,
  submitTransactionSchema,
  transactionHistoryQuerySchema,
  transactionIdParamSchema,
  transactionSignatureParamSchema,
  walletIdParamSchema,
} from "../schemas/transaction.schema.ts";

import {
  createDraftTransaction,
  getTransactionBySignature,
  getTransactionDetails,
  getWalletTransactions,
  listTransactions,
  submitTransaction,
} from "../controllers/transaction/index.ts";

// Create router with prefix
const router = new Router({
  prefix: "/api/v1/transactions",
});

// ===== Transaction Endpoints =====

// Create draft transaction
router.post(
  "/draft",
  validateRequest({ bodySchema: createTransactionSchema }),
  createDraftTransaction,
);

// Submit draft transaction
router.post(
  "/:transactionId/submit",
  validateRequest({
    paramsSchema: transactionIdParamSchema,
    bodySchema: submitTransactionSchema,
  }),
  submitTransaction,
);

// Get transaction details by ID
router.get(
  "/:transactionId",
  validateRequest({ paramsSchema: transactionIdParamSchema }),
  getTransactionDetails,
);

// Get transaction by signature
router.get(
  "/signature/:signature",
  validateRequest({ paramsSchema: transactionSignatureParamSchema }),
  getTransactionBySignature,
);

// List all transactions with filtering
router.get(
  "/",
  validateRequest({ querySchema: transactionHistoryQuerySchema }),
  listTransactions,
);

// Get wallet transaction history
router.get(
  "/wallet/:walletId",
  validateRequest({
    paramsSchema: walletIdParamSchema,
    querySchema: transactionHistoryQuerySchema,
  }),
  getWalletTransactions,
);

export const transactionRouter = router;
