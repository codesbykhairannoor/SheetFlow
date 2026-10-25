import { useState, useEffect, useCallback } from "react";
import { useFeatureSupport, useSelection } from "@canva/app-hooks";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Rows,
  Text,
  TextInput,
  Title,
} from "@canva/app-ui-kit";
import { auth } from "@canva/user";
import { addElementAtCursor, addElementAtPoint } from "@canva/design";
import * as styles from "styles/components.css";
import type { SpreadsheetData, SyncStatus } from "../../types/sheetsync";
import {
  fetchGoogleSheetLive,
  fetchUserSpreadsheetsFromDrive,
  getGoogleSheetsCandidateUrls,
  parseCsvText,
  type GoogleDriveSpreadsheet,
} from "../../services/sheetParser";
import {
  applyValueToCanvas,
  insertCompleteRowCard,
  insertTemplateTagsToCanvas,
  replaceTagsInText,
  smartUpdateAllSelected,
} from "../../services/canvasSyncEngine";
import {
  persistActiveSheet,
  restoreActiveSheet,
  clearActiveSheet,
  getRecentSheets,
  quickSaveDraftUrl,
  setGoogleConnected,
  isGoogleConnectedSaved,
  type RecentSheetEntry,
} from "../../services/appStorage";

export const DOCS_URL = "https://www.canva.dev/docs/apps/";

