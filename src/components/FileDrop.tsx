"use client";

import { useRef, useState } from "react";

type Props = {
  accept: string;
  multiple?: boolean;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  compact?: boolean;
};

export default function FileDrop({ accept, multiple, label, hint, onFiles, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const accepts = (f: File) =>
    accept.split(",").some((rule) => {
      const r = rule.trim().toLowerCase();
      if (r.startsWith(".")) return f.name.toLowerCase().endsWith(r);
      if (r.endsWith("/*")) return f.type.startsWith(r.slice(0, -1));
      return f.type === r;
    });

  const handle = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list).filter(accepts);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
        compact ? "px-4 py-5" : "px-6 py-14"
      } ${over ? "border-indigo-500 bg-indigo-50" : "border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50"}`}
    >
      <p className="font-medium text-zinc-800">{label}</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
