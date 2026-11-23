"use client";

import { useEffect, useRef, useState } from "react";
import { signatureFonts } from "@/lib/fonts";
import { canvasToStamp, imageFileToStamp, textToStamp, type Stamp } from "@/lib/stamp";

type Tab = "draw" | "type" | "upload";

const INKS = [
  { name: "Black", value: "#111827" },
  { name: "Blue", value: "#1d3fbf" },
];

export default function SignatureMaker({
  onCreate,
  onCancel,
}: {
  onCreate: (s: Stamp) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<Tab>("draw");
  const [ink, setInk] = useState(INKS[0].value);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New signature</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {(["draw", "type", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 capitalize ${
                tab === t ? "bg-white font-medium shadow-sm" : "text-zinc-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab !== "upload" && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-600">
            Ink
            {INKS.map((i) => (
              <button
                key={i.value}
                title={i.name}
                onClick={() => setInk(i.value)}
                className={`h-6 w-6 rounded-full border-2 ${ink === i.value ? "border-indigo-500" : "border-transparent"}`}
                style={{ background: i.value }}
              />
            ))}
          </div>
        )}

        <div className="mt-4">
          {tab === "draw" && <DrawPad ink={ink} onCreate={onCreate} />}
          {tab === "type" && <TypePad ink={ink} onCreate={onCreate} />}
          {tab === "upload" && <UploadPad onCreate={onCreate} />}
        </div>
      </div>
    </div>
  );
}

function DrawPad({ ink, onCreate }: { ink: string; onCreate: (s: Stamp) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvasRef.current!;
    const scale = 2;
    c.width = c.clientWidth * scale;
    c.height = c.clientHeight * scale;
    const ctx = c.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-48 w-full touch-none rounded-lg border border-zinc-300 bg-white"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.fillStyle = ink;
            ctx.beginPath();
            ctx.arc(last.current.x, last.current.y, 1.25, 0, Math.PI * 2);
            ctx.fill();
            setEmpty(false);
          }}
          onPointerMove={(e) => {
            if (!drawing.current || !last.current) return;
            const p = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.strokeStyle = ink;
            // Pen pressure when available, otherwise a steady 2.5px line.
            ctx.lineWidth = e.pointerType === "pen" && e.pressure > 0 ? 1 + e.pressure * 3 : 2.5;
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Sign here with your mouse, finger or pen
          </span>
        )}
        <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-zinc-200" />
      </div>
      <Actions
        onClear={clear}
        disabled={empty}
        onSave={() => {
          const s = canvasToStamp(canvasRef.current!, "Drawn signature");
          if (s) onCreate(s);
        }}
      />
    </div>
  );
}

function TypePad({ ink, onCreate }: { ink: string; onCreate: (s: Stamp) => void }) {
  const [text, setText] = useState("");
  const [fontIdx, setFontIdx] = useState(0);
  const font = signatureFonts[fontIdx].font;

  return (
    <div>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your name"
        className="w-full rounded-lg border border-zinc-300 px-3 py-2"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {signatureFonts.map((f, i) => (
          <button
            key={f.name}
            onClick={() => setFontIdx(i)}
            className={`truncate rounded-lg border px-3 py-4 text-3xl ${f.font.className} ${
              i === fontIdx ? "border-indigo-500 ring-1 ring-indigo-500" : "border-zinc-300"
            }`}
            style={{ color: ink }}
          >
            {text || "Your name"}
          </button>
        ))}
      </div>
      <Actions
        disabled={!text.trim()}
        onClear={() => setText("")}
        onSave={async () => {
          const s = await textToStamp(text.trim(), {
            fontFamily: font.style.fontFamily,
            weight: font.style.fontWeight ?? 600,
            color: ink,
            label: text.trim(),
          });
          if (s) onCreate(s);
        }}
      />
    </div>
  );
}

function UploadPad({ onCreate }: { onCreate: (s: Stamp) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const [preview, setPreview] = useState<Stamp | null>(null);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    imageFileToStamp(file, removeWhite).then((s) => !cancelled && setPreview(s));
    return () => {
      cancelled = true;
    };
  }, [file, removeWhite]);

  return (
    <div>
      <label className="flex h-48 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fff_0_50%)] bg-[length:16px_16px] hover:border-zinc-400">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.dataUrl} alt="Signature preview" className="max-h-40 max-w-[90%] object-contain" />
        ) : (
          <span className="text-sm text-zinc-500">Choose a photo or scan of your signature (PNG/JPG)</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
            e.target.value = "";
          }}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
        <input type="checkbox" checked={removeWhite} onChange={(e) => setRemoveWhite(e.target.checked)} />
        Remove white background
      </label>
      <Actions
        disabled={!preview}
        onClear={() => {
          setFile(null);
          setPreview(null);
        }}
        onSave={() => preview && onCreate(preview)}
      />
    </div>
  );
}

function Actions({
  onClear,
  onSave,
  disabled,
}: {
  onClear: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button onClick={onClear} className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
        Clear
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Use signature
      </button>
    </div>
  );
}
