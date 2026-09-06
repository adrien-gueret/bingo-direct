import { isThemeName } from "./themes";
import type { BingoData } from "./types";

const DATABASE_NAME = "direct-bingo";
const DATABASE_VERSION = 1;
const STORE_NAME = "app-state";
const LIBRARY_ID = "library";

export type StoredBingo = {
  id: string;
  bingo: BingoData;
  preview?: string;
  createdAt: string;
  updatedAt: string;
};

type LibraryState = {
  id: typeof LIBRARY_ID;
  grids: StoredBingo[];
  activeId: string;
};

const isDimension = (value: unknown) =>
  value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= 5);

const isBingoData = (value: unknown): value is BingoData => {
  if (!value || typeof value !== "object") return false;
  const bingo = value as Partial<BingoData>;
  return (
    bingo.version === 1 &&
    typeof bingo.title === "string" &&
    bingo.title.length <= 36 &&
    typeof bingo.subtitle === "string" &&
    bingo.subtitle.length <= 72 &&
    typeof bingo.author === "string" &&
    bingo.author.length <= 28 &&
    isThemeName(bingo.theme) &&
    Array.isArray(bingo.cells) &&
    isDimension(bingo.rows) &&
    isDimension(bingo.columns) &&
    bingo.cells.length === (bingo.rows ?? 5) * (bingo.columns ?? 5) &&
    bingo.cells.every(
      (cell) =>
        cell &&
        typeof cell === "object" &&
        typeof cell.text === "string" &&
        cell.text.length <= 70 &&
        typeof cell.image === "string" &&
        (cell.image === "" ||
          /^data:image\/(?:webp|jpeg|png);base64,/.test(cell.image)),
    )
  );
};

const isStoredBingo = (value: unknown): value is StoredBingo => {
  if (!value || typeof value !== "object") return false;
  const stored = value as Partial<StoredBingo>;
  return (
    typeof stored.id === "string" &&
    stored.id.length > 0 &&
    typeof stored.createdAt === "string" &&
    Number.isFinite(Date.parse(stored.createdAt)) &&
    typeof stored.updatedAt === "string" &&
    Number.isFinite(Date.parse(stored.updatedAt)) &&
    (stored.preview === undefined || typeof stored.preview === "string") &&
    isBingoData(stored.bingo)
  );
};

const isLibraryState = (value: unknown): value is LibraryState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<LibraryState>;
  return (
    state.id === LIBRARY_ID &&
    typeof state.activeId === "string" &&
    Array.isArray(state.grids) &&
    state.grids.length > 0 &&
    state.grids.every(isStoredBingo) &&
    state.grids.some((grid) => grid.id === state.activeId)
  );
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionComplete = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });

const createId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const randomPart = crypto.getRandomValues(new Uint32Array(2)).join("-");
  return `${Date.now()}-${randomPart}`;
};

export const createStoredBingo = (bingo: BingoData): StoredBingo => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    bingo: structuredClone(bingo),
    preview: "",
    createdAt: now,
    updatedAt: now,
  };
};

export const initializeLibrary = async (fallback: BingoData) => {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const stored = await requestResult(
      transaction.objectStore(STORE_NAME).get(LIBRARY_ID),
    );
    database.close();

    if (isLibraryState(stored)) {
      return { grids: stored.grids, activeId: stored.activeId };
    }
  } catch {
    // Fall back to an in-memory library; the save status will expose failures.
  }

  const firstGrid = createStoredBingo(fallback);
  return { grids: [firstGrid], activeId: firstGrid.id };
};

export const saveLibrary = async (
  grids: StoredBingo[],
  activeId: string,
): Promise<boolean> => {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      id: LIBRARY_ID,
      grids,
      activeId,
    } satisfies LibraryState);
    await transactionComplete(transaction);
    database.close();
    return true;
  } catch {
    return false;
  }
};
