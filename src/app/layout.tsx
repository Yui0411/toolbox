import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Toolbox", template: "%s · Toolbox" },
  description: "Small everyday tools: sign PDFs, merge PDFs. Files never leave your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="font-semibold tracking-tight">
              🧰 Toolbox
            </Link>
            <Link href="/sign" className="text-sm text-zinc-600 hover:text-zinc-900">
              Sign PDF
            </Link>
            <Link href="/merge" className="text-sm text-zinc-600 hover:text-zinc-900">
              Merge PDFs
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="py-6 text-center text-xs text-zinc-400">
          All processing happens in your browser. Files are never uploaded.
        </footer>
      </body>
    </html>
  );
}
