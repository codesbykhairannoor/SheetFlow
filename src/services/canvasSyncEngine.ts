import { upload } from "@canva/asset";
import type { ElementAtCursor } from "@canva/design";
import type { ColumnSchema } from "../types/sheetsync";

/**
 * Normalizes string keys for case-insensitive and space-insensitive matching.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-]/g, "");
}

/**
 * Replaces all {{ColumnName}} mustache tags in a given text with values from a row.
 */
export function replaceTagsInText(
  originalText: string,
  row: Record<string, string | number | boolean | null>,
): { newText: string; replacedCount: number } {
  let replacedCount = 0;
  const normalizedRowMap = new Map<string, string>();

  for (const [key, val] of Object.entries(row)) {
    normalizedRowMap.set(
      normalizeKey(key),
      val !== null && val !== undefined ? String(val) : "",
    );
  }

  // Regex matches {{ TagName }}
  const newText = originalText.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (match, tag) => {
      const normTag = normalizeKey(tag);
      if (normalizedRowMap.has(normTag)) {
        replacedCount++;
        return normalizedRowMap.get(normTag) ?? "";
      }
      return match; // Keep as is if column not found
    },
  );

  return { newText, replacedCount };
}

/**
 * Intelligently matches a text box on the canvas to its corresponding column
 * using tags {{Col}}, previous row values, prefixes, or column names, and replaces it with the target row's value.
 */
export function smartMatchAndReplace(
  originalText: string,
  targetRow: Record<string, string | number | boolean | null>,
  columns: ColumnSchema[],
  allRows?: Array<Record<string, string | number | boolean | null>>,
): { matched: boolean; newText: string; matchedColumn?: string } {
  const trimmed = originalText.trim();

  // 1. Direct Mustache Tag Match: {{ TagName }}
  let tagReplaced = false;
  const replacedWithTags = originalText.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (match, tag) => {
      const norm = normalizeKey(tag);
      const col = columns.find((c) => normalizeKey(c.name) === norm);
      if (
        col &&
        targetRow[col.name] !== undefined &&
        targetRow[col.name] !== null
      ) {
        tagReplaced = true;
        return String(targetRow[col.name]);
      }
      return match;
    },
  );

  if (tagReplaced) {
    return { matched: true, newText: replacedWithTags, matchedColumn: "tags" };
  }

  // 2. Exact match with any row value in the dataset (Reverse Lookup)
  if (allRows && allRows.length > 0 && trimmed.length > 0) {
    for (const col of columns) {
      const targetVal = String(targetRow[col.name] ?? "");
      const matchesAnyRow = allRows.some(
        (r) =>
          String(r[col.name] ?? "")
            .trim()
            .toLowerCase() === trimmed.toLowerCase(),
      );
      if (matchesAnyRow) {
        return { matched: true, newText: targetVal, matchedColumn: col.name };
      }
    }
  }

  // 3. Header prefix match, e.g. "Kota: Jakarta Selatan" or "Dokter: drg. X"
  for (const col of columns) {
    const colPrefix = col.name.toLowerCase() + ":";
    if (trimmed.toLowerCase().startsWith(colPrefix)) {
      const rest =
        targetRow[col.name] !== undefined && targetRow[col.name] !== null
          ? String(targetRow[col.name])
          : "";
      return {
        matched: true,
        newText: `${col.name}: ${rest}`,
        matchedColumn: col.name,
      };
    }
  }

  // 4. Placeholder header match (when the text is just the column name itself)
  for (const col of columns) {
    if (normalizeKey(col.name) === normalizeKey(trimmed)) {
      const val =
        targetRow[col.name] !== undefined && targetRow[col.name] !== null
          ? String(targetRow[col.name])
          : "";
      return { matched: true, newText: val, matchedColumn: col.name };
    }
  }

  return { matched: false, newText: originalText };
}

/**
 * Updates all selected text elements simultaneously using intelligent column matching.
 */
export async function smartUpdateAllSelected(
  selection: {
    count: number;
    read: () => Promise<{
      contents: ReadonlyArray<{ text: string }>;
      save: () => Promise<void>;
    }>;
  },
  targetRow: Record<string, string | number | boolean | null>,
  columns: ColumnSchema[],
  allRows?: Array<Record<string, string | number | boolean | null>>,
): Promise<{ updatedCount: number; matchedColumns: string[] }> {
  if (selection.count === 0) {
    return { updatedCount: 0, matchedColumns: [] };
  }

  const draft = await selection.read();
  let updatedCount = 0;
  const matchedColumns: string[] = [];

  draft.contents.forEach((item) => {
    const result = smartMatchAndReplace(item.text, targetRow, columns, allRows);
    if (result.matched && result.newText !== item.text) {
      item.text = result.newText;
      updatedCount++;
      if (
        result.matchedColumn &&
        !matchedColumns.includes(result.matchedColumn)
      ) {
        matchedColumns.push(result.matchedColumn);
      }
    }
  });

  if (updatedCount > 0) {
    await draft.save();
  }

  return { updatedCount, matchedColumns };
}

