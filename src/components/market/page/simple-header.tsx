import Link from "next/link";
import { TenderLogo } from "@/components/shell/tender-logo";
import { DEFAULT_MARKET_ID } from "@/lib/tender";
import { marketHref } from "./routes";

const NAV_LINK =
  "inline-flex h-8 shrink-0 items-center rounded-md px-2 text-button font-medium whitespace-nowrap text-muted-foreground no-underline transition-colors duration-quick hover:bg-accent-subtle hover:text-accent-foreground focus-visible:shadow-focus focus-visible:outline-none";

/** Static TopNav look-alike for pages outside a market (not found, demo). Server-renderable. */
export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-40 h-(--navbar-height) w-full border-b border-border bg-background">
      <div className="mx-auto flex h-full w-full items-center px-4 lg:px-6">
        <Link href={marketHref(DEFAULT_MARKET_ID)} aria-label="Tender home" className={`${NAV_LINK} -ml-2 text-foreground lg:ml-0`}>
          <TenderLogo />
        </Link>
        <nav aria-label="Markets" className="ml-auto flex items-center gap-1">
          <Link href="/markets" className={NAV_LINK}>
            Browse all markets
          </Link>
        </nav>
      </div>
    </header>
  );
}
