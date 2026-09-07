import type { StoredBingo } from "./storage";

export type GridSnapshot = Pick<StoredBingo, "bingo">;
export type GridHistory = {
  past: GridSnapshot[];
  future: GridSnapshot[];
  group?: string;
  time: number;
};
export const emptyHistory = (): GridHistory => ({ past: [], future: [], time: 0 });
export const snapshot = ({ bingo }: StoredBingo): GridSnapshot => ({ bingo });

export function recordEdit(history: GridHistory, before: StoredBingo, group: string | undefined, time: number): GridHistory {
  const merge = group !== undefined && group === history.group && time - history.time < 800;
  return {
    past: merge ? history.past : [...history.past, snapshot(before)].slice(-50),
    future: [], group, time,
  };
}

export function travelHistory(history: GridHistory, current: StoredBingo, direction: "undo" | "redo") {
  const source = direction === "undo" ? history.past : history.future;
  const target = source[source.length - 1];
  if (!target) return null;
  const checked = (current.checked ?? []).filter((index) => {
    const cell = target.bingo.cells[index];
    return cell && Boolean(cell.text.trim() || cell.image);
  });
  return {
    grid: { ...current, ...target, checked, preview: "", updatedAt: new Date().toISOString() },
    history: {
      past: direction === "undo" ? history.past.slice(0, -1) : [...history.past, snapshot(current)],
      future: direction === "redo" ? history.future.slice(0, -1) : [...history.future, snapshot(current)],
      time: 0,
    } satisfies GridHistory,
  };
}
