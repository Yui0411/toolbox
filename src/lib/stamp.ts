/** A PNG image that can be placed on a page (signature, initials, text). */
export type Stamp = {
  id: string;
  dataUrl: string;
  width: number; // px of the source PNG
  height: number;
  label: string;
  /** Text stamps are rendered at TEXT_RENDER_PX per em, so they can be placed at a real font size. */
  kind?: "signature" | "text";
};

export const TEXT_RENDER_PX = 120;

let counter = 0;
export const uid = (p = "s") => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Crops transparent margins off a canvas and returns a PNG stamp. */
export function canvasToStamp(canvas: HTMLCanvasElement, label: string, pad = 8): Stamp | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // empty
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return { id: uid(), dataUrl: out.toDataURL("image/png"), width: w, height: h, label };
}

/** Renders a line of text to a high-resolution transparent PNG stamp. */
export async function textToStamp(
  text: string,
  opts: { fontFamily: string; color: string; weight?: string | number; label: string; kind?: Stamp["kind"] },
): Promise<Stamp | null> {
  const size = TEXT_RENDER_PX;
  const font = `${opts.weight ?? "normal"} ${size}px ${opts.fontFamily}`;
  try {
    await document.fonts.load(font, text);
  } catch {
    /* fall back to whatever is available */
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + size;
  canvas.width = width;
  canvas.height = Math.ceil(size * 1.8);
  ctx.font = font;
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, canvas.height / 2);
  const stamp = canvasToStamp(canvas, opts.label, 6);
  return stamp && { ...stamp, kind: opts.kind ?? "signature" };
}

/** Loads an image file into a stamp, optionally knocking out a white background. */
export async function imageFileToStamp(file: File, removeWhite: boolean): Promise<Stamp | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (removeWhite) {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        // Fully clear near-white, fade the anti-aliased edge.
        if (lum > 235) px[i + 3] = 0;
        else if (lum > 180) px[i + 3] = Math.round(px[i + 3] * ((235 - lum) / 55));
      }
      ctx.putImageData(d, 0, 0);
    }
    return canvasToStamp(canvas, file.name.replace(/\.[^.]+$/, ""), 4);
  } finally {
    URL.revokeObjectURL(url);
  }
}
