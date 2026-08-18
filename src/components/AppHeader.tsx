import Link from "next/link";
import { ConnectionStatus } from "./ConnectionStatus";

export function AppHeader() {
  return (
    <header className="relative z-10 border-b border-border bg-bg-raised/80 backdrop-blur">
      <div className="h-[3px] w-full bg-gradient-to-r from-machine via-human to-qualify opacity-70" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tracking-tight text-text">
              ARIE
            </span>
            <span className="hidden font-data text-[0.7rem] uppercase tracking-[0.2em] text-text-faint sm:inline">
              Decision Console
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-text-dim sm:flex">
            <Link href="/" className="transition-colors hover:text-text">
              Dashboard
            </Link>
            <Link href="/leads/new" className="transition-colors hover:text-text">
              New lead
            </Link>
          </nav>
        </div>
        <ConnectionStatus />
      </div>
    </header>
  );
}
