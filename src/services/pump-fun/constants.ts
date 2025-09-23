import { getConfig } from "../../utils/env.ts";

const TAG = "pump-fun";
const SLIPPAGE_BPS = 100n;

const PRIORITY_FEE_DEVNET = { unitLimit: 250_000, unitPrice: 250_000 };
const PRIORITY_FEE_MAINNET = { unitLimit: 250_000, unitPrice: 250_000 };

export function getIsMainnetRpc(): boolean {
  return getConfig().RPC_URL.includes("mainnet");
}

export function getPriorityFee() {
  return getIsMainnetRpc() ? PRIORITY_FEE_MAINNET : PRIORITY_FEE_DEVNET;
}

export { SLIPPAGE_BPS, TAG };
