import { z } from "zod";
import { load } from "https://deno.land/std@0.220.1/dotenv/mod.ts";

let config: Env | null = null;

export function getConfig(): Env {
  if (config) return config;
  throw new Error("Config not loaded");
}

export function clearConfig(): void {
  config = null;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["devnet", "testnet", "mainnet"]).default(
    "devnet",
  ),

  RPC_URL: z.string().min(1, "RPC URL is required"),
  RPC_TIMEOUT_MS: z.coerce.number().positive().default(30000),

  HELIUS_RPC_URL: z.string().url(),

  RPC_REQUESTS_PER_SECOND: z.coerce.number().positive().default(5),

  DB_PATH: z.string().min(1, "Database path is required"),

  TEST_WALLET_PRIVATE_KEY: z.string().min(
    1,
    "Test wallet private key is required",
  ),
});

export type Env = z.infer<typeof envSchema>;

export async function loadEnv(envFile?: string): Promise<Env> {
  try {
    if (envFile) {
      await load({ export: true, envPath: envFile });
    } else {
      await load({ export: true });
    }

    const env = envSchema.parse({
      NODE_ENV: Deno.env.get("NODE_ENV"),
      RPC_URL: Deno.env.get("RPC_URL"),
      RPC_TIMEOUT_MS: Deno.env.get("RPC_TIMEOUT_MS"),
      HELIUS_RPC_URL: Deno.env.get("HELIUS_RPC_URL"),
      RPC_REQUESTS_PER_SECOND: Deno.env.get("RPC_REQUESTS_PER_SECOND"),
      DB_PATH: Deno.env.get("DB_PATH"),
      TEST_WALLET_PRIVATE_KEY: Deno.env.get("TEST_WALLET_PRIVATE_KEY"),
    });

    config = env;
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment validation failed:");
      error.issues.forEach((err) => {
        console.error(`- ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      console.error("Failed to load environment variables:", error);
    }
    Deno.exit(1);
  }
}
