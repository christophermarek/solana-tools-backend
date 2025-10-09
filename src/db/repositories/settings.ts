import { getClient } from "../client.ts";
import * as logging from "../../utils/logging.ts";

function rowToDbSetting(row: Record<string, unknown>): DbSetting {
  return {
    field: row.field as string,
    description: row.description as string,
    value: row.value as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export interface DbSetting {
  field: string;
  description: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export async function getSetting(
  field: string,
  requestId = "system",
): Promise<[DbSetting, null] | [null, string]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM settings WHERE field = ?",
      args: [field],
    });

    if (result.rows.length === 0) {
      return [null, `Setting '${field}' not found`];
    }

    return [rowToDbSetting(result.rows[0]), null];
  } catch (error) {
    const errorMessage = `Failed to get setting '${field}'`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function getSolPerCredit(
  requestId = "system",
): Promise<[number, null] | [null, string]> {
  const result = await getSetting("SOL_PER_CREDIT", requestId);

  if (result[1]) {
    return [null, result[1]];
  }

  if (!result[0]) {
    return [null, "SOL_PER_CREDIT setting not found"];
  }

  const setting = result[0];
  const value = parseFloat(setting.value);

  if (Number.isNaN(value) || value <= 0) {
    return [null, `Invalid SOL_PER_CREDIT value: ${setting.value}`];
  }

  return [value, null];
}

export async function updateSetting(
  field: string,
  value: string,
  requestId = "system",
): Promise<[DbSetting, null] | [null, string]> {
  const client = getClient();
  try {
    await client.execute({
      sql: `
        UPDATE settings 
        SET value = ?, updated_at = CURRENT_TIMESTAMP
        WHERE field = ?
      `,
      args: [value, field],
    });

    const result = await client.execute({
      sql: "SELECT * FROM settings WHERE field = ?",
      args: [field],
    });

    if (result.rows.length === 0) {
      return [null, `Setting '${field}' not found after update`];
    }

    const updatedSetting = rowToDbSetting(result.rows[0]);

    logging.info(requestId, "Updated setting", {
      field,
      value,
    });

    return [updatedSetting, null];
  } catch (error) {
    const errorMessage = `Failed to update setting '${field}'`;
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export async function listAllSettings(
  requestId = "system",
): Promise<[DbSetting[], null] | [null, string]> {
  const client = getClient();
  try {
    const result = await client.execute({
      sql: "SELECT * FROM settings ORDER BY field ASC",
    });

    return [result.rows.map(rowToDbSetting), null];
  } catch (error) {
    const errorMessage = "Failed to list all settings";
    logging.error(requestId, errorMessage, error);
    return [null, errorMessage];
  }
}

export default {
  getSetting,
  getSolPerCredit,
  updateSetting,
  listAllSettings,
};
