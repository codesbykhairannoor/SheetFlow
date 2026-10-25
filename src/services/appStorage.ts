import type { SpreadsheetData } from "../types/sheetsync";

const DB_NAME = "SheetSyncLiveDB";
const STORE_NAME = "sheetsync_store";
const DB_VERSION = 1;

const KEY_SAVED_URL = "sheetsync_saved_url";
const KEY_DRAFT_URL = "sheetsync_draft_url";
const KEY_CACHED_DATA = "sheetsync_cached_data";
const KEY_RECENT_SHEETS = "sheetsync_recent_sheets";

export interface RecentSheetEntry {
  url: string;
  title: string;
  rows: number;
  lastConnected: number;
}

/**
 * Opens or initializes the native browser IndexedDB for durable, resilient storage.
 */
function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Stores a key-value pair into IndexedDB.
 */
async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieves a value from IndexedDB by key.
 */
async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Removes a key from IndexedDB.
 */
async function idbRemove(key: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Saves active sheet URL and full dataset across all storage layers (IndexedDB + localStorage + sessionStorage).
 */
export async function persistActiveSheet(
  url: string,
  data: SpreadsheetData,
): Promise<void> {
  const cleanUrl = url.trim();

  // 1. Synchronous localStorage + sessionStorage backup
  try {
    localStorage.setItem(KEY_SAVED_URL, cleanUrl);
    localStorage.setItem(KEY_CACHED_DATA, JSON.stringify(data));
    sessionStorage.setItem(KEY_SAVED_URL, cleanUrl);
    // Remove draft URL since active sheet is confirmed
    localStorage.removeItem(KEY_DRAFT_URL);
  } catch {
    // Storage quota or sandboxing issue
  }

  // 2. Persistent IndexedDB layer
  await idbSet(KEY_SAVED_URL, cleanUrl);
  await idbSet(KEY_CACHED_DATA, data);
  await idbRemove(KEY_DRAFT_URL);

  // 3. Track in Recent Spreadsheets History
  await addRecentSheet({
    url: cleanUrl,
    title: data.title || "Google Sheet",
    rows: data.totalRows || 0,
    lastConnected: Date.now(),
  });
}

/**
 * Loads the active sheet from any available storage layer (checks IndexedDB, then localStorage, then sessionStorage).
 */
export async function restoreActiveSheet(): Promise<{
  url: string | null;
  data: SpreadsheetData | null;
  draftUrl: string | null;
}> {
  let url: string | null = null;
  let data: SpreadsheetData | null = null;
  let draftUrl: string | null = null;

  // 1. Try IndexedDB first for active saved sheet
  try {
    url = await idbGet<string>(KEY_SAVED_URL);
    data = await idbGet<SpreadsheetData>(KEY_CACHED_DATA);
    draftUrl = await idbGet<string>(KEY_DRAFT_URL);
  } catch {
    // Fallback to localStorage
  }

  // 2. Fallback to localStorage if IndexedDB is empty
  if (!url) {
    try {
      url =
        localStorage.getItem(KEY_SAVED_URL) ||
        sessionStorage.getItem(KEY_SAVED_URL);
      const rawData = localStorage.getItem(KEY_CACHED_DATA);
      if (rawData && !data) {
        data = JSON.parse(rawData);
      }
    } catch {
      // Ignore
    }
  }

  if (!draftUrl) {
    try {
      draftUrl =
        localStorage.getItem(KEY_DRAFT_URL) ||
        sessionStorage.getItem(KEY_DRAFT_URL);
    } catch {
      // Ignore
    }
  }

  return { url, data, draftUrl };
}

/**
 * Disconnects active sheet and clears active keys across all layers.
 */
export async function clearActiveSheet(): Promise<void> {
  try {
    localStorage.removeItem(KEY_SAVED_URL);
    localStorage.removeItem(KEY_CACHED_DATA);
    localStorage.removeItem(KEY_DRAFT_URL);
    sessionStorage.removeItem(KEY_SAVED_URL);
    sessionStorage.removeItem(KEY_DRAFT_URL);
  } catch {
    // Ignore
  }

  await idbRemove(KEY_SAVED_URL);
  await idbRemove(KEY_CACHED_DATA);
  await idbRemove(KEY_DRAFT_URL);
}

/**
 * Retrieves the user's history of recent spreadsheets.
 */
export async function getRecentSheets(): Promise<RecentSheetEntry[]> {
  // 1. Try IndexedDB
  let recents = await idbGet<RecentSheetEntry[]>(KEY_RECENT_SHEETS);

  // 2. Fallback to localStorage
  if (!recents) {
    try {
      const raw = localStorage.getItem(KEY_RECENT_SHEETS);
      if (raw) {
        recents = JSON.parse(raw);
      }
    } catch {
      // Ignore
    }
  }

  return recents || [];
}

/**
 * Adds or updates a spreadsheet entry in recent history.
 */
export async function addRecentSheet(entry: RecentSheetEntry): Promise<void> {
  const current = await getRecentSheets();

  // Deduplicate by URL
  const filtered = current.filter(
    (s) => s.url.toLowerCase() !== entry.url.toLowerCase(),
  );
  const updated = [entry, ...filtered].slice(0, 5); // Keep up to 5 most recent sheets

  try {
    localStorage.setItem(KEY_RECENT_SHEETS, JSON.stringify(updated));
  } catch {
    // Ignore
  }

  await idbSet(KEY_RECENT_SHEETS, updated);
}

/**
 * Immediately remembers whatever user is typing in the input box so it never disappears.
 * Stored in KEY_DRAFT_URL to NEVER overwrite an active working sheet.
 */
export function quickSaveDraftUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(KEY_DRAFT_URL, url.trim());
      sessionStorage.setItem(KEY_DRAFT_URL, url.trim());
    } else {
      localStorage.removeItem(KEY_DRAFT_URL);
      sessionStorage.removeItem(KEY_DRAFT_URL);
    }
  } catch {
    // Ignore
  }
}

const KEY_GOOGLE_AUTH = "sheetsync_google_auth_state";

export async function setGoogleConnected(connected: boolean): Promise<void> {
  try {
    if (connected) {
      localStorage.setItem(KEY_GOOGLE_AUTH, "true");
      sessionStorage.setItem(KEY_GOOGLE_AUTH, "true");
    } else {
      localStorage.removeItem(KEY_GOOGLE_AUTH);
      sessionStorage.removeItem(KEY_GOOGLE_AUTH);
    }
  } catch {
    // Ignore
  }
  if (connected) {
    await idbSet(KEY_GOOGLE_AUTH, "true");
  } else {
    await idbRemove(KEY_GOOGLE_AUTH);
  }
}

export async function isGoogleConnectedSaved(): Promise<boolean> {
  try {
    const idbVal = await idbGet<string>(KEY_GOOGLE_AUTH);
    if (idbVal === "true") return true;

    const lsVal =
      localStorage.getItem(KEY_GOOGLE_AUTH) ||
      sessionStorage.getItem(KEY_GOOGLE_AUTH);
    if (lsVal === "true") return true;
  } catch {
    // Ignore
  }
  return false;
}
