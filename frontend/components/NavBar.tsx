import Link from "next/link";

export default function NavBar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Hand<span className="text-brand-600">Scribe</span>
        </Link>
        <nav className="flex gap-6 text-sm font-medium text-slate-600">
          <Link href="/tools" className="hover:text-brand-600">
            Tools
          </Link>
        </nav>
      </div>
    </header>
  );
}
