import Papa from "papaparse";
import type { ColumnDataType, ColumnSchema, SpreadsheetData } from "../types/sheetsync";

/**
 * Extracts candidate URLs for fetching the Google Sheet as CSV.
 * Avoids forcing gid=0 which causes Google to return HTTP 400 when gid 0 doesn't exist.
 */
export function getGoogleSheetsCandidateUrls(rawUrl: string): string[] {
  const trimmed = rawUrl.trim().replace(/^["']|["']$/g, "");

  // 1. Check for "Publish to the web" links (/spreadsheets/d/e/2PACX-.../pub...)
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pubMatch && pubMatch[1]) {
    return [
      `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv`,
      trimmed,
    ];
  }

  // 2. Standard sharing link (/spreadsheets/d/{SHEET_ID}/...)
  let sheetId: string | null = null;
  const sheetIdMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1] && sheetIdMatch[1] !== "e") {
    sheetId = sheetIdMatch[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    // If the user pasted the bare Sheet ID
    sheetId = trimmed;
  }

  if (!sheetId) {
    return [];
  }

  // Extract explicit gid if specified in the user's URL (e.g. #gid=18291823)
  const gidMatch = trimmed.match(/[#?&]gid=([0-9]+)/);
  const gid = gidMatch && gidMatch[1] ? gidMatch[1] : null;

  const candidates: string[] = [];

  // If user provided a specific gid in their URL, try that specific gid first
  if (gid !== null) {
    candidates.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
    candidates.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`);
  }

  // Next, try without any gid. Google defaults to the first active sheet!
  // This prevents the dreaded HTTP 400 error caused by requesting non-existent gid=0.
  candidates.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);
  candidates.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);

  return candidates;
}

/**
 * Backward compatibility helper.
 */
export function convertGoogleSheetsUrlToCsvExport(rawUrl: string): string | null {
  const candidates = getGoogleSheetsCandidateUrls(rawUrl);
  return candidates.length > 0 && candidates[0] ? candidates[0] : null;
}

/**
 * Detects the data type of a column based on its sample values.
 */
function inferColumnType(values: unknown[]): ColumnDataType {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (nonNullValues.length === 0) return "text";

  const sample = String(nonNullValues[0]).trim();

  // Image URL check
  if (
    /^(https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif|svg))(?:\?.*)?$/i.test(sample) ||
    sample.includes("images.unsplash.com") ||
    sample.includes("cdn.shopify.com")
  ) {
    return "image_url";
  }

  // Currency check ($100, Rp 50.000, €99)
  if (/^[\$\€\£\¥]|(?:Rp|USD|EUR)\s?[0-9]/i.test(sample)) {
    return "currency";
  }

  // Boolean check
  if (/^(true|false|yes|no|1|0)$/i.test(sample)) {
    return "boolean";
  }

  // Number check
  const isAllNumbers = nonNullValues.slice(0, 5).every((v) => !isNaN(Number(String(v).replace(/,/g, ""))));
  if (isAllNumbers) {
    return "number";
  }

  // Date check
  if (!isNaN(Date.parse(sample)) && (sample.includes("-") || sample.includes("/"))) {
    return "date";
  }

  return "text";
}

/**
 * Parses raw CSV text and transforms it into structured SpreadsheetData.
 */
export function parseCsvText(
  csvText: string,
  title: string,
  sourceType: "google_sheets" | "csv_raw" | "preset",
  sourceUrl?: string
): SpreadsheetData {
  const result = Papa.parse<Record<string, string | number | boolean | null>>(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const rawRows = result.data.filter((row) => Object.values(row).some((val) => val !== null && val !== ""));
  const firstRow = rawRows[0];
  const allHeaders = result.meta.fields || (firstRow ? Object.keys(firstRow) : []);
  // Filter out empty or phantom columns from Google Sheets
  const validHeaders = allHeaders.filter(
    (colName) => colName && colName.trim() !== "" && !colName.startsWith("_")
  );

  const columns: ColumnSchema[] = validHeaders.map((colName) => {
    const colValues = rawRows.map((r) => r[colName]);
    const inferredType = inferColumnType(colValues);
    const firstVal = colValues.find((v) => v !== null && v !== undefined && String(v).trim() !== "");
    return {
      name: colName,
      type: inferredType,
      sampleValue: firstVal !== undefined ? String(firstVal) : "",
    };
  });

  return {
    title,
    sourceType,
    sourceUrl,
    columns,
    rows: rawRows,
    totalRows: rawRows.length,
    lastSyncedAt: new Date(),
  };
}

/**
 * Fetches live Google Sheets data with multi-candidate fallbacks to eliminate HTTP 400 errors.
 * If an OAuth accessToken is provided, tries Google Sheets API v4 first (supporting private sheets),
 * then falls back to public CSV export.
 */
export async function fetchGoogleSheetLive(sheetUrl: string, accessToken?: string): Promise<SpreadsheetData> {
  const trimmed = sheetUrl.trim().replace(/^["']|["']$/g, "");

  // Extract Sheet ID
  let sheetId: string | null = null;
  const sheetIdMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1] && sheetIdMatch[1] !== "e") {
    sheetId = sheetIdMatch[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    sheetId = trimmed;
  }

  // 1. If user is signed in with Google (OAuth token available), try official Google APIs
  if (accessToken && sheetId) {
    // Attempt 1A: Google Drive API v3 CSV Export (uses drive.readonly scope)
    try {
      const driveExportUrl = `https://www.googleapis.com/drive/v3/files/${sheetId}/export?mimeType=text%2Fcsv`;
      const driveRes = await fetch(driveExportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (driveRes.ok) {
        const csvText = await driveRes.text();
        if (csvText && !csvText.trim().startsWith("<!DOCTYPE html") && !csvText.includes("<html")) {
          return parseCsvText(csvText, "Google Sheet Live Sync", "google_sheets", sheetUrl);
        }
      }
    } catch {
      // Fallback to Sheets API v4
    }

    // Attempt 1B: Google Sheets API v4
    try {
      // Step 1: Get spreadsheet metadata (title and sheet tabs)
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties`;
      const metaRes = await fetch(metaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        const sheetTitle = metaJson.properties?.title || "Google Sheet Live Sync";
        const firstSheetName = metaJson.sheets?.[0]?.properties?.title || "Sheet1";

        // Step 2: Fetch cell values using the official Google Sheets API values endpoint
        const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
          firstSheetName
        )}!A1:ZZ1000?valueRenderOption=FORMATTED_VALUE`;
        const valuesRes = await fetch(valuesUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (valuesRes.ok) {
          const valuesJson = await valuesRes.json();
          const rawValues: unknown[][] = valuesJson.values || [];

          if (rawValues.length >= 2) {
            const rawHeaders = (rawValues[0] || []).map((h) => String(h ?? "").trim());
            const validHeaders = rawHeaders.filter((h) => h !== "" && !h.startsWith("_"));

            const rows: Array<Record<string, string>> = [];
            for (let i = 1; i < rawValues.length; i++) {
              const rowArr = rawValues[i] || [];
              const rowObj: Record<string, string> = {};
              let hasContent = false;
              rawHeaders.forEach((headerName, colIdx) => {
                if (headerName) {
                  const val = String(rowArr[colIdx] ?? "").trim();
                  rowObj[headerName] = val;
                  if (val !== "") hasContent = true;
                }
              });
              if (hasContent) {
                rows.push(rowObj);
              }
            }

            if (rows.length > 0) {
              const columns: ColumnSchema[] = validHeaders.map((colName) => {
                const colValues = rows.map((r) => r[colName]);
                const inferredType = inferColumnType(colValues);
                const firstVal = colValues.find((v) => v !== null && v !== undefined && String(v).trim() !== "");
                return {
                  name: colName,
                  type: inferredType,
                  sampleValue: firstVal !== undefined ? String(firstVal) : "",
                };
              });

              return {
                title: sheetTitle,
                sourceType: "google_sheets",
                sourceUrl: sheetUrl,
                columns,
                rows,
                totalRows: rows.length,
                lastSyncedAt: new Date(),
              };
            }
          }
        }
      }
    } catch {
      // Fallback to public export below
    }
  }

  // 2. Standard Public / Shared Link CSV Export Flow
  const candidateUrls = getGoogleSheetsCandidateUrls(sheetUrl);
  if (candidateUrls.length === 0) {
    throw new Error("Invalid Google Sheets link. Please provide a full Google Sheets URL or valid Sheet ID.");
  }

  let successfulCsv: string | null = null;
  let lastStatus = 0;

  const timestamp = Date.now();
  for (const url of candidateUrls) {
    try {
      const separator = url.includes("?") ? "&" : "?";
      const cacheBustedUrl = `${url}${separator}_t=${timestamp}`;
      // Clean simple GET without custom headers prevents browser CORS preflight errors
      const response = await fetch(cacheBustedUrl);
      lastStatus = response.status;
      if (response.ok) {
        const text = await response.text();
        // Check if response is actually CSV content and not an HTML login/consent wall
        if (text && !text.trim().startsWith("<!DOCTYPE html") && !text.includes("<html")) {
          successfulCsv = text;
          break;
        }
      }
    } catch {
      // Continue to next candidate URL
    }
  }

  if (!successfulCsv) {
    if (lastStatus === 400) {
      throw new Error(
        "Could not load sheet (HTTP 400). Please check that the sheet has data and sharing is set to 'Anyone with the link can view'."
      );
    }
    if (lastStatus === 403 || lastStatus === 401) {
      throw new Error(
        "Access denied. In Google Sheets, click Share > set General access to 'Anyone with the link' (Viewer)."
      );
    }
    throw new Error(
      "Could not load spreadsheet. In Google Sheets, click Share > set General access to 'Anyone with the link' (Viewer)."
    );
  }

  return parseCsvText(successfulCsv, "Google Sheet Live Sync", "google_sheets", sheetUrl);
}

export interface GoogleDriveSpreadsheet {
  id: string;
  name: string;
  modifiedTime?: string;
  url: string;
}

export interface DriveFetchResult {
  files: GoogleDriveSpreadsheet[];
  error?: "insufficient_scope" | "api_disabled" | "other" | null;
  errorMessage?: string;
}

/**
 * Fetches recent Google Sheets from user's Google Drive via OAuth token.
 */
export async function fetchUserSpreadsheetsFromDrive(accessToken: string): Promise<DriveFetchResult> {
  try {
    const q = encodeURIComponent(
      "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime%20desc&pageSize=30&fields=files(id%2Cname%2CmodifiedTime)`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const errMsg = String(errJson?.error?.message || "");
      const reason = String(errJson?.error?.errors?.[0]?.reason || errJson?.error?.details?.[0]?.reason || "");

      if (errMsg.includes("has not been used") || errMsg.includes("disabled") || reason === "SERVICE_DISABLED") {
        return { files: [], error: "api_disabled", errorMessage: errMsg };
      }
      if (res.status === 403 || errMsg.includes("insufficient") || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT" || reason === "insufficientPermissions") {
        return { files: [], error: "insufficient_scope", errorMessage: errMsg || "Drive scope not granted" };
      }
      return { files: [], error: "other", errorMessage: errMsg || `HTTP ${res.status}` };
    }

    const data = await res.json();
    let rawFiles: Array<{ id: string; name?: string; modifiedTime?: string }> = data.files || [];

    // Fallback: If 0 files found in My Drive, check if there are shared sheets
    if (rawFiles.length === 0) {
      try {
        const sharedQ = encodeURIComponent(
          "mimeType = 'application/vnd.google-apps.spreadsheet' and sharedWithMe = true and trashed = false"
        );
        const sharedRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${sharedQ}&orderBy=modifiedTime%20desc&pageSize=30&fields=files(id%2Cname%2CmodifiedTime)`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (sharedRes.ok) {
          const sharedData = await sharedRes.json();
          if (sharedData.files && sharedData.files.length > 0) {
            rawFiles = sharedData.files;
          }
        }
      } catch {
        // Keep initial empty result
      }
    }

    const files = rawFiles.map((file) => ({
      id: file.id,
      name: file.name || "Untitled Sheet",
      modifiedTime: file.modifiedTime,
      url: `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
    }));
    return { files, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { files: [], error: "other", errorMessage: msg };
  }
}


// ---------------------------------------------------------------------------
// Demo Presets: Optional Backups
// ---------------------------------------------------------------------------

export const DEMO_PRESETS: Record<string, { title: string; description: string; csv: string }> = {
  ecommerce: {
    title: "E-Commerce Flash Sale",
    description: "Product catalog with prices, stock, discount badges, and image links",
    csv: `Product Title,Original Price,Sale Price,Discount,Stock Status,Rating,Badge Text,Product Image
"Minimalist Ceramic Vase",$48.00,$29.00,"40% OFF","In Stock","4.9 / 5","BESTSELLER","https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600"
"Nordic Ergonomic Desk Lamp",$85.00,$55.00,"35% OFF","Only 3 Left","4.8 / 5","FLASH SALE","https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600"
"Matte Black Thermal Tumbler",$35.00,$19.90,"43% OFF","In Stock","5.0 / 5","TOP RATED","https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600"
"Premium Noise-Canceling Earbuds",$129.00,$79.00,"38% OFF","Limited Stock","4.7 / 5","HOT DEAL","https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600"`,
  },
};
