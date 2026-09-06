import { fitPosterText } from "./poster-layout";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { getFontEmbedCSS, toBlob } from "html-to-image";
import { BingoPoster } from "./BingoPoster";
import type { BingoData, Locale } from "./types";

const imageFileName = (bingo: BingoData) =>
  `${
    (bingo.title || "direct-bingo")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "direct-bingo"
  }.png`;


let fontCSS: Promise<string> | undefined;

const renderPoster = async (bingo: BingoData, checked: Set<number>, locale: Locale, preview = false) => {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  Object.assign(host.style, { position: "fixed", left: "-10000px", top: "0", width: "800px", pointerEvents: "none" });
  document.body.append(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement("div", { ref: (node: HTMLDivElement | null) => { if (node) resolve(); } },
        createElement(BingoPoster, { bingo, checked, locale })));
    });
    await Promise.all([
      document.fonts.load('700 14px "DM Sans"'),
      document.fonts.load('400 46px "Archivo Black"'),
    ]);
    await document.fonts.ready;
    const poster = host.querySelector<HTMLElement>(".canonical-poster")!;
    await Promise.all([...poster.querySelectorAll("img")].map((image) => image.decode()));
    fitPosterText(poster);
    // Embed the same locally hosted fonts used by the visible component.
    fontCSS ??= getFontEmbedCSS(poster, { preferredFontFormat: "woff2" }).catch((error) => {
      fontCSS = undefined;
      throw error;
    });
    const blob = await toBlob(poster, {
      width: 800, height: 926,
      canvasWidth: preview ? 420 : 1400,
      canvasHeight: preview ? 486 : 1620,
      pixelRatio: 1,
      fontEmbedCSS: await fontCSS,
      preferredFontFormat: "woff2",
    });
    if (!blob) throw new Error("Unable to create PNG");
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
};

export const createGridPreviewDataUrl = async (bingo: BingoData, locale: Locale) => {
  try {
    const blob = await renderPoster(bingo, new Set(), locale, true);
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch { return ""; }
};

const createBingoImageFile = async (bingo: BingoData, checked: Set<number>, locale: Locale) =>
  new File([await renderPoster(bingo, checked, locale)], imageFileName(bingo), { type: "image/png" });

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
