import { createWallets } from "./create.ts";
import { listWallets } from "./list.ts";
import { getWallet } from "./get.ts";
import { getBalance } from "./balance.ts";
import { refreshWalletBalance } from "./refresh.ts";
import { bulkEditWallets } from "./edit.ts";
import { importWallet } from "./import.ts";

export {
  bulkEditWallets,
  createWallets,
  getBalance,
  getWallet,
  importWallet,
  listWallets,
  refreshWalletBalance,
};

export {
  createWallets as createKeypairs,
  getBalance as getKeypairBalance,
  getWallet as getKeypair,
  importWallet as importKeypair,
  listWallets as listKeypairs,
  refreshWalletBalance as refreshKeypairBalance,
};
