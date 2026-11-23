# Toolbox

Small personal web tools, built with Next.js (App Router) + TypeScript + Tailwind.

| Tool | Route | What it does |
| --- | --- | --- |
| Sign PDF | `/sign` | Draw, type or upload a signature (saved in your browser), click to place it on any page, drag/resize, add text or today's date, download the signed PDF. |
| Merge PDFs | `/merge` | Combine PDFs and PNG/JPG images into one PDF; reorder by drag or arrows. |

**Privacy:** all PDF processing runs in the browser ([pdf-lib](https://pdf-lib.js.org/) to edit, [PDF.js](https://mozilla.github.io/pdf.js/) to render). Files are never uploaded, so there's no server cost and no Vercel request-size limit.

> Signatures are placed as images ("electronic signatures"), not cryptographic digital signatures (certificates).

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
npm run typecheck
```

`postinstall` / `predev` / `prebuild` copy the PDF.js worker into `public/pdf.worker.min.mjs` (git-ignored) so it always matches the installed `pdfjs-dist` version.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo. Framework preset "Next.js" is auto-detected; no env vars needed.
3. Deploy. Every push to `main` redeploys; PRs get preview URLs.

Or from the CLI: `npx vercel` (preview) then `npx vercel --prod`.

## Adding a tool

1. Create `src/app/<tool>/page.tsx` (server component with `metadata`) and a client component for the UI.
2. Add a link in `src/app/layout.tsx` (nav) and `src/app/page.tsx` (home cards).
3. Shared helpers live in `src/lib/` (`pdfjs.ts`, `download.ts`, …) and `src/components/` (`FileDrop`).
