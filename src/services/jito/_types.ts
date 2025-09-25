import { JitoJsonRpcClient } from "jito-js-rpc";

export interface JitoService {
  client: JitoJsonRpcClient;
  isInitialized: boolean;
}

export interface BundleResult {
  bundleId: string;
  success: boolean;
  error?: string;
}
