import Link from "next/link";
import {
  ArrowLeft,
  Hammer,
  HardHat,
  Plug,
  Wrench,
  Package,
  Brush,
  Scissors,
  type LucideIcon,
} from "lucide-react";
import { copyDe } from "@/lib/constants/copy.de";
import { categories, type CategoryDefinition } from "@/lib/constants/categories";

const ICONS: Record<string, LucideIcon> = {
  Wrench,
  Plug,
  HardHat,
  Hammer,
  Package,
  Brush,
  Scissors,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Package;
}

export default function InfoPage() {
  const entries = Object.entries(categories) as Array<
    [string, CategoryDefinition]
  >;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-12 pt-4">
      <header className="flex items-center gap-2">
        <Link
          href="/foreman"
          className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 hover:border-zinc-400"
          aria-label={copyDe["nav.home"]}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-base font-semibold text-zinc-900">
          {copyDe["info.title"]}
        </h1>
      </header>

      <p className="text-sm text-zinc-700">{copyDe["info.intro"]}</p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">
          {copyDe["info.what_yes_title"]}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {entries.map(([key, def]) => {
            const Icon = iconFor(def.icon);
            return (
              <li
                key={key}
                className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
              >
                <Icon className="h-5 w-5 text-zinc-700" />
                <span className="text-sm text-zinc-900">{def.label_de}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">
          {copyDe["info.what_no_title"]}
        </h2>
        <p className="text-sm text-amber-900">{copyDe["info.what_no_body"]}</p>
      </section>

      <Link
        href="/foreman"
        className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 hover:border-zinc-400"
      >
        {copyDe["info.back"]}
      </Link>
    </div>
  );
}
