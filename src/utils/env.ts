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
  NODE_ENV: z.enum(["development", "test", "production"]).default(
    "development",
  ),

  RPC_URL: z.string().min(1, "RPC URL is required"),
  RPC_URLS: z.string().transform((val) => val.split(",")),
  RPC_TIMEOUT_MS: z.coerce.number().positive().default(30000),
  RPC_HEALTH_CHECK_INTERVAL_MS: z.coerce.number().positive().default(60000),

  HELIUS_MAINNET_RPC: z.string().url().default(
    "https://mainnet.helius-rpc.com/?api-key=8dce6436-7274-466f-b329-cd436cbbad42",
  ),
  HELIUS_DEVNET_RPC: z.string().url().default(
    "https://devnet.helius-rpc.com/?api-key=8dce6436-7274-466f-b329-cd436cbbad42",
  ),

  RPC_REQUESTS_PER_SECOND: z.coerce.number().positive().default(5),

  DB_PATH: z.string().min(1, "Database path is required"),

  PUMP_FUN_WALLET_PRIVATE_KEY: z.string().min(
    1,
    "Pump Fun wallet private key is required",
  ),
});

export type Env = z.infer<typeof envSchema>;

export async function loadEnv(): Promise<Env> {
  try {
    await load({ export: true });

    const env = envSchema.parse({
      NODE_ENV: Deno.env.get("NODE_ENV"),
      RPC_URL: Deno.env.get("RPC_URL"),
      RPC_URLS: Deno.env.get("RPC_URLS"),
      RPC_TIMEOUT_MS: Deno.env.get("RPC_TIMEOUT_MS"),
      RPC_HEALTH_CHECK_INTERVAL_MS: Deno.env.get(
        "RPC_HEALTH_CHECK_INTERVAL_MS",
      ),
      HELIUS_MAINNET_RPC: Deno.env.get("HELIUS_MAINNET_RPC"),
      HELIUS_DEVNET_RPC: Deno.env.get("HELIUS_DEVNET_RPC"),
      RPC_REQUESTS_PER_SECOND: Deno.env.get("RPC_REQUESTS_PER_SECOND"),
      DB_PATH: Deno.env.get("DB_PATH"),
      PUMP_FUN_WALLET_PRIVATE_KEY: Deno.env.get("PUMP_FUN_WALLET_PRIVATE_KEY"),
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
