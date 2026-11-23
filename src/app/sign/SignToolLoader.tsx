"use client";

import dynamic from "next/dynamic";

// The signing UI uses canvas, PDF.js and localStorage, so render it in the browser only.
const SignTool = dynamic(() => import("./SignTool"), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />,
});

export default SignTool;
