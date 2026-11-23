import type { Metadata } from "next";
import SignTool from "./SignToolLoader";

export const metadata: Metadata = { title: "Sign PDF" };

export default function SignPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Sign PDF</h1>
      <p className="mt-1 text-zinc-600">
        Create a signature, click on a page to place it, then drag and resize it into position.
      </p>
      <div className="mt-6">
        <SignTool />
      </div>
    </div>
  );
}
