import { useState, type SetStateAction } from "react";
import { emptyHistory, recordEdit, travelHistory, type GridHistory } from "./grid-history";
import type { StoredBingo } from "./storage";

export function useGridLibrary(initialGrid: StoredBingo) {
  const [state, setState] = useState({ grids: [initialGrid], histories: {} as Record<string, GridHistory> });
  const setGrids = (value: SetStateAction<StoredBingo[]>) => setState((current) => {
    const grids = typeof value === "function" ? value(current.grids) : value;
    const histories = Object.fromEntries(Object.entries(current.histories).filter(([id]) => grids.some((grid) => grid.id === id)));
    return { grids, histories };
  });
  const updateGrid = (id: string, update: (grid: StoredBingo) => StoredBingo, group?: string) => {
    const time = Date.now();
    setState((current) => {
      const before = current.grids.find((grid) => grid.id === id);
      if (!before) return current;
      const next = update(before);
      const checked = (next.checked ?? []).filter((index) => {
        const cell = next.bingo.cells[index];
        return cell && Boolean(cell.text.trim() || cell.image);
      });
      const bingoChanged = JSON.stringify(before.bingo) !== JSON.stringify(next.bingo);
      const checkedChanged = JSON.stringify(before.checked ?? []) !== JSON.stringify(checked);
      if (!bingoChanged && !checkedChanged) return current;
      const after = { ...next, checked, preview: bingoChanged ? "" : before.preview, updatedAt: new Date(time).toISOString() };
      return {
        grids: current.grids.map((grid) => grid.id === id ? after : grid),
        histories: bingoChanged
          ? { ...current.histories, [id]: recordEdit(current.histories[id] ?? emptyHistory(), before, group, time) }
          : current.histories,
      };
    });
  };
  const travel = (id: string, direction: "undo" | "redo") => setState((current) => {
    const grid = current.grids.find((item) => item.id === id);
    if (!grid) return current;
    const result = travelHistory(current.histories[id] ?? emptyHistory(), grid, direction);
    if (!result) return current;
    return {
      grids: current.grids.map((item) => item.id === id ? result.grid : item),
      histories: { ...current.histories, [id]: result.history },
    };
  });
  return { ...state, setGrids, updateGrid, travel };
}
