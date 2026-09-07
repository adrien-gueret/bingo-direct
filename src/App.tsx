import { ScaledPoster } from "./BingoPoster";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type SetStateAction,
} from "react";
import {
  createStarterBingo,
  emptyBingo,
  getRandomSuggestions,
  gridDimensions,
  resizeBingo,
} from "./data";
import {
  createGridPreviewDataUrl,
  exportBingoImage,
  shareBingoImage,
} from "./export-image";
import { prepareCellImage } from "./image-utils";
import { messages, rememberLocale } from "./i18n";
import {
  createStoredBingo,
  initializeLibrary,
  saveLibrary,
  type StoredBingo,
} from "./storage";
import { getThemeStyle, themeDefinitions, themeNames } from "./themes";
import type { BingoCell, BingoData, Locale } from "./types";
import { useGridLibrary } from "./use-grid-library";
import { downloadGrids, MAX_IMPORT_BYTES, parseGrids } from "./grid-transfer";

type Mode = "edit" | "play";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type Confirmation =
  | { kind: "resize"; rows: number; columns: number; removed: number }
  | { kind: "clear" }
  | { kind: "delete"; grid: StoredBingo };

type AppProps = {
  initialLocale: Locale;
};

const buildFaviconDataUrl = (theme: keyof typeof themeDefinitions) => {
  const palette = themeDefinitions[theme];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Bingo Direct">
      <circle cx="32" cy="32" r="29" fill="${palette.primary}"/>
      <circle cx="32" cy="32" r="24" fill="none" stroke="${palette.accent}" stroke-width="3"/>
      <text x="32" y="41" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="28" fill="#ffffff">B!</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const cloneBingo = (bingo: BingoData): BingoData => ({
  ...bingo,
  cells: bingo.cells.map((cell) => ({ ...cell })),
});

const isCellFilled = (cell: BingoCell) =>
  Boolean(cell.text.trim() || cell.image);

function App({ initialLocale }: AppProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = messages[locale];
  const [footerFunSeed] = useState(() => Math.random());
  const footerFun = t.footerFun[Math.floor(footerFunSeed * t.footerFun.length)];
  const suggestions = useMemo(() => getRandomSuggestions(locale), [locale]);
  const [initialGrid] = useState(() =>
    createStoredBingo(createStarterBingo(initialLocale)),
  );
  const { grids, setGrids, histories, updateGrid, travel } = useGridLibrary(initialGrid);
  const [activeId, setActiveId] = useState(initialGrid.id);
  const [isLibraryReady, setIsLibraryReady] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [isDirectMode, setIsDirectMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editingCellIndex, setEditingCellIndex] = useState<number | null>(null);
  const [draggedCellIndex, setDraggedCellIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isImageImporting, setIsImageImporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [notice, setNotice] = useState("");
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryDialogRef = useRef<HTMLElement>(null);
  const libraryCloseRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLElement>(null);
  const confirmationCancelRef = useRef<HTMLButtonElement>(null);
  const cellEditorDialogRef = useRef<HTMLElement>(null);
  const cellEditorCloseRef = useRef<HTMLButtonElement>(null);
  const directDialogRef = useRef<HTMLDivElement>(null);
  const directExitRef = useRef<HTMLButtonElement>(null);
  const playModeTriggerRef = useRef<HTMLButtonElement>(null);
  const cellTriggerRefs = useRef(new Map<number, HTMLButtonElement>());
  const didDropCellRef = useRef(false);
  const activeGrid =
    grids.find((storedGrid) => storedGrid.id === activeId) ?? grids[0];
  const bingo = activeGrid.bingo;
  const checked = new Set(activeGrid.checked ?? []);
  const canUndo = Boolean(histories[activeId]?.past.length);
  const canRedo = Boolean(histories[activeId]?.future.length);
  const { rows, columns } = gridDimensions(bingo);
  const filledCellCount = bingo.cells.filter(isCellFilled).length;
  const directProgress = filledCellCount
    ? Math.round((checked.size / filledCellCount) * 100)
    : 0;
  const exitDirectMode = () => {
    setIsDirectMode(false);
    setMode("edit");
  };

  useEffect(() => {
    const favicon = document.head.querySelector(
      "link[rel='icon']",
    ) as HTMLLinkElement | null;
    const themeColorMeta = document.head.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    const nextFavicon = favicon ?? document.createElement("link");
    const nextThemeColor = themeColorMeta ?? document.createElement("meta");

    nextFavicon.rel = "icon";
    nextFavicon.type = "image/svg+xml";
    nextFavicon.href = buildFaviconDataUrl(bingo.theme);

    if (!favicon) {
      document.head.appendChild(nextFavicon);
    }

    nextThemeColor.name = "theme-color";
    nextThemeColor.content = themeDefinitions[bingo.theme].primary;

    if (!themeColorMeta) {
      document.head.appendChild(nextThemeColor);
    }
  }, [bingo.theme]);
  const setBingo = (value: SetStateAction<BingoData>, group?: string) => {
    updateGrid(activeId, (grid) => ({ ...grid,
      bingo: typeof value === "function" ? value(grid.bingo) : value,
    }), group);
  };
  const setChecked = (value: SetStateAction<Set<number>>) => {
    setSaveStatus("saving");
    updateGrid(activeId, (grid) => ({ ...grid,
      checked: [...(typeof value === "function" ? value(new Set(grid.checked ?? [])) : value)],
    }));
  };
  const moveHistory = (direction: "undo" | "redo") => {
    if (isImageImporting || confirmation || (direction === "undo" ? !canUndo : !canRedo)) return;
    const steps = direction === "undo" ? histories[activeId].past : histories[activeId].future;
    const destination = steps[steps.length - 1];
    if (editingCellIndex !== null && editingCellIndex >= destination.bingo.cells.length) setEditingCellIndex(null);
    travel(activeId, direction);
    setSaveStatus("saving");
    setNotice(direction === "undo" ? t.undone : t.redone);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Preserve native text undo while editing a field.
      if (target?.closest('input, textarea, select, [contenteditable="true"]') ||
          isLibraryOpen || confirmation || isImageImporting || event.altKey ||
          !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      const direction = key === "z" ? (event.shiftKey ? "redo" : "undo") : key === "y" ? "redo" : null;
      if (!direction) return;
      event.preventDefault();
      moveHistory(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    let isMounted = true;
    void initializeLibrary(createStarterBingo(initialLocale)).then(
      (library) => {
        if (!isMounted) return;
        setGrids(library.grids);
        setActiveId(library.activeId);
        setIsLibraryReady(true);
      },
    );
    return () => {
      isMounted = false;
    };
  }, [initialLocale]);

  useEffect(() => {
    if (!isLibraryReady) return;
    let isCancelled = false;
    const missing = grids.filter((grid) => !grid.preview);
    if (missing.length === 0) return;
    const timer = window.setTimeout(() => { void (async () => {
      const results = [];
      for (const grid of missing) {
        if (isCancelled) return [];
        results.push({ id: grid.id, preview: await createGridPreviewDataUrl(grid.bingo, locale) });
      }
      return results;
    })().then((results) => {
      if (isCancelled) return;
      const previews = new Map(
        results
          .filter((result) => result.preview)
          .map((r) => [r.id, r.preview]),
      );
      if (previews.size === 0) return;
      setGrids((current) =>
        current.map((grid) =>
          previews.has(grid.id)
            ? { ...grid, preview: previews.get(grid.id) }
            : grid,
        ),
      );
    }); }, 700);
    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [grids, isLibraryReady, locale]);

  useEffect(() => {
    if (!isLibraryReady) return;
    let isCancelled = false;
    let idleTimeout: number | undefined;
    setSaveStatus("saving");
    void (async () => {
      const wasSaved = await saveLibrary(grids, activeId);
      if (isCancelled) return;
      if (!wasSaved) {
        setSaveStatus("error");
        return;
      }
      setSaveStatus("saved");
      idleTimeout = window.setTimeout(() => setSaveStatus("idle"), 1500);
    })();
    return () => {
      isCancelled = true;
      if (idleTimeout) window.clearTimeout(idleTimeout);
    };
  }, [activeId, grids, isLibraryReady]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.pageTitle;
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", t.metaDescription);
  }, [locale, t.metaDescription, t.pageTitle]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isDirectMode) return;
    directExitRef.current?.focus();
    document.body.classList.add("modal-open");
    const handleDirectKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        exitDirectMode();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(directDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDirectKeyboard);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleDirectKeyboard);
      playModeTriggerRef.current?.focus();
    };
  }, [isDirectMode]);

  useEffect(() => {
    setIsDirectMode(false);
  }, [activeId]);

  useEffect(() => {
    if (!isLibraryOpen || confirmation || editingCellIndex !== null) return;

    libraryCloseRef.current?.focus();
    document.body.classList.add("modal-open");
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLibraryOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = libraryDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleDialogKeyboard);
      libraryTriggerRef.current?.focus();
    };
  }, [confirmation, editingCellIndex, isLibraryOpen]);

  useEffect(() => {
    if (!confirmation) return;

    confirmationCancelRef.current?.focus();
    document.body.classList.add("modal-open");
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConfirmation(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable =
        confirmationDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleDialogKeyboard);
      if (isLibraryOpen) libraryCloseRef.current?.focus();
      else libraryTriggerRef.current?.focus();
    };
  }, [confirmation, isLibraryOpen]);

  useEffect(() => {
    if (editingCellIndex === null) return;

    cellEditorCloseRef.current?.focus();
    document.body.classList.add("modal-open");
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditingCellIndex(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable =
        cellEditorDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleDialogKeyboard);
      cellTriggerRefs.current.get(editingCellIndex)?.focus();
    };
  }, [editingCellIndex]);

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    setBingo((current) => {
      const isUntouchedStarter =
        JSON.stringify(current) === JSON.stringify(createStarterBingo(locale));
      const isUntouchedEmpty =
        JSON.stringify(current) === JSON.stringify(emptyBingo(locale));
      if (isUntouchedStarter) return createStarterBingo(nextLocale);
      if (isUntouchedEmpty) return emptyBingo(nextLocale);
      return current;
    });
    setLocale(nextLocale);
    rememberLocale(nextLocale);
  };

  const updateMeta = <K extends keyof BingoData>(
    key: K,
    value: BingoData[K],
  ) => {
    setBingo((current) => ({ ...current, [key]: value }), typeof value === "string" && key !== "theme" ? `meta:${key}` : undefined);
  };

  const updateCell = (index: number, patch: Partial<BingoCell>) => {
    setBingo((current) => ({
      ...current,
      cells: current.cells.map((cell, cellIndex) =>
        cellIndex === index ? { ...cell, ...patch } : cell,
      ),
    }), Object.keys(patch).length === 1 && patch.text !== undefined ? `cell:${index}:text` : undefined);
  };

  const importCellImage = async (imagePromise: Promise<string>) => {
    if (editingCellIndex === null || isImageImporting) return;
    const target = editingCellIndex;
    setIsImageImporting(true);
    setNotice(t.imageProcessing);
    try {
      const image = await imagePromise;
      updateCell(target, { image });
      setNotice(t.imageAdded);
    } catch {
      setNotice(t.imageLoadFailed);
    } finally {
      setIsImageImporting(false);
    }
  };

  const openCellEditor = (index: number) => {
    setEditingCellIndex(index);
  };

  const clearEditingCell = () => {
    if (editingCellIndex === null) return;
    updateCell(editingCellIndex, { text: "", image: "" });
    setEditingCellIndex(null);
  };

  const toggleCell = (index: number) => {
    const next = new Set(checked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setChecked(next);
  };

  const startCellDrag = (
    event: DragEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (mode !== "edit" || !isCellFilled(bingo.cells[index])) return;
    didDropCellRef.current = false;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDraggedCellIndex(index);
  };

  const allowCellDrop = (
    event: DragEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (mode !== "edit" || draggedCellIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  };

  const dropCell = (
    event: DragEvent<HTMLButtonElement>,
    targetIndex: number,
  ) => {
    event.preventDefault();
    const sourceIndex = draggedCellIndex;
    if (mode !== "edit" || sourceIndex === null) return;

    didDropCellRef.current = true;
    if (sourceIndex !== targetIndex) {
      setSaveStatus("saving");
      updateGrid(activeId, (grid) => {
        const cells = [...grid.bingo.cells];
        [cells[sourceIndex], cells[targetIndex]] = [
          cells[targetIndex],
          cells[sourceIndex],
        ];
        const next = new Set(grid.checked ?? []);
        const sourceIsChecked = next.has(sourceIndex);
        const targetIsChecked = next.has(targetIndex);
        if (sourceIsChecked) next.add(targetIndex);
        else next.delete(targetIndex);
        if (targetIsChecked) next.add(sourceIndex);
        else next.delete(sourceIndex);
        return { ...grid, bingo: { ...grid.bingo, cells }, checked: [...next] };
      });
    }
    setDraggedCellIndex(null);
    setDropTargetIndex(null);
  };

  const endCellDrag = () => {
    setDraggedCellIndex(null);
    setDropTargetIndex(null);
  };

  const handleCellClick = (index: number) => {
    if (didDropCellRef.current) {
      didDropCellRef.current = false;
      return;
    }
    openCellEditor(index);
  };

  const addSuggestion = (suggestion: BingoCell) => {
    const emptyIndex = bingo.cells.findIndex((cell) => !isCellFilled(cell));
    if (emptyIndex === -1) {
      setNotice(t.gridComplete);
      return;
    }
    updateCell(emptyIndex, suggestion);
    setNotice(t.addedToCell(emptyIndex + 1));
  };

  const clearCells = () => {
    if (filledCellCount < 2) return;
    setConfirmation({ kind: "clear" });
  };

  const performClearCells = () => {
    setBingo((current) => ({
      ...current,
      cells: current.cells.map(() => ({ text: "", image: "" })),
    }));
  };

  const startNew = () => {
    const newGrid = createStoredBingo(emptyBingo(locale));
    setGrids((current) => [newGrid, ...current]);
    setActiveId(newGrid.id);
    setMode("edit");
    setIsLibraryOpen(false);
    setNotice(t.gridCreated);
  };

  const openGrid = (storedGrid: StoredBingo) => {
    setActiveId(storedGrid.id);
    setMode("edit");
    setIsLibraryOpen(false);
  };

  const duplicateGrid = (storedGrid: StoredBingo) => {
    const suffix = ` ${t.copySuffix}`;
    const sourceTitle = storedGrid.bingo.title || t.untitledGrid;
    const duplicate = createStoredBingo({
      ...cloneBingo(storedGrid.bingo),
      title: `${sourceTitle.slice(0, Math.max(0, 36 - suffix.length))}${suffix}`,
    });
    setGrids((current) => [duplicate, ...current]);
    setActiveId(duplicate.id);
    setMode("edit");
    setIsLibraryOpen(false);
    setNotice(t.gridDuplicated);
  };

  const performDeleteGrid = (storedGrid: StoredBingo) => {
    if (grids.length < 2) return;
    const remaining = grids.filter((grid) => grid.id !== storedGrid.id);
    setGrids(remaining);
    if (storedGrid.id === activeId) {
      setActiveId(remaining[0].id);
      setMode("edit");
    }
    setNotice(t.gridDeleted);
  };

  const applySize = (nextRows: number, nextColumns: number) => {
    setSaveStatus("saving");
    updateGrid(activeId, (grid) => ({
      ...grid, bingo: resizeBingo(grid.bingo, nextRows, nextColumns),
      checked: (grid.checked ?? [])
          .filter(
            (index) =>
              Math.floor(index / columns) < nextRows &&
              index % columns < nextColumns,
          )
          .map(
            (index) =>
              Math.floor(index / columns) * nextColumns + (index % columns),
          ),
    }));
  };

  const requestSize = (nextRows: number, nextColumns: number) => {
    if (nextRows === rows && nextColumns === columns) return;
    const removed = bingo.cells.filter(
      (cell, index) =>
        isCellFilled(cell) &&
        (Math.floor(index / columns) >= nextRows ||
          index % columns >= nextColumns),
    ).length;
    if (removed)
      setConfirmation({
        kind: "resize",
        rows: nextRows,
        columns: nextColumns,
        removed,
      });
    else applySize(nextRows, nextColumns);
  };

  const confirmAction = () => {
    if (!confirmation) return;
    if (confirmation.kind === "clear") performClearCells();
    else if (confirmation.kind === "resize")
      applySize(confirmation.rows, confirmation.columns);
    else performDeleteGrid(confirmation.grid);
    setConfirmation(null);
  };

  const confirmationTitle =
    confirmation?.kind === "resize"
      ? t.resizeGrid
      : confirmation?.kind === "clear"
        ? t.clearCells
        : t.deleteGrid;
  const confirmationMessage =
    confirmation?.kind === "resize"
      ? t.confirmResize(
          confirmation.removed,
          confirmation.rows,
          confirmation.columns,
        )
      : confirmation?.kind === "clear"
        ? t.confirmClearCells
        : confirmation
          ? t.confirmDelete(confirmation.grid.bingo.title || t.untitledGrid)
          : "";

  const formatUpdatedAt = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const download = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try { await exportBingoImage(bingo, checked, locale); }
    catch { setNotice(t.imageShareFailed); }
    finally { setIsSharing(false); }
  };

  const exportFile = (selected: StoredBingo[], name: string) => {
    try {
      downloadGrids(selected, name);
      setNotice(t.fileExported);
    } catch {
      setNotice(t.fileExportFailed);
    }
  };

  const importFile = async (file: File) => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("Import too large");
      const imported = parseGrids(await file.text());
      setGrids((current) => [...imported, ...current]);
      setActiveId(imported[0].id);
      setEditingCellIndex(null);
      setConfirmation(null);
      setMode("edit");
      setIsLibraryOpen(false);
      setNotice(t.gridsImported(imported.length));
    } catch {
      setNotice(t.fileImportFailed);
    } finally {
      setIsImporting(false);
    }
  };

  const share = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const result = await shareBingoImage(bingo, checked, locale);
      setNotice(result === "shared" ? t.imageShared : t.imageDownloaded);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(t.imageShareFailed);
    } finally {
      setIsSharing(false);
    }
  };

  const enterDirectMode = () => {
    setMode("play");
    setIsDirectMode(true);
  };

  if (!isLibraryReady) {
    return (
      <div className="app app-loading" role="status">
        <span className="loading-mark" aria-hidden="true">
          B!
        </span>
        <p>{t.loadingLibrary}</p>
      </div>
    );
  }

  return (
    <div className="app" style={getThemeStyle(bingo.theme)}>
      <header className="topbar" inert={isDirectMode}>
        <a
          className="brand"
          href={window.location.pathname}
          aria-label={t.homeLabel}
        >
          <span className="brand-mark" aria-hidden="true">
            B!
          </span>
          <span>
            <strong>Bingo Direct</strong>
          </span>
        </a>

        <nav className="top-actions" aria-label={t.actionsLabel}>
          <div
            className="language-switch"
            role="group"
            aria-label={t.languageLabel}
          >
            {(["fr", "en"] as Locale[]).map((language) => (
              <button
                key={language}
                type="button"
                className={locale === language ? "active" : ""}
                onClick={() => changeLocale(language)}
                aria-pressed={locale === language}
                lang={language}
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            ref={libraryTriggerRef}
            className="button button-ghost library-trigger"
            type="button"
            onClick={() => setIsLibraryOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isLibraryOpen}
          >
            {t.myGrids} <span>{grids.length}</span>
          </button>
        </nav>
      </header>

      <main inert={isDirectMode}>
        <section className="hero">
          <h1>{t.heroTitle}</h1>
          <p>{t.heroSubtitle}</p>
        </section>

        <div className="workspace">
          <aside className="editor-card" aria-label={t.editorLabel}>
            <label className="field">
              <span>{t.gridTitle}</span>
              <input
                value={bingo.title}
                maxLength={36}
                onChange={(event) => updateMeta("title", event.target.value)}
                placeholder={t.gridTitlePlaceholder}
              />
            </label>

            <label className="field">
              <span>{t.subtitle}</span>
              <input
                value={bingo.subtitle}
                maxLength={72}
                onChange={(event) => updateMeta("subtitle", event.target.value)}
                placeholder={t.subtitlePlaceholder}
              />
            </label>

            <label className="field">
              <span>
                {t.nickname} <em>{t.optional}</em>
              </span>
              <input
                value={bingo.author}
                maxLength={28}
                onChange={(event) => updateMeta("author", event.target.value)}
                placeholder={t.nicknamePlaceholder}
              />
            </label>

            <div className="grid-size-picker">
              <h3>{t.gridSize}</h3>
              {(["rows", "columns"] as const).map((dimension) => (
                <fieldset key={dimension}>
                  <legend>{t[dimension]}</legend>
                  <div>
                    {[2, 3, 4, 5].map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={
                          (dimension === "rows" ? rows : columns) === value
                        }
                        onClick={() =>
                          requestSize(
                            dimension === "rows" ? value : rows,
                            dimension === "columns" ? value : columns,
                          )
                        }
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <fieldset className="theme-picker">
              <legend>{t.mood}</legend>
              <div>
                {themeNames.map((theme) => (
                  <button
                    key={theme}
                    className={`theme-swatch ${bingo.theme === theme ? "selected" : ""}`}
                    style={{ background: themeDefinitions[theme].primary }}
                    type="button"
                    onClick={() => updateMeta("theme", theme)}
                    aria-label={t.themeLabels[theme]}
                    aria-pressed={bingo.theme === theme}
                    title={t.themeLabels[theme]}
                  />
                ))}
              </div>
            </fieldset>

            {filledCellCount >= 2 && (
              <div className="quick-actions">
                <button type="button" onClick={clearCells}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" />
                  </svg>
                  {t.clearCells}
                </button>
              </div>
            )}

            <div className="inspiration">
              <div className="section-label">
                <span>{t.inspiration}</span>
                <small>{t.clickToAdd}</small>
              </div>
              <div className="suggestion-list">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.text}
                    type="button"
                    onClick={() => addSuggestion(suggestion)}
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="board-card" aria-label={t.boardLabel}>
            <div className="board-toolbar">
              <div
                className="mode-switch"
                role="group"
                aria-label={t.displayMode}
              >
                <button
                  type="button"
                  className={mode === "edit" ? "active" : ""}
                  onClick={() => setMode("edit")}
                >
                  {t.edit}
                </button>
                <button
                  ref={playModeTriggerRef}
                  type="button"
                  className={mode === "play" ? "active" : ""}
                  onClick={enterDirectMode}
                >
                  {t.play}
                </button>
              </div>
              <div className="board-save-status">
                {saveStatus !== "idle" && (
                  <span
                    className={`save-status ${saveStatus}`}
                    role="status"
                    aria-live="polite"
                  >
                    <i />
                    {saveStatus === "saving"
                      ? t.saving
                      : saveStatus === "saved"
                        ? t.saved
                        : t.saveFailed}
                  </span>
                )}
              </div>
              <div className="board-actions">
                {mode === "play" && checked.size > 0 && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setChecked(new Set())}
                  >
                    {t.reset}
                  </button>
                )}
                <button
                  className="board-share"
                  type="button"
                  onClick={share}
                  disabled={isSharing}
                  aria-busy={isSharing}
                >
                  <span aria-hidden="true">↗</span>{" "}
                  {isSharing ? t.sharingImage : t.share}
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={download}
                  disabled={isSharing}
                  title={t.exportPng}
                >
                  ↓ <span>PNG</span>
                </button>
              </div>
            </div>

            <div className="grid-tools">
              <div className="history-actions" role="group" aria-label={t.historyLabel}>
                <button type="button" disabled={!canUndo || isImageImporting} onClick={() => moveHistory("undo")} title={t.undoShortcut}>
                  <span aria-hidden="true">↶</span> {t.undo}
                </button>
                <button type="button" disabled={!canRedo || isImageImporting} onClick={() => moveHistory("redo")} title={t.redoShortcut}>
                  <span aria-hidden="true">↷</span> {t.redo}
                </button>
              </div>
            </div>
            <ScaledPoster bingo={bingo} checked={checked} locale={locale} mode={mode}
              controls={{ cellTriggerRefs, draggedCellIndex, dropTargetIndex, handleCellClick,
                startCellDrag, allowCellDrop, dropCell, endCellDrag, toggleCell }} />
          </section>
        </div>
      </main>

      <footer className="site-footer" inert={isDirectMode}>
        <p>
          {t.footerCredit}{" "}
          <a
            href="https://twitter.com/mariounivrsalis"
            target="_blank"
            rel="noreferrer"
          >
            @MarioUnivRsalis
          </a>
        </p>
        <p>{footerFun}</p>
      </footer>

      {isDirectMode && (
        <div
          ref={directDialogRef}
          className="direct-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="direct-mode-title"
          aria-describedby="direct-progress-label"
        >
          <header className="direct-toolbar">
            <div className="direct-identity">
              <strong id="direct-mode-title">
                {bingo.title || t.untitledGrid}
              </strong>
            </div>

            <div className="direct-progress">
              <div id="direct-progress-label" aria-live="polite">
                <strong>{t.announcementsChecked(checked.size, filledCellCount)}</strong>
              </div>
              <span className="direct-progress-track" aria-hidden="true">
                <i style={{ width: `${directProgress}%` }} />
              </span>
            </div>

            <div className="direct-actions">
              {checked.size > 0 && (
                <button type="button" onClick={() => setChecked(new Set())}>
                  {t.reset}
                </button>
              )}
              <button
                className="direct-share"
                type="button"
                onClick={share}
                disabled={isSharing}
                aria-busy={isSharing}
              >
                <span aria-hidden="true">↗</span> {isSharing ? t.sharingImage : t.share}
              </button>
              <button
                className="direct-png"
                type="button"
                onClick={download}
                disabled={isSharing}
                title={t.exportPng}
              >
                <span aria-hidden="true">↓</span> PNG
              </button>
              <button
                ref={directExitRef}
                className="direct-exit"
                type="button"
                onClick={exitDirectMode}
              >
                <span aria-hidden="true">×</span> {t.exitDirectMode}
              </button>
            </div>
          </header>

          <div className="direct-stage">
            <div className="direct-poster-wrap">
              <ScaledPoster
                bingo={bingo}
                checked={checked}
                locale={locale}
                mode="play"
                controls={{
                  cellTriggerRefs,
                  draggedCellIndex,
                  dropTargetIndex,
                  handleCellClick,
                  startCellDrag,
                  allowCellDrop,
                  dropCell,
                  endCellDrag,
                  toggleCell,
                }}
              />
            </div>
          </div>

        </div>
      )}

      {isLibraryOpen && (
        <div
          className="library-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsLibraryOpen(false);
          }}
        >
          <section
            ref={libraryDialogRef}
            className="library-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-title"
          >
            <header className="library-header">
              <div>
                <div>
                  <h2 id="library-title">{t.myGrids}</h2>
                  <p>{t.libraryDescription}</p>
                </div>
              </div>
              <button
                ref={libraryCloseRef}
                className="library-close"
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                aria-label={t.closeLibrary}
              >
                ×
              </button>
            </header>

            <div className="library-toolbar">
              <span>{t.gridCount(grids.length)}</span>
              <button
                className="button button-primary"
                type="button"
                onClick={startNew}
              >
                <span aria-hidden="true">＋</span> {t.newGrid}
              </button>
            </div>

            <div className="library-transfer">
              <div className="transfer-actions">
                <button type="button" onClick={() => importInputRef.current?.click()} disabled={isImporting} aria-busy={isImporting}>
                  {isImporting ? t.importingFile : t.importFile}
                </button>
                <button type="button" onClick={() => exportFile(grids, "bingo-direct-library")}>
                  {t.exportLibrary}
                </button>
              </div>
              <input ref={importInputRef} type="file" accept=".json,application/json" hidden aria-label={t.importFile}
                tabIndex={-1} disabled={isImporting} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importFile(file);
                }} />
            </div>
            <ul className="library-list">
              {[...grids]
                .sort((left, right) =>
                  right.updatedAt.localeCompare(left.updatedAt),
                )
                .map((storedGrid) => {
                  const isActive = storedGrid.id === activeId;
                  const filledCells =
                    storedGrid.bingo.cells.filter(isCellFilled).length;
                  return (
                    <li
                      className={`library-item ${isActive ? "active" : ""}`}
                      style={getThemeStyle(storedGrid.bingo.theme)}
                      key={storedGrid.id}
                    >
                      <button
                        className="library-open"
                        type="button"
                        onClick={() => openGrid(storedGrid)}
                        aria-label={t.openGrid(
                          storedGrid.bingo.title || t.untitledGrid,
                        )}
                      >
                        {storedGrid.preview ? (
                          <span className="library-preview" aria-hidden="true">
                            <img
                              className="library-preview-image"
                              src={storedGrid.preview}
                              alt=""
                            />
                          </span>
                        ) : (
                          <span
                            className="library-mini-grid"
                            style={{
                              gridTemplateColumns: `repeat(${gridDimensions(storedGrid.bingo).columns}, 1fr)`,
                              gridTemplateRows: `repeat(${gridDimensions(storedGrid.bingo).rows}, 1fr)`,
                            }}
                            aria-hidden="true"
                          >
                            {storedGrid.bingo.cells.map((cell, index) => (
                              <i key={index}>
                                {cell.image ? (
                                  <img src={cell.image} alt="" />
                                ) : cell.text ? (
                                  <span />
                                ) : null}
                              </i>
                            ))}
                          </span>
                        )}
                        <span className="library-copy">
                          <span className="library-title-row">
                            <strong>
                              {storedGrid.bingo.title || t.untitledGrid}
                            </strong>
                            {isActive && <em>{t.currentGrid}</em>}
                          </span>
                          <small>
                            {storedGrid.bingo.subtitle || t.noSubtitle}
                          </small>
                          <span className="library-meta">
                            {t.filledCells(
                              filledCells,
                              storedGrid.bingo.cells.length,
                            )}{" "}
                            ·{" "}
                            {t.updatedAt(formatUpdatedAt(storedGrid.updatedAt))}
                          </span>
                        </span>
                      </button>
                      <div className="library-actions">
                        <button
                          type="button"
                          onClick={() => duplicateGrid(storedGrid)}
                        >
                          {t.duplicate}
                        </button>
                        {grids.length > 1 && (
                          <button
                            className="danger"
                            type="button"
                            onClick={() =>
                              setConfirmation({
                                kind: "delete",
                                grid: storedGrid,
                              })
                            }
                          >
                            {t.deleteGrid}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>

            <p className="library-privacy">{t.libraryPrivacy}</p>
          </section>
        </div>
      )}

      {confirmation && (
        <div
          className="confirmation-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmation(null);
          }}
        >
          <section
            ref={confirmationDialogRef}
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-message"
          >
            <span className="confirmation-icon" aria-hidden="true">
              !
            </span>
            <h2 id="confirmation-title">{confirmationTitle}</h2>
            <p id="confirmation-message">{confirmationMessage}</p>
            <div className="confirmation-actions">
              <button
                ref={confirmationCancelRef}
                className="button button-ghost"
                type="button"
                onClick={() => setConfirmation(null)}
              >
                {t.cancel}
              </button>
              <button
                className="button button-danger"
                type="button"
                onClick={confirmAction}
              >
                {confirmationTitle}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingCellIndex !== null && (
        <div
          className="cell-editor-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isImageImporting) {
              setEditingCellIndex(null);
            }
          }}
        >
          <section
            ref={cellEditorDialogRef}
            className="cell-editor-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cell-editor-title"
          >
            <header>
              <h2 id="cell-editor-title">
                {t.cellEditorTitle(editingCellIndex + 1)}
              </h2>
              <button
                ref={cellEditorCloseRef}
                className="library-close"
                type="button"
                onClick={() => setEditingCellIndex(null)}
                disabled={isImageImporting}
                aria-label={t.closeCellEditor}
              >
                ×
              </button>
            </header>
            <label className="cell-editor-text">
              <span className="cell-editor-text-label">
                {t.predictionCell(editingCellIndex + 1)} <em>{t.optional}</em>
              </span>
              <textarea
                value={bingo.cells[editingCellIndex].text}
                maxLength={70}
                aria-describedby="cell-editor-character-count"
                onChange={(event) =>
                  updateCell(editingCellIndex, { text: event.target.value })
                }
                placeholder={t.predictionPlaceholder}
              />
              <span
                className="cell-editor-character-count"
                id="cell-editor-character-count"
              >
                {bingo.cells[editingCellIndex].text.length}/70
              </span>
            </label>
            {bingo.cells[editingCellIndex].image && (
              <div className="cell-editor-preview">
                <img src={bingo.cells[editingCellIndex].image} alt="" />
              </div>
            )}
            <p className="cell-editor-image-label">
              {t.imageLabel} <em>{t.optional}</em>
            </p>
            <label
              className="image-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void importCellImage(prepareCellImage(file));
              }}
            >
              <input
                type="file"
                accept="image/*"
                disabled={isImageImporting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCellImage(prepareCellImage(file));
                  event.target.value = "";
                }}
              />
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="8.5" cy="9" r="1.5" />
                <path d="m4 18 5.5-5 3.5 3 2.5-2.5 4.5 4.5" />
              </svg>
              <strong>
                {isImageImporting ? t.imageProcessing : t.imageDropTitle}
              </strong>
              <span>{t.imageDropHint}</span>
            </label>
            <div className="cell-editor-actions">
              <div>
                <button type="button" className="text-button" disabled={!canUndo || isImageImporting} onClick={() => moveHistory("undo")} title={t.undoShortcut}>{t.undo}</button>
                <button type="button" className="text-button" disabled={!canRedo || isImageImporting} onClick={() => moveHistory("redo")} title={t.redoShortcut}>{t.redo}</button>
                {bingo.cells[editingCellIndex].image && (
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => updateCell(editingCellIndex, { image: "" })}
                    disabled={isImageImporting}
                  >
                    {t.removeImage}
                  </button>
                )}
                <button
                  className="text-button danger"
                  type="button"
                  onClick={clearEditingCell}
                  disabled={isImageImporting}
                >
                  {t.clearCell}
                </button>
              </div>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setEditingCellIndex(null)}
                disabled={isImageImporting}
              >
                {t.done}
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

export default App;
