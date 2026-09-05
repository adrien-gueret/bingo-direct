import type { BingoData, Locale } from "./types";
import { themeDefinitions, type ThemeDefinition } from "./themes";

type Palette = ThemeDefinition;

const drawPosterBackground = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
) => {
  context.save();

  const baseGradient = context.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, palette.primary);
  baseGradient.addColorStop(1, palette.dark);
  context.fillStyle = baseGradient;
  context.fillRect(0, 0, width, height);

  const glowX = width * 0.83;
  const glowY = height * 0.75;
  const glowRadius = Math.hypot(
    Math.max(glowX, width - glowX),
    Math.max(glowY, height - glowY),
  );
  const glow = context.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    glowRadius,
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  glow.addColorStop(0.32, "rgba(255, 255, 255, 0)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const patternScale = width / 800;
  const dotSpacing = 28 * patternScale;
  const dotRadius = 2 * patternScale;
  const dotOffsetX = dotSpacing * 0.14;
  const dotOffsetY = dotSpacing * 0.12;
  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  for (let x = dotOffsetX; x < width + dotSpacing; x += dotSpacing) {
    for (let y = dotOffsetY; y < height + dotSpacing; y += dotSpacing) {
      context.beginPath();
      context.arc(x, y, dotRadius, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.06)";
  context.lineWidth = 40 * patternScale;
  context.beginPath();
  context.arc(
    width - 20 * patternScale,
    -10 * patternScale,
    170 * patternScale,
    0,
    Math.PI * 2,
  );
  context.stroke();

  const squareSize = 230 * patternScale;
  context.save();
  context.translate(-35 * patternScale, height - 35 * patternScale);
  context.rotate((38 * Math.PI) / 180);
  context.strokeStyle = "rgba(255, 255, 255, 0.10)";
  context.lineWidth = 2 * patternScale;
  context.strokeRect(-squareSize / 2, -squareSize / 2, squareSize, squareSize);
  context.restore();

  context.restore();
};

const roundRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

const linesForText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
) => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const cropped = lines.slice(0, maxLines);
    let last = cropped[maxLines - 1];
    while (
      context.measureText(`${last}…`).width > maxWidth &&
      last.length > 1
    ) {
      last = last.slice(0, -1);
    }
    cropped[maxLines - 1] = `${last}…`;
    return cropped;
  }
  return lines;
};

const imageFileName = (bingo: BingoData) =>
  `${
    (bingo.title || "direct-bingo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "direct-bingo"
  }.png`;

const loadStoredImage = (source: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

const drawImageCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
};

export const createGridPreviewDataUrl = async (bingo: BingoData) => {
  try {
    const canvas = document.createElement("canvas");
    const size = 420;
    const padding = 16;
    const gap = 6;
    const cellSize = (size - padding * 2 - gap * 4) / 5;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) return "";

    const palette = themeDefinitions[bingo.theme];
    const background = context.createLinearGradient(0, 0, size, size);
    background.addColorStop(0, palette.primary);
    background.addColorStop(1, palette.dark);
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);

    const cellImages = await Promise.all(
      bingo.cells.map((cell) => loadStoredImage(cell.image)),
    );

    bingo.cells.forEach((cell, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = padding + column * (cellSize + gap);
      const y = padding + row * (cellSize + gap);
      const hasText = Boolean(cell.text.trim());

      context.fillStyle = "#ffffff";
      roundRect(context, x, y, cellSize, cellSize, 10);
      context.fill();

      if (cellImages[index]) {
        const image = cellImages[index] as HTMLImageElement;
        const imagePadding = 3;
        const imageSize = cellSize - imagePadding * 2;
        const imageX = x + imagePadding;
        const imageY = y + imagePadding;
        roundRect(context, imageX, imageY, imageSize, imageSize, 8);
        context.save();
        context.clip();
        drawImageCover(context, image, imageX, imageY, imageSize, imageSize);
        context.restore();
      }

      if (hasText && !cellImages[index]) {
        context.fillStyle = palette.dark;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 11px Arial, sans-serif";
        const safeText = cell.text.trim();
        const text =
          safeText.length > 18 ? `${safeText.slice(0, 17)}…` : safeText;
        context.fillText(text, x + cellSize / 2, y + cellSize / 2);
      }

      context.strokeStyle = "rgba(0,0,0,0.08)";
      context.lineWidth = 1;
      roundRect(context, x, y, cellSize, cellSize, 10);
      context.stroke();
    });

    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
};

