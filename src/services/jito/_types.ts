import { SearcherClient } from "jito-ts/dist/sdk/block-engine/searcher.js";

export interface JitoService {
  client: SearcherClient;
  isInitialized: boolean;
}

export interface BundleResult {
  bundleId: string;
  success: boolean;
  error?: string;
}
