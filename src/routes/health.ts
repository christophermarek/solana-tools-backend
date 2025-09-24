import { Router } from "https://deno.land/x/oak@v12.6.2/mod.ts";
import {
  dbHealthCheck,
  healthCheck,
  solanaHealthCheck,
} from "../controllers/health/index.ts";

const router = new Router();

router.get("/health", healthCheck);
router.get("/health/solana", solanaHealthCheck);
router.get("/health/db", dbHealthCheck);

export const healthRouter = router;
