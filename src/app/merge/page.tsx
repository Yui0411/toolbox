import type { Metadata } from "next";
import MergeTool from "./MergeTool";

export const metadata: Metadata = { title: "Merge PDFs" };

export default function MergePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Merge PDFs</h1>
      <p className="mt-1 text-zinc-600">
        Add PDFs or images, put them in order, then download a single PDF.
      </p>
      <div className="mt-6">
        <MergeTool />
      </div>
    </div>
  );
}
