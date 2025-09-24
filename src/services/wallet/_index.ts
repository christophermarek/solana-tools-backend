import { createWallets } from "./create.ts";
import { listWallets } from "./list.ts";
import { bulkEditWallets } from "./edit.ts";
import { refreshWalletBalances } from "./refresh.ts";

export * from "./_types.ts";
export * from "./_utils.ts";
export * from "./create.ts";
export * from "./list.ts";
export * from "./edit.ts";
export * from "./refresh.ts";

export { createWallets } from "./create.ts";
export { listWallets } from "./list.ts";
export { bulkEditWallets } from "./edit.ts";
export { refreshWalletBalances } from "./refresh.ts";

const walletService = {
  createWallets,
  listWallets,
  bulkEditWallets,
  refreshWalletBalances,
};

export default walletService;
