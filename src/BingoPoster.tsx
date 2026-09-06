import { fitPosterText } from "./poster-layout";
import { useLayoutEffect, useRef, useState, type DragEvent, type RefObject } from "react";
import { gridDimensions, winningLines } from "./data";
import { messages } from "./i18n";
import { getThemeStyle } from "./themes";
import type { BingoCell, BingoData, Locale } from "./types";

const isCellFilled = (cell: BingoCell) => Boolean(cell.text.trim() || cell.image);
export type PosterControls = {
  cellTriggerRefs: RefObject<Map<number, HTMLButtonElement>>;
  draggedCellIndex: number | null;
  dropTargetIndex: number | null;
  handleCellClick: (index: number) => void;
  startCellDrag: (event: DragEvent<HTMLButtonElement>, index: number) => void;
  allowCellDrop: (event: DragEvent<HTMLButtonElement>, index: number) => void;
  dropCell: (event: DragEvent<HTMLButtonElement>, index: number) => void;
  endCellDrag: () => void;
  toggleCell: (index: number) => void;
};

type Props = { bingo: BingoData; locale: Locale; checked: Set<number>; mode?: "edit" | "play"; controls?: PosterControls };

export function BingoPoster({ bingo, locale, checked, mode = "play", controls }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => { if (!cancelled && posterRef.current) fitPosterText(posterRef.current); };
    fit();
    void document.fonts.ready.then(fit);
    return () => { cancelled = true; };
  }, [bingo]);
  const t = messages[locale];
  const { rows, columns } = gridDimensions(bingo);
  const filledCellCount = bingo.cells.filter(isCellFilled).length;
  const checkedVisibleCellCount = [...checked].filter((index) => bingo.cells[index] && isCellFilled(bingo.cells[index])).length;
  const wins = winningLines(checked, rows, columns);
  const winningCells = new Set(wins.flat());
  return (
    <div ref={posterRef} className="bingo-poster canonical-poster" style={getThemeStyle(bingo.theme)}>
      <div className="poster-header">
        <div>
          <h2>{bingo.title || "Bingo Direct"}</h2>
          <p>{bingo.subtitle}</p>
        </div>
        {bingo.author && (
          <span className="author-chip">
            {t.by} {bingo.author}
          </span>
        )}
      </div>

      <div
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
        className={`bingo-grid ${mode === "edit" ? "is-editing" : "is-playing"}`}
      >
        {bingo.cells.map((cell, index) =>
          mode === "edit" && controls ? (
            <button
              ref={(element) => {
                if (element)
                  controls.cellTriggerRefs.current.set(index, element);
                else controls.cellTriggerRefs.current.delete(index);
              }}
              className={`bingo-cell play-cell edit-preview ${cell.image ? "has-image" : ""} ${cell.image && !cell.text ? "image-only" : ""} ${!isCellFilled(cell) ? "is-empty" : ""} ${controls.draggedCellIndex === index ? "is-dragging" : ""} ${controls.dropTargetIndex === index && controls.draggedCellIndex !== index ? "is-drop-target" : ""}`}
              key={index}
              type="button"
              draggable={isCellFilled(cell)}
              onClick={() => controls.handleCellClick(index)}
              onDragStart={(event) => controls.startCellDrag(event, index)}
              onDragEnter={(event) => controls.allowCellDrop(event, index)}
              onDragOver={(event) => controls.allowCellDrop(event, index)}
              onDrop={(event) => controls.dropCell(event, index)}
              onDragEnd={controls.endCellDrag}
              aria-label={
                isCellFilled(cell)
                  ? t.editPrediction(index + 1)
                  : t.addPrediction(index + 1)
              }
              aria-description={
                isCellFilled(cell) ? t.dragToReorder : undefined
              }
              title={isCellFilled(cell) ? t.dragToReorder : undefined}
            >
              {isCellFilled(cell) ? (
                <>
                  {cell.image && (
                    <img
                      className="cell-image"
                      src={cell.image}
                      alt=""
                    />
                  )}
                  {cell.text && (
                    <span className="cell-text">{cell.text}</span>
                  )}
                  <span className="checkmark" aria-hidden="true">
                    ✓
                  </span>
                </>
              ) : (
                <span className="edit-empty-plus" aria-hidden="true">
                  +
                </span>
              )}
            </button>
          ) : !isCellFilled(cell) ? (
            <div
              className="bingo-cell empty-play-cell"
              key={index}
              aria-hidden="true"
            />
          ) : (
            <button
              tabIndex={controls ? 0 : -1}
              className={`bingo-cell play-cell ${cell.image ? "has-image" : ""} ${cell.image && !cell.text ? "image-only" : ""} ${checked.has(index) ? "checked" : ""} ${winningCells.has(index) ? "winner" : ""}`}
              key={index}
              type="button"
              onClick={() => controls?.toggleCell(index)}
              aria-pressed={checked.has(index)}
              aria-label={`${cell.text || t.imageCell(index + 1)}${checked.has(index) ? t.checkedSuffix : ""}`}
            >
              {cell.image && (
                <img className="cell-image" src={cell.image} alt="" />
              )}
              {cell.text && (
                <span className="cell-text">{cell.text}</span>
              )}
              <span className="checkmark" aria-hidden="true">
                ✓
              </span>
            </button>
          ),
        )}
      </div>

      <div className="poster-footer">
        <span>
          {mode === "edit"
            ? t.cellsFilled(filledCellCount, bingo.cells.length)
            : t.announcementsChecked(
                checkedVisibleCellCount,
                filledCellCount,
              )}
        </span>
        {wins.length > 0 && (
          <span className="bingo-alert visible">
            {`BINGO × ${wins.length} !`}
          </span>
        )}
        <span>Bingo Direct</span>
      </div>
    </div>
  );
}

// Scaling affects only the preview, never its internal text layout.
export function ScaledPoster(props: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const resize = () => setScale(element.clientWidth / 800);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={frame} className="poster-frame" style={{ height: 926 * scale }}>
    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 800 }}>
      <BingoPoster {...props} />
    </div>
  </div>;
}
