import { Keypair } from "@solana/web3.js";

export interface VolumeBot1Params {
  wallet: Keypair;
  mint: Keypair;
  volumeAmountSol: number;
  blocksToWaitBeforeSell: number;
}

export interface VolumeBot1CycleParams {
  wallet: Keypair;
  mint: Keypair;
  volumeAmountSol: number;
  blocksToWaitBeforeSell: number;
}

export interface VolumeBot1Metrics {
  volumeSol: number;
  buySuccess: boolean;
  sellSuccess: boolean;
  [key: string]: number | boolean;
}

export interface VolumeBot1CycleResult {
  success: boolean;
  error?: string;
  transactionSignatures?: string[];
  metrics: VolumeBot1Metrics;
  buySuccess: boolean;
  sellSuccess: boolean;
  buyError?: string;
  sellError?: string;
  buyTransactionSignature?: string;
  sellTransactionSignature?: string;
  volumeSol: number;
}

export interface VolumeBot1AggregatedResults {
  totalBuyOperations: number;
  totalSellOperations: number;
  totalVolumeSol: number;
}
