import { PublicKey } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "./_constants.ts";

export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function createPublicKey(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch (_error) {
    throw new Error(`Invalid public key format: ${address}`);
  }
}

export function formatBalance(lamports: number): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(9)} SOL`;
}

export function calculateTotalBalance(
  nativeSol: number,
  wrappedSol: number,
): number {
  return nativeSol + wrappedSol;
}

export function isZeroBalance(balance: number): boolean {
  return balance === 0;
}

export function hasBalance(balance: number): boolean {
  return balance > 0;
}

export function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs}ms`;
  }
  return `${(latencyMs / 1000).toFixed(2)}s`;
}

export function isHealthyLatency(latencyMs: number): boolean {
  return latencyMs < 5000;
}

export function getErrorCount(status: { errorCount: number }): number {
  return status.errorCount;
}

export function isConnectionHealthy(status: { healthy: boolean }): boolean {
  return status.healthy;
}
