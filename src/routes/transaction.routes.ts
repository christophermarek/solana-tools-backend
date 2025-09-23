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

const router = new Router({
  prefix: "/api/v1/transactions",
});

router.post(
  "/draft",
  validateRequest({ bodySchema: createTransactionSchema }),
  createDraftTransaction,
);

router.post(
  "/:transactionId/submit",
  validateRequest({
    paramsSchema: transactionIdParamSchema,
    bodySchema: submitTransactionSchema,
  }),
  submitTransaction,
);

router.get(
  "/:transactionId",
  validateRequest({ paramsSchema: transactionIdParamSchema }),
  getTransactionDetails,
);

router.get(
  "/signature/:signature",
  validateRequest({ paramsSchema: transactionSignatureParamSchema }),
  getTransactionBySignature,
);

router.get(
  "/",
  validateRequest({ querySchema: transactionHistoryQuerySchema }),
  listTransactions,
);

router.get(
  "/wallet/:walletId",
  validateRequest({
    paramsSchema: walletIdParamSchema,
    querySchema: transactionHistoryQuerySchema,
  }),
  getWalletTransactions,
);

export const transactionRouter = router;
