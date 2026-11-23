"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import FileDrop from "@/components/FileDrop";
import { baseName, downloadBytes } from "@/lib/download";
import { openPdf, renderPageToCanvas } from "@/lib/pdfjs";
import { applySignatures, type Placement } from "@/lib/signPdf";
import { TEXT_RENDER_PX, textToStamp, uid, type Stamp } from "@/lib/stamp";
import SignatureMaker from "./SignatureMaker";

const STORAGE_KEY = "toolbox.signatures.v1";
const PAGE_WIDTH = 760; // CSS px the pages are rendered at (max)

type PageSize = { w: number; h: number }; // displayed size in PDF points

function loadSaved(): Stamp[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function SignTool() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Saved signatures persist in this browser only (component is client-only, see SignToolLoader).
  const [stamps, setStamps] = useState<Stamp[]>(loadSaved);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(stamps.map((s) => s.id)));
  const [armed, setArmed] = useState<string | null>(null); // stamp waiting to be placed
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showMaker, setShowMaker] = useState(false);
  const [busy, setBusy] = useState(false);

  const persist = (all: Stamp[], ids: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((s) => ids.has(s.id))));
    } catch {
      /* storage full or disabled */
    }
  };

  const load = async (f: File) => {
    setError(null);
    setPlacements([]);
    setSelected(null);
    try {
      const b = new Uint8Array(await f.arrayBuffer());
      const d = await openPdf(b);
      const s: PageSize[] = [];
      for (let i = 1; i <= d.numPages; i++) {
        const vp = (await d.getPage(i)).getViewport({ scale: 1 });
        s.push({ w: vp.width, h: vp.height });
      }
      doc?.loadingTask.destroy();
      setFile(f);
      setBytes(b);
      setDoc(d);
      setSizes(s);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error && e.name === "PasswordException";
      setError(msg ? "Password-protected PDFs aren't supported." : "Couldn't open this PDF.");
    }
  };

  const stampMap = useMemo(() => new Map(stamps.map((s) => [s.id, s])), [stamps]);

  const addStamp = (s: Stamp, save: boolean) => {
    const all = [...stamps, s];
    setStamps(all);
    if (save) {
      const ids = new Set(savedIds).add(s.id);
      setSavedIds(ids);
      persist(all, ids);
    }
    setArmed(s.id);
  };

  const removeStamp = (id: string) => {
    const all = stamps.filter((s) => s.id !== id);
    const ids = new Set(savedIds);
    ids.delete(id);
    setStamps(all);
    setSavedIds(ids);
    persist(all, ids);
    setPlacements((p) => p.filter((x) => x.stampId !== id));
    if (armed === id) setArmed(null);
  };

  const addText = async (text: string) => {
    if (!text.trim()) return;
    const s = await textToStamp(text.trim(), {
      fontFamily: "Helvetica, Arial, sans-serif",
      color: "#111827",
      label: text.trim(),
      kind: "text",
    });
    if (s) addStamp(s, false);
  };

  const placeAt = (page: number, fx: number, fy: number) => {
    if (!armed) return;
    const stamp = stampMap.get(armed);
    if (!stamp) return;
    const size = sizes[page];
    // Text lands at ~12pt; signatures start ~170pt wide.
    const widthPts = stamp.kind === "text" ? stamp.width * (12 / TEXT_RENDER_PX) : 170;
    let w = Math.min(widthPts / size.w, stamp.kind === "text" ? 0.9 : 0.45);
    w = Math.min(w, 0.9);
    const h = (w * size.w * (stamp.height / stamp.width)) / size.h;
    const p: Placement = {
      id: uid("p"),
      stampId: stamp.id,
      page,
      w,
      h,
      x: clamp(fx - w / 2, 0, 1 - w),
      y: clamp(fy - h / 2, 0, 1 - h),
    };
    setPlacements((prev) => [...prev, p]);
    setSelected(p.id);
    setArmed(null);
  };

  const updatePlacement = useCallback((id: string, patch: Partial<Placement>) => {
    setPlacements((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deletePlacement = useCallback((id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmed(null);
        setSelected(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        deletePlacement(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, deletePlacement]);

  const download = async () => {
    if (!bytes || !file) return;
    setBusy(true);
    setError(null);
    try {
      const out = await applySignatures(bytes, placements, stampMap);
      downloadBytes(out, `${baseName(file.name)}-signed.pdf`);
    } catch (e) {
      console.error(e);
      setError("Couldn't save the signed PDF. The file may be encrypted or damaged.");
    } finally {
      setBusy(false);
    }
  };

  if (!doc || !file) {
    return (
      <div className="space-y-3">
        <FileDrop
          accept="application/pdf,.pdf"
          label="Drop a PDF here or click to choose"
          hint="Your file stays on this device"
          onFiles={(f) => load(f[0])}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="space-y-4 lg:sticky lg:top-4 lg:w-64 lg:shrink-0">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Signatures</h2>
            <button
              onClick={() => setShowMaker(true)}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
            >
              + New
            </button>
          </div>
          {stamps.filter((s) => savedIds.has(s.id)).length === 0 && (
            <p className="mt-3 text-sm text-zinc-500">Create a signature to get started.</p>
          )}
          <ul className="mt-3 space-y-2">
            {stamps
              .filter((s) => savedIds.has(s.id))
              .map((s) => (
                <li key={s.id} className="group relative">
                  <button
                    onClick={() => setArmed(armed === s.id ? null : s.id)}
                    className={`flex h-16 w-full items-center justify-center rounded-lg border bg-white p-2 ${
                      armed === s.id ? "border-indigo-500 ring-2 ring-indigo-200" : "border-zinc-200 hover:border-zinc-400"
                    }`}
                    title="Click, then click on a page to place"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.dataUrl} alt={s.label} className="max-h-full max-w-full object-contain" />
                  </button>
                  <button
                    onClick={() => removeStamp(s.id)}
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-white group-hover:flex"
                    aria-label="Delete saved signature"
                  >
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <TextAdder onAdd={addText} />

        <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-zinc-500">
            {doc.numPages} page{doc.numPages === 1 ? "" : "s"} · {placements.length} item
            {placements.length === 1 ? "" : "s"} placed
          </p>
          <button
            onClick={download}
            disabled={busy || placements.length === 0}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Download signed PDF"}
          </button>
          <button
            onClick={() => {
              doc.loadingTask.destroy();
              setDoc(null);
              setFile(null);
              setBytes(null);
              setPlacements([]);
            }}
            className="w-full rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Choose another PDF
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </aside>

      <div className="min-w-0 flex-1">
        {armed && (
          <div className="sticky top-2 z-20 mb-3 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm text-white shadow">
            Click on a page to place it · <kbd className="opacity-80">Esc</kbd> to cancel
          </div>
        )}
        <div className="mx-auto space-y-6" style={{ maxWidth: PAGE_WIDTH }}>
          {sizes.map((size, i) => (
            <PageView
              key={`${file.name}-${i}`}
              doc={doc}
              index={i}
              size={size}
              armed={!!armed}
              placements={placements.filter((p) => p.page === i)}
              stamps={stampMap}
              selected={selected}
              onSelect={setSelected}
              onPlace={placeAt}
              onChange={updatePlacement}
              onDelete={deletePlacement}
            />
          ))}
        </div>
      </div>

      {showMaker && (
        <SignatureMaker
          onCancel={() => setShowMaker(false)}
          onCreate={(s) => {
            addStamp(s, true);
            setShowMaker(false);
          }}
        />
      )}
    </div>
  );
}

function TextAdder({ onAdd }: { onAdd: (t: string) => void }) {
  const [text, setText] = useState("");
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Text</h2>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(text);
          setText("");
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Name, initials…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
        />
        <button
          disabled={!text.trim()}
          className="rounded-md border border-zinc-300 px-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      <button onClick={() => onAdd(today)} className="mt-2 text-sm text-indigo-600 hover:underline">
        + Today&apos;s date ({today})
      </button>
    </section>
  );
}

type PageViewProps = {
  doc: PDFDocumentProxy;
  index: number;
  size: PageSize;
  armed: boolean;
  placements: Placement[];
  stamps: Map<string, Stamp>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onPlace: (page: number, fx: number, fy: number) => void;
  onChange: (id: string, patch: Partial<Placement>) => void;
  onDelete: (id: string) => void;
};

function PageView({ doc, index, size, armed, placements, stamps, selected, onSelect, onPlace, onChange, onDelete }: PageViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(index < 2);
  const [rendered, setRendered] = useState(false);

  // Only render pages once they scroll near the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || rendered) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(index + 1);
      if (cancelled || !canvasRef.current || !wrapRef.current) return;
      await renderPageToCanvas(page, canvasRef.current, wrapRef.current.clientWidth || PAGE_WIDTH);
      if (!cancelled) setRendered(true);
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [visible, rendered, doc, index]);

  return (
    <div>
      <div
        ref={wrapRef}
        className={`relative select-none bg-white shadow-md ring-1 ring-zinc-200 ${armed ? "cursor-crosshair" : ""}`}
        style={{ aspectRatio: `${size.w} / ${size.h}` }}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget && e.target !== canvasRef.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (armed) onPlace(index, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
          else onSelect(null);
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block" />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Loading page…</div>
        )}
        {placements.map((p) => (
          <PlacedStamp
            key={p.id}
            p={p}
            stamp={stamps.get(p.stampId)}
            pageSize={size}
            container={wrapRef}
            selected={selected === p.id}
            onSelect={() => onSelect(p.id)}
            onChange={(patch) => onChange(p.id, patch)}
            onDelete={() => onDelete(p.id)}
          />
        ))}
      </div>
      <p className="mt-1.5 text-center text-xs text-zinc-400">
        Page {index + 1} of {doc.numPages}
      </p>
    </div>
  );
}

function PlacedStamp({
  p,
  stamp,
  pageSize,
  container,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  p: Placement;
  stamp?: Stamp;
  pageSize: PageSize;
  container: React.RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Placement>) => void;
  onDelete: () => void;
}) {
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; start: Placement } | null>(null);
  if (!stamp) return null;

  const begin = (mode: "move" | "resize", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    onSelect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: p };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const rect = container.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.sx) / rect.width;
    const dy = (e.clientY - d.sy) / rect.height;
    if (d.mode === "move") {
      onChange({
        x: clamp(d.start.x + dx, 0, 1 - d.start.w),
        y: clamp(d.start.y + dy, 0, 1 - d.start.h),
      });
    } else {
      const ratio = (pageSize.w / pageSize.h) * (stamp.height / stamp.width); // h per unit w
      const maxW = Math.min(1 - d.start.x, (1 - d.start.y) / ratio);
      const w = clamp(d.start.w + dx, 0.03, maxW);
      onChange({ w, h: w * ratio });
    }
  };

  const end = () => (drag.current = null);

  return (
    <div
      className={`absolute touch-none ${selected ? "outline-2 outline-dashed outline-indigo-500" : "hover:outline hover:outline-1 hover:outline-indigo-300"}`}
      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, height: `${p.h * 100}%`, cursor: "move" }}
      onPointerDown={(e) => begin("move", e)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stamp.dataUrl} alt={stamp.label} draggable={false} className="pointer-events-none h-full w-full" />
      {selected && (
        <>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow"
            aria-label="Remove"
          >
            ✕
          </button>
          <div
            onPointerDown={(e) => begin("resize", e)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-indigo-500 shadow"
            aria-label="Resize"
          />
        </>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
