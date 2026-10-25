export type ColumnDataType =
  | "text"
  | "number"
  | "currency"
  | "image_url"
  | "date"
  | "boolean";

export interface ColumnSchema {
  name: string;
  type: ColumnDataType;
  sampleValue: string;
}

export interface SpreadsheetData {
  title: string;
  sourceType: "google_sheets" | "csv_raw" | "preset";
  sourceUrl?: string;
  columns: ColumnSchema[];
  rows: Record<string, string | number | boolean | null>[];
  totalRows: number;
  lastSyncedAt: Date;
}

export interface FieldMapping {
  columnName: string;
  canvasTag: string; // e.g. {{Price}}
  prefix?: string;
  suffix?: string;
}

export interface SyncStatus {
  state: "idle" | "fetching" | "syncing" | "success" | "error";
  message?: string;
  updatedCount?: number;
  timestamp?: Date;
}
