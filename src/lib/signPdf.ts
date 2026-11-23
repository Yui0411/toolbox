import { PDFDocument, degrees } from "pdf-lib";

/**
 * A stamp placed on a page. Position and size are fractions (0–1) of the page
 * *as displayed* (i.e. after the page's /Rotate is applied), measured from the top-left.
 */
export type Placement = {
  id: string;
  stampId: string;
  page: number; // 0-based
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Maps a point in displayed page space (points, origin top-left, y down) to PDF user
 * space for a page with the given crop box and clockwise display rotation.
 */
function toPdfSpace(
  u: number,
  v: number,
  box: { x: number; y: number; width: number; height: number },
  rotation: number,
) {
  const { x: bx, y: by, width: W, height: H } = box;
  switch (rotation) {
    case 90:
      return { x: bx + v, y: by + u };
    case 180:
      return { x: bx + W - u, y: by + v };
    case 270:
      return { x: bx + W - v, y: by + H - u };
    default:
      return { x: bx + u, y: by + H - v };
  }
}

export async function applySignatures(
  pdfBytes: Uint8Array,
  placements: Placement[],
  stamps: Map<string, { dataUrl: string }>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const embedded = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();

  for (const p of placements) {
    const stamp = stamps.get(p.stampId);
    if (!stamp) continue;
    let img = embedded.get(p.stampId);
    if (!img) {
      img = await doc.embedPng(stamp.dataUrl);
      embedded.set(p.stampId, img);
    }

    const page = doc.getPage(p.page);
    const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
    const box = page.getCropBox();
    const sideways = rotation === 90 || rotation === 270;
    const dispW = sideways ? box.height : box.width;
    const dispH = sideways ? box.width : box.height;

    const w = p.w * dispW;
    const h = p.h * dispH;
    // pdf-lib anchors images at their bottom-left corner and rotates counter-clockwise
    // around it, so anchor at the displayed bottom-left and counter the page rotation.
    const anchor = toPdfSpace(p.x * dispW, (p.y + p.h) * dispH, box, rotation);
    page.drawImage(img, { x: anchor.x, y: anchor.y, width: w, height: h, rotate: degrees(rotation) });
  }

  return doc.save();
}
