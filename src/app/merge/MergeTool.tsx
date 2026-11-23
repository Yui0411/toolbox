"use client";

import { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import FileDrop from "@/components/FileDrop";
import { downloadBytes, formatBytes } from "@/lib/download";
import { openPdf, renderPageToCanvas } from "@/lib/pdfjs";

type Item = {
  id: string;
  file: File;
  kind: "pdf" | "image";
  bytes: Uint8Array;
  pages: number | null; // null = could not read
  previewUrl?: string; // object URL for image items
  error?: string;
};

const ACCEPT = "application/pdf,.pdf,image/png,image/jpeg";

let nextId = 0;

async function toItem(file: File): Promise<Item> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const id = `f${nextId++}`;
  if (!isPdf) return { id, file, kind: "image", bytes, pages: 1, previewUrl: URL.createObjectURL(file) };
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (doc.isEncrypted) {
      return { id, file, kind: "pdf", bytes, pages: null, error: "Password-protected PDFs aren't supported" };
    }
    return { id, file, kind: "pdf", bytes, pages: doc.getPageCount() };
  } catch {
    return { id, file, kind: "pdf", bytes, pages: null, error: "Couldn't read this PDF" };
  }
}

async function mergeItems(items: Item[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const item of items) {
    if (item.kind === "pdf") {
      const src = await PDFDocument.load(item.bytes);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      const isPng = item.file.type === "image/png" || item.file.name.toLowerCase().endsWith(".png");
      const img = isPng ? await out.embedPng(item.bytes) : await out.embedJpg(item.bytes);
      // Fit the image on an A4 page (portrait or landscape to match the image).
      const landscape = img.width > img.height;
      const [pw, ph] = landscape ? [841.89, 595.28] : [595.28, 841.89];
      const margin = 36;
      const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      const page = out.addPage([pw, ph]);
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  return out.save();
}

function Thumb({ item }: { item: Item }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (item.kind === "image" || item.error) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await openPdf(item.bytes);
        const page = await doc.getPage(1);
        if (!cancelled && canvasRef.current) await renderPageToCanvas(page, canvasRef.current, 56);
        doc.loadingTask.destroy();
      } catch {
        /* thumbnail is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  return (
    <div className="flex h-[72px] w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-200 bg-zinc-100">
      {item.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <canvas ref={canvasRef} />
      )}
    </div>
  );
}

export default function MergeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("merged");
  const [dragId, setDragId] = useState<string | null>(null);

  const add = async (files: File[]) => {
    setError(null);
    const added = await Promise.all(files.map(toItem));
    setItems((prev) => [...prev, ...added]);
  };

  const release = (list: Item[]) => list.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
  const remove = (id: string) => {
    release(items.filter((x) => x.id === id));
    setItems((p) => p.filter((x) => x.id !== id));
  };
  const clear = () => {
    release(items);
    setItems([]);
  };

  const move = (from: number, to: number) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  };

  const valid = items.filter((i) => !i.error);
  const totalPages = valid.reduce((n, i) => n + (i.pages ?? 0), 0);

  const merge = async () => {
    setBusy(true);
    setError(null);
    try {
      const bytes = await mergeItems(valid);
      downloadBytes(bytes, `${filename.trim() || "merged"}.pdf`);
    } catch (e) {
      console.error(e);
      setError("Merging failed. One of the files may be damaged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <FileDrop
        accept={ACCEPT}
        multiple
        compact={items.length > 0}
        label={items.length ? "Add more files" : "Drop PDFs here or click to choose"}
        hint="PDF, PNG and JPG supported"
        onFiles={add}
      />

      {items.length > 0 && (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {items.map((item, i) => (
            <li
              key={item.id}
              draggable
              onDragStart={(e) => {
                setDragId(item.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragId || dragId === item.id) return;
                const from = items.findIndex((x) => x.id === dragId);
                move(from, i);
              }}
              onDragEnd={() => setDragId(null)}
              className={`flex items-center gap-3 px-3 py-2 ${dragId === item.id ? "bg-indigo-50" : ""}`}
            >
              <span className="cursor-grab select-none text-zinc-400" title="Drag to reorder">
                ⠿
              </span>
              <span className="w-5 text-right text-sm tabular-nums text-zinc-400">{i + 1}</span>
              <Thumb item={item} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.file.name}</p>
                <p className={`text-xs ${item.error ? "text-red-600" : "text-zinc-500"}`}>
                  {item.error ??
                    `${item.kind === "image" ? "Image · 1 page" : `${item.pages} page${item.pages === 1 ? "" : "s"}`} · ${formatBytes(item.file.size)}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </IconButton>
                <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  ↓
                </IconButton>
                <IconButton label="Remove" onClick={() => remove(item.id)}>
                  ✕
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600">File name</span>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-44 rounded-md border border-zinc-300 px-2 py-1"
            />
            <span className="text-zinc-500">.pdf</span>
          </label>
          <span className="text-sm text-zinc-500">
            {valid.length} file{valid.length === 1 ? "" : "s"} · {totalPages} page{totalPages === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={clear}
              className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Clear
            </button>
            <button
              onClick={merge}
              disabled={busy || valid.length < 1}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? "Merging…" : "Merge & download"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30 disabled:hover:bg-transparent"
      {...props}
    >
      {children}
    </button>
  );
}
