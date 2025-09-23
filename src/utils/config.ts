import { Env, loadEnv } from "./env.ts";

let config: Env | null = null;

export async function initializeConfig(): Promise<Env> {
  if (config) return config;

  try {
    config = await loadEnv();
    console.log("Configuration loaded successfully");
    return config;
  } catch (error) {
    console.error("Failed to load configuration:", error);
    throw error;
  }
}
