import {
  createStoredBingo,
  isBingoData,
  isChecked,
  type StoredBingo,
} from "./storage";

// One format for individual grids and complete libraries, independent of IndexedDB.
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const MAX_GRIDS = 200;

export function serializeGrids(grids: StoredBingo[]): string {
  return JSON.stringify({
    format: "bingo-direct",
    version: 1,
    grids: grids.map(({ bingo, checked }) => ({
      bingo,
      checked: checked ?? [],
    })),
  });
}

export function parseGrids(source: string): StoredBingo[] {
  if (new Blob([source]).size > MAX_IMPORT_BYTES)
    throw new Error("Import too large");
  const data: unknown = JSON.parse(source);
  if (!data || typeof data !== "object") throw new Error("Invalid file");
  const file = data as Record<string, unknown>;
  if (
    file.format !== "bingo-direct" ||
    file.version !== 1 ||
    !Array.isArray(file.grids) ||
    file.grids.length === 0 ||
    file.grids.length > MAX_GRIDS
  )
    throw new Error("Invalid format");
  // Validate the whole file before adding anything to the library.
  const entries = file.grids.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid grid");
    const { bingo, checked = [] } = entry as Record<string, unknown>;
    if (!isBingoData(bingo) || !isChecked(checked, bingo))
      throw new Error("Invalid grid");
    return { bingo, checked };
  });
  return entries.map(({ bingo, checked }) => ({
    ...createStoredBingo({
      version: 1,
      title: bingo.title,
      subtitle: bingo.subtitle,
      author: bingo.author,
      theme: bingo.theme,
      rows: bingo.rows ?? 5,
      columns: bingo.columns ?? 5,
      cells: bingo.cells.map(({ text, image }) => ({ text, image })),
    }),
    checked: [...checked],
  }));
}

export function downloadGrids(grids: StoredBingo[], name: string) {
  const source = serializeGrids(grids);
  if (new Blob([source]).size > MAX_IMPORT_BYTES || grids.length > MAX_GRIDS)
    throw new Error("Export too large");
  const url = URL.createObjectURL(
    new Blob([source], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 80) || "bingo"}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
