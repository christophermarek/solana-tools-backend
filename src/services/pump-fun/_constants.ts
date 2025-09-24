import { getConfig } from "../../utils/env.ts";

const TAG = "pump-fun";
const SLIPPAGE_BPS = 1000n; // 10%

const PRIORITY_FEE_DEVNET = { unitLimit: 250_000, unitPrice: 250_000 };
const PRIORITY_FEE_MAINNET = { unitLimit: 250_000, unitPrice: 250_000 };

const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; //SPL Token Program address
const ASSOCIATED_TOKEN_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"; //Associated Token Program address on Solana

export function getIsMainnetRpc(): boolean {
  return getConfig().RPC_URL.includes("mainnet");
}

export function getPriorityFee() {
  return getIsMainnetRpc() ? PRIORITY_FEE_MAINNET : PRIORITY_FEE_DEVNET;
}

export { ASSOCIATED_TOKEN_PROGRAM_ID, SLIPPAGE_BPS, TAG, TOKEN_PROGRAM_ID };
