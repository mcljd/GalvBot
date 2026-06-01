import Link from "next/link";
import { Boxes } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </span>
          <span className="tracking-tight">GalvBot</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
          <Link href="/#features" className="px-2 py-1 hover:text-foreground">
            Features
          </Link>
          <Link href="/#pricing" className="px-2 py-1 hover:text-foreground">
            Pricing
          </Link>
          <Link href="/projects" className="px-2 py-1 hover:text-foreground">
            Projects
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/projects">Open app</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
