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

export interface TransactionListOptions extends PaginationOptions {
  status?: string;
  tokenType?: string;
}
