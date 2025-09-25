import { getConfig } from "../../utils/env.ts";

const TAG = "jito";

const BLOCK_ENGINE_URL_MAINNET = "ny.mainnet.block-engine.jito.wtf";

export function getIsMainnetRpc(): boolean {
  return getConfig().RPC_URL.includes("mainnet");
}

export function getBlockEngineUrl(): string {
  return getIsMainnetRpc()
    ? BLOCK_ENGINE_URL_MAINNET
    : BLOCK_ENGINE_URL_MAINNET;
}

export { TAG };
