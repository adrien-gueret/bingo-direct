import type { ImagePosition } from "./types";

// Dimensions must all use the same coordinate system (including preview scaling).
export const imageOverflow = (width: number, height: number, frameWidth: number, frameHeight: number) => {
  if (width <= 0 || height <= 0 || frameWidth <= 0 || frameHeight <= 0) return { x: 0, y: 0 };
  const scale = Math.max(frameWidth / width, frameHeight / height);
  return { x: Math.max(0, width * scale - frameWidth), y: Math.max(0, height * scale - frameHeight) };
};

export const moveImagePosition = (position: ImagePosition, dx: number, dy: number, overflow: ImagePosition): ImagePosition => {
  const shift = (value: number, delta: number, extra: number) =>
    extra > 0.5 ? Math.max(0, Math.min(100, value - delta * 100 / extra)) : value;
  return { x: shift(position.x, dx, overflow.x), y: shift(position.y, dy, overflow.y) };
};
