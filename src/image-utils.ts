const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 240_000;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Invalid image"));
    image.src = url;
  });

export const prepareCellImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/") || file.size > MAX_SOURCE_SIZE) {
    throw new Error("Invalid image");
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    let maxEdge = 720;
    let quality = 0.82;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/webp", quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
      maxEdge = Math.round(maxEdge * 0.78);
      quality = Math.max(0.58, quality - 0.06);
    }

    throw new Error("Image remains too large");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};
