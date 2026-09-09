import { fitPosterText } from "./poster-layout";
import { useId, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { gridDimensions } from "./data";
import { messages } from "./i18n";
import { getThemeStyle } from "./themes";
import type { BingoCell, BingoData, ImagePosition, Locale } from "./types";
import { imageOverflow, moveImagePosition } from "./image-position";

const isCellFilled = (cell: BingoCell) => Boolean(cell.text.trim() || cell.image);
const cellImageClassName = (cell: BingoCell) => {
  if (!cell.image) return "";
  if (!cell.text.trim()) return "has-image image-only";
  return cell.imageLayout === "above" ? "has-image image-above" : "has-image";
};
const SITE_URL = "mariouniversalis.fr/bingo-direct";
const POSTER_GRID_SIZE = 736;
const POSTER_GRID_GAP = 9;
const posterCellSize = (bingo: BingoData) => {
  const { rows, columns } = gridDimensions(bingo);
  return Math.min(
    (POSTER_GRID_SIZE - (columns - 1) * POSTER_GRID_GAP) / columns,
    (POSTER_GRID_SIZE - (rows - 1) * POSTER_GRID_GAP) / rows,
  );
};

// Shared by the editor preview, the interactive grid and PNG exports.
function CellContent({ cell }: { cell: BingoCell }) {
  return <>
    {cell.image && (
      <img className="cell-image" src={cell.image} alt="" style={{
        objectFit: cell.imageFit ?? "cover",
        objectPosition: cell.imageFit === "contain" ? "50% 50%" : `${cell.imagePosition?.x ?? 50}% ${cell.imagePosition?.y ?? 50}%`,
      }} />
    )}
    {cell.text.trim() && <span className="cell-text">{cell.text}</span>}
    <span className="checkmark" aria-hidden="true">✓</span>
  </>;
}

type PreviewProps = {
  bingo: BingoData;
  cell: BingoCell;
  locale: Locale;
  disabled?: boolean;
  onPositionChange?: (position: ImagePosition) => void;
};

export function BingoCellPreview({ bingo, cell, locale, disabled = false, onPositionChange }: PreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const cellSize = posterCellSize(bingo);
  const [scale, setScale] = useState(1);
  const [overflow, setOverflow] = useState({ x: 0, y: 0 });
  const [draftPosition, setDraftPosition] = useState<ImagePosition | null>(null);
  const dragRef = useRef<{
    pointerId: number; x: number; y: number;
    start: ImagePosition; current: ImagePosition; overflow: ImagePosition;
  } | null>(null);
  const hintId = useId();
  const t = messages[locale];
  const position = cell.imagePosition ?? { x: 50, y: 50 };
  const canPan = Boolean(onPositionChange && !disabled && cell.image && cell.imageFit !== "contain" && (overflow.x > 0.5 || overflow.y > 0.5));
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const resize = () => setScale(frame.clientWidth / cellSize);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [cellSize]);
  useLayoutEffect(() => {
    let cancelled = false;
    dragRef.current = null;
    setDraftPosition(null);
    const fit = () => {
      if (cancelled || !canvasRef.current) return;
      fitPosterText(canvasRef.current);
      const image = canvasRef.current.querySelector("img");
      setOverflow(image ? imageOverflow(image.naturalWidth, image.naturalHeight, image.offsetWidth, image.offsetHeight) : { x: 0, y: 0 });
    };
    fit();
    void document.fonts.ready.then(fit);
    const image = canvasRef.current?.querySelector("img");
    void image?.decode().then(fit).catch(() => {});
    return () => { cancelled = true; };
  }, [cell, cellSize, disabled]);

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPan || !event.isPrimary || event.button !== 0) return;
    const image = canvasRef.current?.querySelector("img");
    if (!image) return;
    const rect = image.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      start: position, current: position,
      overflow: imageOverflow(image.naturalWidth, image.naturalHeight, rect.width, rect.height),
    };
    setDraftPosition(position);
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.current = moveImagePosition(drag.start, event.clientX - drag.x, event.clientY - drag.y, drag.overflow);
    setDraftPosition(drag.current);
  };
  const endPan = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (commit) drag.current = moveImagePosition(drag.start, event.clientX - drag.x, event.clientY - drag.y, drag.overflow);
    dragRef.current = null;
    setDraftPosition(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // One gesture makes one undoable edit, even after a pause while dragging.
    if (commit && (drag.current.x !== drag.start.x || drag.current.y !== drag.start.y)) onPositionChange?.(drag.current);
  };
  const handlePanKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canPan || event.ctrlKey || event.metaKey || event.altKey || dragRef.current) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (event.key === "Home") {
      event.preventDefault();
      onPositionChange?.({ x: 50, y: 50 });
    } else if (directions[event.key]) {
      event.preventDefault();
      const [x, y] = directions[event.key];
      const step = event.shiftKey ? 10 : 2;
      onPositionChange?.(moveImagePosition(position, x * step * overflow.x / 100, y * step * overflow.y / 100, overflow));
    }
  };
  return <figure className="cell-editor-preview">
    <figcaption>{t.cellPreview}</figcaption>
    <div ref={frameRef} className={`cell-preview-frame ${canPan ? "can-pan" : ""}`}
      role={canPan ? "group" : undefined} tabIndex={canPan ? 0 : undefined}
      aria-label={canPan ? t.imagePosition : undefined}
      aria-describedby={canPan ? hintId : undefined}
      aria-description={canPan ? t.imagePositionKeyboard : undefined}
      onPointerDown={startPan} onPointerMove={movePan} onPointerUp={(event) => endPan(event, true)}
      onPointerCancel={(event) => endPan(event, false)} onLostPointerCapture={(event) => endPan(event, false)}
      onKeyDown={handlePanKey} onDragStart={(event) => event.preventDefault()}>
      <div ref={canvasRef} className="canonical-poster cell-preview-canvas" aria-hidden="true"
        style={{ width: cellSize, height: cellSize, padding: 0, transform: `scale(${scale})` }}>
        <div className={`bingo-cell play-cell edit-preview ${cellImageClassName(cell)} ${!isCellFilled(cell) ? "is-empty" : ""}`}>
          {isCellFilled(cell) ? <CellContent cell={draftPosition ? { ...cell, imagePosition: draftPosition } : cell} /> : <span className="edit-empty-plus">+</span>}
        </div>
      </div>
    </div>
    {canPan && <div className="cell-pan-controls">
      <p id={hintId}>{t.imageDragHint}</p>
    </div>}
  </figure>;
}

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
  const cellSize = posterCellSize(bingo);
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
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
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
              className={`bingo-cell play-cell edit-preview ${cellImageClassName(cell)} ${!isCellFilled(cell) ? "is-empty" : ""} ${controls.draggedCellIndex === index ? "is-dragging" : ""} ${controls.dropTargetIndex === index && controls.draggedCellIndex !== index ? "is-drop-target" : ""}`}
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
                <CellContent cell={cell} />
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
              className={`bingo-cell play-cell ${cellImageClassName(cell)} ${checked.has(index) ? "checked" : ""}`}
              key={index}
              type="button"
              onClick={() => controls?.toggleCell(index)}
              aria-pressed={checked.has(index)}
              aria-label={`${cell.text || t.imageCell(index + 1)}${checked.has(index) ? t.checkedSuffix : ""}`}
            >
              <CellContent cell={cell} />
            </button>
          ),
        )}
      </div>

      <div className="poster-footer">
        <span className="poster-brand">
          <strong>Bingo Direct</strong>
          <span>{SITE_URL}</span>
        </span>
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
    <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", width: 800 }}>
      <BingoPoster {...props} />
    </div>
  </div>;
}