export const App = () => {
  // Canva SDK Hooks
  const isSupported = useFeatureSupport();
  const addElement = [addElementAtPoint, addElementAtCursor].find((fn) =>
    isSupported(fn)
  );
  const selection = useSelection("plaintext");

  // State
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>("");
  const [rawCsvInput, setRawCsvInput] = useState<string>("");
  const [inputMode, setInputMode] = useState<"sheets" | "csv">("sheets");
  const [googleTab, setGoogleTab] = useState<"picker" | "link">("picker");
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle" });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAuthorizing, setIsAuthorizing] = useState<boolean>(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [userDriveSheets, setUserDriveSheets] = useState<GoogleDriveSpreadsheet[]>([]);
  const [driveError, setDriveError] = useState<"insufficient_scope" | "api_disabled" | "other" | null>(null);
  const [isLoadingDriveSheets, setIsLoadingDriveSheets] = useState<boolean>(false);
  const [recentSheets, setRecentSheets] = useState<RecentSheetEntry[]>([]);
  const [isSwitchingSheet, setIsSwitchingSheet] = useState<boolean>(false);

  // Helper: Resilient OAuth Client (supports provider 'google' or default)
  const getOAuthClient = useCallback(() => {
    try {
      return auth.initOauth({ provider: "google", type: "single_account" });
    } catch {
      return auth.initOauth();
    }
  }, []);

  // Fetch user's Google Drive Spreadsheets
  const loadUserDriveSheets = useCallback(async () => {
    setIsLoadingDriveSheets(true);
    try {
      const oauth = getOAuthClient();
      let tokenRes = await oauth.getAccessToken();
      if (!tokenRes?.token) {
        tokenRes = await oauth.getAccessToken({ forceRefresh: true });
      }
      if (tokenRes?.token) {
        setIsGoogleConnected(true);
        await setGoogleConnected(true);
        const result = await fetchUserSpreadsheetsFromDrive(tokenRes.token);
        setUserDriveSheets(result.files);
        setDriveError(result.error ?? null);
      }
    } catch (err) {
      console.warn("Drive sheets fetch note:", err);
    } finally {
      setIsLoadingDriveSheets(false);
    }
  }, [getOAuthClient]);

  // Connect & Sync with Google Sheet URL
  const connectUrl = useCallback(
    async (url: string, isAutoLoad = false) => {
      if (!url.trim()) return;

      if (isAutoLoad) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setSyncStatus({
        state: "fetching",
        message: isAutoLoad
          ? "Refreshing latest sheet data..."
          : "Connecting to your Google Sheet...",
      });

      try {
        let accessToken: string | undefined;
        try {
          const oauth = getOAuthClient();
          const tokenRes = await oauth.getAccessToken();
          if (tokenRes?.token) {
            accessToken = tokenRes.token;
            setIsGoogleConnected(true);
            await setGoogleConnected(true);
          }
        } catch {
          // Not authorized or anonymous
        }

        const data = await fetchGoogleSheetLive(url, accessToken);
        if (data.totalRows === 0) {
          throw new Error("Connected, but the sheet has no rows of data.");
        }

        setSpreadsheet(data);
        setGoogleSheetsUrl(url);

        // Save to triple-layer storage (IndexedDB + localStorage + sessionStorage)
        await persistActiveSheet(url, data);

        // Refresh recent sheets list
        const recents = await getRecentSheets();
        setRecentSheets(recents);

        setSyncStatus({
          state: "success",
          message: isAutoLoad
            ? `Refreshed! Loaded ${data.totalRows} rows.`
            : `Connected! Loaded ${data.totalRows} rows.`,
        });
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load Google Sheet.";
        setSyncStatus({ state: "error", message: errorMessage });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [getOAuthClient]
  );

  // Hydrate saved URL, cached dataset, and recent sheets history on mount
  useEffect(() => {
    let isMounted = true;

    const hydrateStorage = async () => {
      try {
        const recents = await getRecentSheets();
        if (isMounted) setRecentSheets(recents);

        // Restore Google auth persistence
        const savedAuth = await isGoogleConnectedSaved();
        if (savedAuth && isMounted) {
          setIsGoogleConnected(true);
        }

        // Check if already authenticated with Google
        try {
          const oauth = getOAuthClient();
          let tokenRes = await oauth.getAccessToken();
          if (!tokenRes?.token && savedAuth) {
            tokenRes = await oauth.getAccessToken({ forceRefresh: true });
          }

          if (tokenRes?.token && isMounted) {
            setIsGoogleConnected(true);
            await setGoogleConnected(true);
            const result = await fetchUserSpreadsheetsFromDrive(tokenRes.token);
            if (isMounted) {
              setUserDriveSheets(result.files);
              setDriveError(result.error ?? null);
            }
          }
        } catch {
          // OAuth not connected
        }

        const { url, data, draftUrl } = await restoreActiveSheet();
        if (data && data.rows && data.rows.length > 0 && isMounted) {
          setSpreadsheet(data);
          setGoogleSheetsUrl(url || "");
        } else if (draftUrl && isMounted) {
          setGoogleSheetsUrl(draftUrl);
        }

        if (url && getGoogleSheetsCandidateUrls(url).length > 0 && isMounted) {
          // Auto-sync latest live sheet data in the background
          connectUrl(url, true);
        }
      } catch (err) {
        console.error("Storage hydration failed:", err);
      }
    };

    hydrateStorage();

    return () => {
      isMounted = false;
    };
  }, [connectUrl, getOAuthClient]);


  // Handler: Manual Connect Button
  const handleConnectGoogleSheets = async () => {
    await connectUrl(googleSheetsUrl, false);
  };

  // Handler: Refresh Live Sheet Data
  const handleRefreshData = async () => {
    if (googleSheetsUrl) {
      await connectUrl(googleSheetsUrl, true);
    }
  };

  // Handler: Sign in with Google (Canva Native OAuth)
  const handleGoogleSignIn = async () => {
    setIsAuthorizing(true);
    setSyncStatus({
      state: "fetching",
      message: "Opening Google authorization...",
    });

    try {
      const oauth = getOAuthClient();
      const response = await oauth.requestAuthorization({
        queryParams: { prompt: "consent" },
        scope: new Set([
          "https://www.googleapis.com/auth/spreadsheets.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.metadata.readonly",
        ]),
      });
      if (response.status === "completed") {
        setIsGoogleConnected(true);
        await setGoogleConnected(true);
        setGoogleTab("picker");
        await loadUserDriveSheets();
        setSyncStatus({ state: "idle" });
      } else {
        setSyncStatus({ state: "idle" });
      }
    } catch (err: unknown) {
      console.warn("Google OAuth note:", err);
      setSyncStatus({
        state: "error",
        message:
          "Google OAuth was cancelled or not yet enabled. You can connect via sheet link below!",
      });
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Handler: Sign out from Google
  const handleGoogleSignOut = async () => {
    try {
      const oauth = getOAuthClient();
      await oauth.deauthorize();
      setIsGoogleConnected(false);
      await setGoogleConnected(false);
      setUserDriveSheets([]);
      setDriveError(null);
      setSyncStatus({ state: "idle" });
    } catch (err) {
      console.warn("Sign out error:", err);
    }
  };

  // Handler: Parse Raw CSV
  const handleParseCsv = () => {
    if (!rawCsvInput.trim()) return;
    try {
      const data = parseCsvText(rawCsvInput, "Imported CSV", "csv_raw");
      if (data.totalRows === 0) {
        throw new Error("CSV parsed, but no data rows were found.");
      }
      setSpreadsheet(data);
      setActiveRowIndex(0);
      setSyncStatus({
        state: "success",
        message: `Loaded ${data.totalRows} rows from your CSV.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse CSV.";
      setSyncStatus({ state: "error", message: msg });
    }
  };

  // Handler: Disconnect Sheet & Clear Active Saved Link
  const handleDisconnect = async () => {
    setSpreadsheet(null);
    setGoogleSheetsUrl("");
    setRawCsvInput("");
    setActiveRowIndex(0);
    setSyncStatus({ state: "idle" });
    await clearActiveSheet();
    const recents = await getRecentSheets();
    setRecentSheets(recents);
  };

  // Handler: Apply a specific column value to selection or canvas
  const handleApplyField = async (columnName: string) => {
    if (!spreadsheet || !currentRow) return;
    const rawVal = currentRow[columnName];
    const valueStr =
      rawVal !== null && rawVal !== undefined ? String(rawVal) : "";

    if (!valueStr) {
      setSyncStatus({
        state: "error",
        message: `Column "${columnName}" is empty in Row #${activeRowIndex + 1}.`,
      });
      return;
    }

    setIsLoading(true);
    const result = await applyValueToCanvas(valueStr, selection, addElement);
    setIsLoading(false);

    if (result === "replaced") {
      setSyncStatus({
        state: "success",
        message: `Replaced canvas text with "${valueStr}" (${columnName})!`,
      });
    } else if (result === "inserted") {
      setSyncStatus({
        state: "success",
        message: `Added "${valueStr}" to canvas!`,
      });
    } else {
      setSyncStatus({
        state: "error",
        message:
          "Failed to apply to canvas. Make sure you are in Canva design editor.",
      });
    }
  };

  // Handler: Insert Complete Row Card onto Canvas
  const handleInsertCard = async () => {
    if (!addElement || !spreadsheet || spreadsheet.rows.length === 0) return;
    const currentRow = spreadsheet.rows[activeRowIndex];
    if (!currentRow) return;

    setIsLoading(true);
    await insertCompleteRowCard(addElement, currentRow, spreadsheet.columns);
    setIsLoading(false);
    setSyncStatus({
      state: "success",
      message: `Placed Row #${activeRowIndex + 1} onto canvas!`,
    });
  };

  // Handler: Update All Selected Design Elements at Once (Ctrl+A -> One Click)
  const handleUpdateAllSelected = async () => {
    if (!spreadsheet || !currentRow) return;

    if (selection.count === 0) {
      setSyncStatus({
        state: "error",
        message:
          "Select your design elements in Canva (or press Ctrl+A), then click this button to update all fields at once!",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { updatedCount, matchedColumns } = await smartUpdateAllSelected(
        selection,
        currentRow,
        spreadsheet.columns,
        spreadsheet.rows
      );

      if (updatedCount > 0) {
        setSyncStatus({
          state: "success",
          message: `⚡ Successfully updated ${updatedCount} elements in design (${matchedColumns.join(", ")}) to Row #${activeRowIndex + 1}!`,
        });
      } else {
        setSyncStatus({
          state: "error",
          message:
            "No matching fields found in selection. Ensure your text matches column names, previous values, or {{tags}}.",
        });
      }
    } catch (err) {
      console.error("Smart update failed:", err);
      setSyncStatus({
        state: "error",
        message: "Failed to update design. Please check selection permissions.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Insert Template Tags for starter setup
  const handleInsertTemplateTags = async () => {
    if (!addElement || !spreadsheet) return;
    setIsLoading(true);
    await insertTemplateTagsToCanvas(addElement, spreadsheet.columns);
    setIsLoading(false);
    setSyncStatus({
      state: "success",
      message: `Added ${spreadsheet.columns.length} template tags ({{ColumnName}}) to canvas!`,
    });
  };

  const currentRow = spreadsheet?.rows[activeRowIndex];
  const totalRows = spreadsheet?.totalRows || 0;

  return (
    <div className={styles.scrollContainer}>
      {/* 1. Header */}
      <div className={styles.appHeader}>
        <div className={styles.headerTopRow}>
          <Title size="small">SheetFlow</Title>
          {spreadsheet ? (
            <Badge tone="positive">Connected</Badge>
          ) : isGoogleConnected ? (
            <Badge tone="positive">Google Ready</Badge>
          ) : (
            <Badge tone="info">Ready</Badge>
          )}
        </div>
        <Text size="small" tone="tertiary">
          Auto-fill and sync design elements directly from Google Sheets.
        </Text>
      </div>

      {/* 2. Feedback Status Banner */}
      {syncStatus.state === "error" && (
        <Alert tone="critical">{syncStatus.message}</Alert>
      )}
      {syncStatus.state === "success" && (
        <div
          className={`${styles.statusMessage} ${styles.statusMessageSuccess}`}
        >
          <Text size="small">{syncStatus.message}</Text>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STATE A: NO DATASET CONNECTED (Clean, Minimal & Intuitive)          */}
      {/* ------------------------------------------------------------------ */}
      {!spreadsheet ? (
        <div className={styles.setupAccordion}>
          {isGoogleConnected ? (
            /* --- SUB-STATE A1: USER SIGNED IN WITH GOOGLE --- */
            <Rows spacing="1.5u">
              {/* Clean Google Account Strip */}
              <div className={styles.googleAccountStrip}>
                <div className={styles.googleAccountInfo}>
                  <span>🟢</span>
                  <span>
                    <strong>Google Account Connected</strong>
                  </span>
                </div>
                <Button
                  variant="tertiary"
                  size="small"
                  onClick={handleGoogleSignOut}
                >
                  Sign out
                </Button>
              </div>

              {/* If Google Drive files exist, show them */}
              {userDriveSheets.length > 0 && (
                <Rows spacing="1u">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text size="small">
                      <strong>Google Drive Files:</strong>
                    </Text>
                    <Button
                      variant="tertiary"
                      size="small"
                      onClick={loadUserDriveSheets}
                      loading={isLoadingDriveSheets}
                    >
                      🔄 Refresh
                    </Button>
                  </div>
                  <div className={styles.sheetPickerList}>
                    {userDriveSheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        className={styles.sheetPickerItem}
                        onClick={() => connectUrl(sheet.url, false)}
                        role="button"
                        tabIndex={0}
                      >
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingRight: "8px",
                          }}
                        >
                          <div className={styles.sheetItemTitle}>
                            📊 {sheet.name}
                          </div>
                          <div className={styles.sheetItemTime}>
                            {sheet.modifiedTime
                              ? `Updated ${new Date(sheet.modifiedTime).toLocaleDateString()}`
                              : "Google Sheet"}
                          </div>
                        </div>
                        <Button variant="secondary" size="small">
                          Open
                        </Button>
                      </div>
                    ))}
                  </div>
                </Rows>
              )}

              {/* Show Recent Spreadsheets History */}
              {recentSheets.length > 0 && (
                <div className={styles.recentSection}>
                  <Text size="small">
                    <strong>Recent Spreadsheets:</strong>
                  </Text>
                  {recentSheets.map((recent) => (
                    <div
                      key={recent.url}
                      className={styles.recentCard}
                      onClick={() => connectUrl(recent.url, false)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.recentCardInfo}>
                        <div className={styles.recentCardTitle}>
                          📊 {recent.title}
                        </div>
                        <div className={styles.recentCardMeta}>
                          {`${recent.rows} rows · Click to reconnect`}
                        </div>
                      </div>
                      <Button variant="tertiary" size="small">
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Connect Form */}
              <Rows spacing="1u">
                {userDriveSheets.length === 0 && driveError === "insufficient_scope" && (
                  <div
                    style={{
                      padding: "10px",
                      backgroundColor: "rgba(59, 130, 246, 0.08)",
                      borderRadius: "8px",
                      border: "1px solid rgba(59, 130, 246, 0.2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--ui-kit-color-text-primary)" }}>
                      📁 Select directly from Google Drive
                    </div>
                    <Text size="small" tone="tertiary">
                      Google requires permission to list Drive files. Click below to grant access:
                    </Text>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={handleGoogleSignIn}
                      stretch
                    >
                      Grant Google Drive Access
                    </Button>
                  </div>
                )}

                <FormField
                  label="Google Sheets Sharing URL"
                  description="Set sheet General access to 'Anyone with the link' (Viewer):"
                  control={(props) => (
                    <TextInput
                      {...props}
                      placeholder="Paste Google Sheet URL here (Ctrl + V)..."
                      value={googleSheetsUrl}
                      onChange={(val) => {
                        setGoogleSheetsUrl(val);
                        quickSaveDraftUrl(val);
                      }}
                    />
                  )}
                />
                <Button
                  variant="primary"
                  onClick={handleConnectGoogleSheets}
                  loading={isLoading}
                  disabled={!googleSheetsUrl.trim()}
                  stretch
                >
                  Connect Google Sheet
                </Button>
              </Rows>
            </Rows>
          ) : (
            /* --- SUB-STATE A2: USER NOT YET CONNECTED --- */
            <Rows spacing="1.5u">
              <Text size="small">
                <strong>Connect your spreadsheet to start:</strong>
              </Text>

              <Button
                variant="primary"
                onClick={handleGoogleSignIn}
                loading={isAuthorizing}
                stretch
              >
                🔵 Sign in with Google
              </Button>

              <div className={styles.divider}>OR CONNECT VIA LINK</div>

              {inputMode === "sheets" ? (
                <Rows spacing="1u">
                  <FormField
                    label="Google Sheets Sharing URL"
                    description="Set sheet General access to 'Anyone with the link' (Viewer):"
                    control={(props) => (
                      <TextInput
                        {...props}
                        placeholder="Paste Google Sheet URL here (Ctrl + V)..."
                        value={googleSheetsUrl}
                        onChange={(val) => {
                          setGoogleSheetsUrl(val);
                          quickSaveDraftUrl(val);
                        }}
                      />
                    )}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleConnectGoogleSheets}
                    loading={isLoading}
                    disabled={!googleSheetsUrl.trim()}
                    stretch
                  >
                    Connect Google Sheet
                  </Button>
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={() => setInputMode("csv")}
                    stretch
                  >
                    Or paste CSV text instead
                  </Button>
                </Rows>
              ) : (
                <Rows spacing="1.5u">
                  <FormField
                    label="Paste CSV Data"
                    description="Format: Header1,Header2 on the first row"
                    control={(props) => (
                      <TextInput
                        {...props}
                        placeholder={`Product Name,Price\nFlannel Shirt,Rp 150.000`}
                        value={rawCsvInput}
                        onChange={(val) => setRawCsvInput(val)}
                      />
                    )}
                  />
                  <Button
                    variant="primary"
                    onClick={handleParseCsv}
                    disabled={!rawCsvInput.trim()}
                    stretch
                  >
                    Load CSV Data
                  </Button>
                  <Button
                    variant="tertiary"
                    size="small"
                    onClick={() => setInputMode("sheets")}
                    stretch
                  >
                    Back to Google Sheets URL
                  </Button>
                </Rows>
              )}

              {/* 1-Click Recent Spreadsheets Reconnect List */}
              {recentSheets.length > 0 && (
                <div className={styles.recentSection}>
                  <Text size="small">
                    <strong>Recent Spreadsheets:</strong>
                  </Text>
                  {recentSheets.map((recent) => (
                    <div
                      key={recent.url}
                      className={styles.recentCard}
                      onClick={() => connectUrl(recent.url, false)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.recentCardInfo}>
                        <div className={styles.recentCardTitle}>
                          📊 {recent.title}
                        </div>
                        <div className={styles.recentCardMeta}>
                          {`${recent.rows} rows · Click to reconnect`}
                        </div>
                      </div>
                      <Button variant="tertiary" size="small">
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Rows>
          )}
        </div>
      ) : (
        /* ------------------------------------------------------------------ */
        /* STATE B: DATASET CONNECTED (Focused, Working Canvas Workflow)       */
        /* ------------------------------------------------------------------ */
        <Rows spacing="1.5u">
          {/* 1. Connected Sheet Header Bar (Full Width & Clean Layout) */}
          <div className={styles.datasetCard}>
            {/* Sheet Info (Full Width, No horizontal squeeze) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text size="small" tone="tertiary">
                  Connected Sheet
                </Text>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginTop: "2px",
                  }}
                  title={spreadsheet.title}
                >
                  📊 {spreadsheet.title}
                </div>
                <Text size="small" tone="tertiary">
                  {`${totalRows} rows loaded`}
                </Text>
              </div>
              <Badge tone="positive">Active</Badge>
            </div>

            {/* Action Toolbar on its own dedicated row */}
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                size="small"
                onClick={handleRefreshData}
                loading={isRefreshing}
              >
                🔄 Sync
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setIsSwitchingSheet(!isSwitchingSheet)}
              >
                {isSwitchingSheet ? "✕ Close" : "📁 Switch Sheet"}
              </Button>
              <Button
                variant="tertiary"
                size="small"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>

            {/* Quick Sheet Switcher Panel */}
            {isSwitchingSheet && (
              <div className={styles.switcherPanel}>
                <Text size="small">
                  <strong>Select or Paste Google Sheet URL:</strong>
                </Text>
                <FormField
                  label="Google Sheets Sharing URL"
                  description="Set sheet General access to 'Anyone with the link' (Viewer):"
                  control={(props) => (
                    <TextInput
                      {...props}
                      placeholder="Paste Google Sheet URL here..."
                      value={googleSheetsUrl}
                      onChange={(val) => {
                        setGoogleSheetsUrl(val);
                        quickSaveDraftUrl(val);
                      }}
                    />
                  )}
                />
                <Button
                  variant="secondary"
                  size="small"
                  onClick={async () => {
                    await handleConnectGoogleSheets();
                    setIsSwitchingSheet(false);
                  }}
                  loading={isLoading}
                  disabled={!googleSheetsUrl.trim()}
                  stretch
                >
                  Load Spreadsheet
                </Button>

                {/* Recent Spreadsheets */}
                {recentSheets.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <Text size="small" tone="tertiary">
                      <strong>Recent Spreadsheets:</strong>
                    </Text>
                    {recentSheets.map((recent) => (
                      <div
                        key={recent.url}
                        className={styles.recentCard}
                        style={{ marginTop: "6px" }}
                        onClick={async () => {
                          await connectUrl(recent.url, false);
                          setIsSwitchingSheet(false);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.recentCardInfo}>
                          <div className={styles.recentCardTitle}>
                            📊 {recent.title}
                          </div>
                          <div className={styles.recentCardMeta}>
                            {`${recent.rows} rows · Click to switch`}
                          </div>
                        </div>
                        <Button variant="tertiary" size="small">
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Active Row Stepper & Clean Field List */}
          <div className={styles.stepperContainer}>
            <div className={styles.stepperControls}>
              <Text size="small">
                <strong>{`Row ${activeRowIndex + 1} of ${totalRows}`}</strong>
              </Text>
              <div className={styles.stepperButtons}>
                <Button
                  variant="tertiary"
                  size="small"
                  disabled={activeRowIndex === 0}
                  onClick={() => setActiveRowIndex((i) => Math.max(0, i - 1))}
                >
                  ◀ Prev
                </Button>
                <Button
                  variant="tertiary"
                  size="small"
                  disabled={activeRowIndex >= totalRows - 1}
                  onClick={() =>
                    setActiveRowIndex((i) => Math.min(totalRows - 1, i + 1))
                  }
                >
                  Next ▶
                </Button>
              </div>
            </div>

            {/* Field Snapshot List */}
            {currentRow && (
              <div className={styles.itemSnapshot}>
                {spreadsheet.columns.map((col) => {
                  const cellVal = String(currentRow[col.name] ?? "");
                  return (
                    <div key={col.name} className={styles.snapshotRow}>
                      <div
                        style={{ flex: 1, minWidth: 0, paddingRight: "8px" }}
                      >
                        <div className={styles.snapshotLabel}>{col.name}</div>
                        <div className={styles.snapshotValue} title={cellVal}>
                          {cellVal || "—"}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleApplyField(col.name)}
                        disabled={!cellVal}
                      >
                        {selection.count > 0 ? "Replace" : "+ Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Primary Action Area */}
          <div className={styles.actionArea}>
            <Button
              variant="primary"
              onClick={handleUpdateAllSelected}
              loading={isLoading}
              stretch
            >
              {`⚡ Update All in Design (Row #${activeRowIndex + 1})`}
            </Button>

            <Button
              variant="secondary"
              onClick={handleInsertCard}
              loading={isLoading}
              disabled={!addElement}
              stretch
            >
              {`+ Insert All Fields of Row #${activeRowIndex + 1} onto Canvas`}
            </Button>
          </div>

          {/* 4. Helper Callout */}
          <Text size="small" tone="tertiary">
            💡 <strong>Smart Multi-Sync:</strong>{" "}
            <em>
              Select all elements in Canva (press <code>Ctrl+A</code>) and click{" "}
              <strong>&quot;⚡ Update All in Design&quot;</strong> to fill or
              update all fields at once!
            </em>
          </Text>
        </Rows>
      )}
    </div>
  );
};
