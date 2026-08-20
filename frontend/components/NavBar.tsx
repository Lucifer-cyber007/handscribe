"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

export default function NavBar() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          PDF<span className="text-brand-600">Boii</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link href="/tools" className="hover:text-brand-600">
            Tools
          </Link>
          <ThemeToggle />
          {!loading &&
            (user ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-500 dark:text-slate-400">{user.name}</span>
                <button type="button" onClick={logout} className="hover:text-brand-600">
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link href="/login" className="hover:text-brand-600">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
                >
                  Sign up
                </Link>
              </>
            ))}
        </nav>
      </div>
    </header>
  );
}
