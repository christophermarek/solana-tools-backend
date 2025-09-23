import { Database } from "@db/sqlite";

export type DatabaseClient = Database;

export interface DatabaseResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DatabaseQueryResult<T = unknown> {
  [key: string]: T;
}

export type BindValue = string | number | null | boolean;

export interface DatabaseOperationOptions {
  requestId?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SearchOptions {
  searchTerm: string;
  includeInactive?: boolean;
}

export interface WalletStats {
  total_wallets: number;
  active_wallets: number;
  inactive_wallets: number;
  total_sol_balance: string;
  total_wsol_balance: string;
}

export interface TransactionListOptions extends PaginationOptions {
  status?: string;
  tokenType?: string;
}
