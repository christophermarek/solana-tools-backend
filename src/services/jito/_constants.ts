import { getConfig } from "../../utils/env.ts";

const TAG = "jito";

const BLOCK_ENGINE_URL_MAINNET =
  "https://ny.mainnet.block-engine.jito.wtf/api/v1";
const BLOCK_ENGINE_URL_TESTNET =
  "https://ny.testnet.block-engine.jito.wtf/api/v1";

export const TIP_AMOUNTS = {
  MINIMUM: 100000, // 0.0001 SOL (100x increase from previous)
  STANDARD: 500000, // 0.0005 SOL (50x increase from previous)
  HIGH_PRIORITY: 1000000, // 0.001 SOL (20x increase from previous)
  MAXIMUM: 5000000, // 0.005 SOL (50x increase from previous)
  TESTNET: 100000, // 0.0001 SOL (100x increase from previous)
} as const;

export function getRecommendedTipAmount(
  priority: "low" | "standard" | "high" | "critical" = "standard",
): number {
  const isTestnet = getIsTestnetRpc();

  if (isTestnet) {
    return TIP_AMOUNTS.TESTNET;
  }

  switch (priority) {
    case "low":
      return TIP_AMOUNTS.MINIMUM;
    case "standard":
      return TIP_AMOUNTS.STANDARD;
    case "high":
      return TIP_AMOUNTS.HIGH_PRIORITY;
    case "critical":
      return TIP_AMOUNTS.MAXIMUM;
    default:
      return TIP_AMOUNTS.STANDARD;
  }
}

export function getIsMainnetRpc(): boolean {
  return getConfig().RPC_URL.includes("mainnet");
}

export function getIsTestnetRpc(): boolean {
  return getConfig().RPC_URL.includes("testnet");
}

export function getBlockEngineUrl(): string {
  if (getIsMainnetRpc()) {
    return BLOCK_ENGINE_URL_MAINNET;
  } else if (getIsTestnetRpc()) {
    return BLOCK_ENGINE_URL_TESTNET;
  } else {
    return BLOCK_ENGINE_URL_TESTNET;
  }
}

export { TAG };