const createBingoImageFile = async (
  bingo: BingoData,
  checked: Set<number>,
  locale: Locale,
) => {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  const size = 1400;
  const padding = 80;
  const headerHeight = 250;
  const gap = 16;
  const boardSize = size - padding * 2;
  const cellSize = (boardSize - gap * 4) / 5;
  const palette = themeDefinitions[bingo.theme];
  canvas.width = size;
  canvas.height = size + headerHeight - 30;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");

  drawPosterBackground(context, canvas.width, canvas.height, palette);

  let chipX = size - padding;

  if (bingo.author) {
    const chipText = `${locale === "fr" ? "par" : "by"} ${bingo.author}`;
    context.font = "700 26px Arial, sans-serif";
    const paddingX = 22;
    const chipHeight = 52;
    const textWidth = context.measureText(chipText).width;
    const chipWidth = textWidth + paddingX * 2;
    chipX = size - padding - chipWidth;
    const chipY = 44;

    context.save();
    context.fillStyle = "rgba(0, 0, 0, 0.08)";
    context.strokeStyle = "rgba(255, 255, 255, 0.22)";
    context.lineWidth = 2;
    roundRect(context, chipX, chipY, chipWidth, chipHeight, chipHeight / 2);
    context.fill();
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      chipText,
      chipX + chipWidth / 2,
      chipY + chipHeight / 2 + 1,
    );
    context.restore();
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
  }

  context.fillStyle = "#ffffff";
  context.font = '900 82px "Archivo Black", Arial, sans-serif';
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  const titleMaxWidth = Math.max(
    220,
    bingo.author ? chipX - padding - 32 : boardSize,
  );
  const titleLines = linesForText(
    context,
    bingo.title || "Bingo Direct",
    titleMaxWidth,
    2,
  );
  const titleBaseline = 92;
  const titleLineHeight = 78;
  titleLines.forEach((line, index) => {
    context.fillText(line, padding, titleBaseline + index * titleLineHeight);
  });

  context.font = "500 30px Arial, sans-serif";
  context.globalAlpha = 0.84;
  context.fillText(
    bingo.subtitle,
    padding,
    titleBaseline + (titleLines.length - 1) * titleLineHeight + 47,
  );
  context.globalAlpha = 1;

  const cellImages = await Promise.all(
    bingo.cells.map((cell) => loadStoredImage(cell.image)),
  );

  bingo.cells.forEach((cell, index) => {
    if (!cell.text.trim() && !cell.image) return;
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = padding + column * (cellSize + gap);
    const y = headerHeight + row * (cellSize + gap);
    const hasText = Boolean(cell.text.trim());
    const cellRadius = cellSize * 0.05;
    const cellBorder = cellSize * 0.012;
    const contentInset = cellSize * 0.055;
    const contentWidth = cellSize - contentInset * 2;
    const contentHeight = cellSize - contentInset * 2;

    context.fillStyle = checked.has(index) ? palette.accent : "#ffffff";
    roundRect(context, x, y, cellSize, cellSize, cellRadius);
    context.fill();

    const image = cellImages[index];
    if (image) {
      const imageHeight = hasText
        ? contentHeight * 0.54
        : cellSize - cellBorder * 2;
      const imageX = hasText ? x + contentInset : x + cellBorder;
      const imageY = hasText ? y + contentInset : y + cellBorder;
      const imageWidth = hasText ? contentWidth : cellSize - cellBorder * 2;
      context.save();
      roundRect(
        context,
        imageX,
        imageY,
        imageWidth,
        imageHeight,
        hasText ? cellSize * 0.03 : cellRadius - cellBorder,
      );
      context.clip();
      context.globalAlpha = checked.has(index) ? 0.78 : 1;
      drawImageCover(context, image, imageX, imageY, imageWidth, imageHeight);
      context.globalAlpha = 1;
      context.restore();
    }

    if (hasText) {
      context.font = `900 ${cellSize * 0.105}px Arial, sans-serif`;
      context.fillStyle = palette.dark;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const lines = linesForText(context, cell.text, contentWidth, 3);
      const imageHeight = image ? contentHeight * 0.54 : 0;
      const textTop =
        y + contentInset + imageHeight + (image ? cellSize * 0.035 : 0);
      const textHeight =
        contentHeight - imageHeight - (image ? cellSize * 0.035 : 0);
      const lineHeight = cellSize * 0.14;
      const textCenter = textTop + textHeight / 2;
      const startY = textCenter - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, lineIndex) => {
        context.fillText(
          line,
          x + cellSize / 2,
          startY + lineIndex * lineHeight,
        );
      });
    }

    context.strokeStyle = checked.has(index)
      ? "rgba(255, 255, 255, 0.92)"
      : "rgba(255, 255, 255, 0.55)";
    context.lineWidth = checked.has(index) ? cellSize * 0.03 : cellSize * 0.012;
    roundRect(context, x, y, cellSize, cellSize, cellRadius);
    context.stroke();

    if (checked.has(index)) {
      context.fillStyle = palette.primary;
      context.beginPath();
      context.arc(x + cellSize - 34, y + 34, 25, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ffffff";
      context.lineWidth = 6;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(x + cellSize - 45, y + 34);
      context.lineTo(x + cellSize - 36, y + 43);
      context.lineTo(x + cellSize - 22, y + 25);
      context.stroke();
    }
  });

  context.fillStyle = "#ffffff";
  context.globalAlpha = 0.72;
  context.font = "500 22px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(
    locale === "fr"
      ? "Créé avec Bingo Direct · https://www.mariouniversalis.fr/bingo-direct/"
      : "Created with Bingo Direct · https://www.mariouniversalis.fr/bingo-direct/",
    size / 2,
    canvas.height - 34,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Unable to create the PNG image"));
    }, "image/png");
  });

  return new File([blob], imageFileName(bingo), { type: "image/png" });
};

const downloadImageFile = (file: File) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(file);
  link.download = file.name;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const exportBingoImage = async (
  bingo: BingoData,
  checked: Set<number>,
  locale: Locale,
) => {
  downloadImageFile(await createBingoImageFile(bingo, checked, locale));
};

export const shareBingoImage = async (
  bingo: BingoData,
  checked: Set<number>,
  locale: Locale,
): Promise<"shared" | "downloaded"> => {
  const file = await createBingoImageFile(bingo, checked, locale);
  const shareData: ShareData = {
    title: bingo.title || "Bingo Direct",
    text: bingo.subtitle,
    files: [file],
  };

  let canShareFile = false;
  try {
    canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare(shareData);
  } catch {
    // Some browsers expose the API but reject file capability checks.
  }

  if (canShareFile) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  downloadImageFile(file);
  return "downloaded";
};
