import Link from "next/link";

const tools = [
  {
    href: "/sign",
    title: "Sign PDF",
    description: "Draw, type or upload a signature and place it anywhere on your PDF.",
    icon: "✍️",
  },
  {
    href: "/merge",
    title: "Merge PDFs",
    description: "Combine several PDFs (and images) into one file, in the order you choose.",
    icon: "📎",
  },
];

export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Toolbox</h1>
      <p className="mt-1 text-zinc-600">Small tools for everyday tasks.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
          >
            <div className="text-2xl">{t.icon}</div>
            <h2 className="mt-3 font-medium group-hover:text-indigo-600">{t.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{t.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