/**
 * Injects all column template tags into the canvas in a single click.
 */
export async function insertTemplateTagsToCanvas(
  addElementFn: (element: ElementAtCursor) => Promise<void>,
  columns: ColumnSchema[],
): Promise<void> {
  for (const col of columns) {
    await addElementFn({
      type: "text",
      children: [`{{${col.name}}}`],
    });
  }
}

/**
 * Injects a new dynamic tag placeholder text element into the active Canva design.
 */
export async function insertTagToCanvas(
  addElementFn: (element: ElementAtCursor) => Promise<void>,
  columnName: string,
  sampleValue?: string,
): Promise<void> {
  const displaySample = sampleValue ? ` (${sampleValue})` : "";
  await addElementFn({
    type: "text",
    children: [`{{${columnName}}}${displaySample}`],
  });
}

/**
 * Injects a formatted text element directly into the design.
 */
export async function insertCustomTextToCanvas(
  addElementFn: (element: ElementAtCursor) => Promise<void>,
  content: string,
): Promise<void> {
  await addElementFn({
    type: "text",
    children: [content],
  });
}

/**
 * Uploads an image asset from a web URL and places it onto the active Canva canvas.
 */
export async function uploadAndInsertImage(
  addElementFn: (element: ElementAtCursor) => Promise<void>,
  imageUrl: string,
  altText?: string,
): Promise<boolean> {
  try {
    const queued = await upload({
      type: "image",
      mimeType: "image/jpeg",
      url: imageUrl,
      thumbnailUrl: imageUrl,
      aiDisclosure: "none",
    });

    await addElementFn({
      type: "image",
      ref: queued.ref,
      altText: altText ? { text: altText, decorative: false } : undefined,
    });

    return true;
  } catch (err) {
    console.error("Failed to upload image into Canva asset library:", err);
    return false;
  }
}

/**
 * Generates and places an entire structured row card onto the canvas.
 */
/**
 * Applies a specific value to either the active text selection or inserts as a new text element.
 */
export async function applyValueToCanvas(
  value: string,
  selection: {
    count: number;
    read: () => Promise<{
      contents: ReadonlyArray<{ text: string }>;
      save: () => Promise<void>;
    }>;
  },
  addElementFn?: (element: ElementAtCursor) => Promise<void>,
): Promise<"replaced" | "inserted" | "failed"> {
  if (selection.count > 0) {
    try {
      const draft = await selection.read();
      draft.contents.forEach((item) => {
        item.text = value;
      });
      await draft.save();
      return "replaced";
    } catch (err) {
      console.error("Failed to update selected text:", err);
    }
  }

  if (addElementFn) {
    try {
      await addElementFn({
        type: "text",
        children: [value],
      });
      return "inserted";
    } catch (err) {
      console.error("Failed to insert text onto canvas:", err);
    }
  }

  return "failed";
}

/**
 * Generates and places all row fields onto the canvas with real values.
 * Uses spaced vertical positions (top: 80 + i * 46) so text elements never overlap.
 */
export async function insertCompleteRowCard(
  addElementFn: (element: any) => Promise<void>,
  row: Record<string, string | number | boolean | null>,
  columns: ColumnSchema[],
): Promise<void> {
  const startTop = 80;
  const startLeft = 80;
  const rowHeight = 46;

  let visualIndex = 0;
  for (const col of columns) {
    const rawVal = row[col.name];
    if (
      rawVal === null ||
      rawVal === undefined ||
      String(rawVal).trim() === ""
    ) {
      continue;
    }

    const valStr = String(rawVal).trim();

    // Check if it's an image
    if (
      col.type === "image_url" ||
      /^https?:\/\/.*\.(?:png|jpg|jpeg|webp)/i.test(valStr)
    ) {
      await uploadAndInsertImage(addElementFn, valStr, col.name);
      continue;
    }

    // Insert clean text with vertical offset so elements NEVER stack or overlap
    await addElementFn({
      type: "text",
      children: [valStr],
      top: startTop + visualIndex * rowHeight,
      left: startLeft,
      width: 500,
      fontSize: visualIndex === 0 ? 22 : 14,
    });

    visualIndex++;
  }
}
