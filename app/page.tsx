import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Factory,
  Route,
  ShieldCheck,
  Gauge,
  Check,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const pillars = [
  {
    icon: Route,
    title: "Material flow",
    body: "Minimize transport distance weighted by throughput. High-volume machine pairs are pulled adjacent so parts travel less between stations.",
  },
  {
    icon: ShieldCheck,
    title: "Worker safety",
    body: "Enforce minimum aisle widths, exit clearances, heat separation between high-output machines, and explicit no-go zones — flagged as violations.",
  },
  {
    icon: Gauge,
    title: "Equipment utilization",
    body: "Reward compact, balanced layouts that respect every machine's clearance halo and leave room to work, without wasting floor space.",
  },
];

const tiers = [
  {
    name: "Per layout",
    price: "$500",
    cadence: "/mo per factory layout",
    note: "12-month minimum",
    features: [
      "Unlimited optimizer runs",
      "Manual draw + photo/scan import",
      "Flow heatmap & violation checks",
      "PNG / JSON / PDF export",
    ],
    cta: "Start a layout",
    highlight: true,
  },
  {
    name: "Onboarding",
    price: "$5,000",
    cadence: "one-time",
    note: "white-glove setup",
    features: [
      "On-site / remote floor capture",
      "Equipment library configured",
      "Flow & safety rules modeled",
      "Team training session",
    ],
    cta: "Talk to us",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:32px_32px]"
          />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <Badge variant="secondary" className="mb-4">
              <Factory className="mr-1 h-3 w-3" /> Hybrid manufacturing layout
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Optimized factory floors for{" "}
              <span className="text-primary">3D printing + assembly</span>{" "}
              operations.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              GalvBot generates and scores factory layouts that balance material
              flow, worker safety, and equipment utilization. Define your floor,
              machines, and constraints — or upload a scan — then let a
              transparent optimizer iterate with you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/projects">
                  Try the demo <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Runs fully in your browser — no signup, a sample factory is
              pre-loaded.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">
              Three pillars, one score
            </h2>
            <p className="mt-3 text-muted-foreground">
              Every layout is graded on a transparent, weighted composite. Tune
              the weights to match your priorities — the optimizer adapts.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <Card key={p.title}>
                <CardHeader>
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <p.icon className="h-5 w-5" />
                  </span>
                  <CardTitle>{p.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{p.body}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-xs text-muted-foreground">
            Note: GalvBot uses heuristic optimization (simulated annealing) and a
            transparent flow model. It is decision-support tooling — not a
            certified safety or structural engineering authority. Always validate
            against local codes.
          </p>
        </section>

        {/* How it works */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-4">
              {[
                ["1. Capture", "Draw your floor to scale, or upload a blueprint/photo to auto-detect the boundary and obstacles."],
                ["2. Define", "Place machines from the palette, set clearances, and wire up material-flow throughput between stations."],
                ["3. Optimize", "Run simulated annealing in a web worker. Watch the score improve live, then apply or keep your own."],
                ["4. Export", "Ship a PNG, the full project JSON, or a one-page PDF summary with the score breakdown and violations."],
              ].map(([t, b]) => (
                <div key={t}>
                  <div className="mb-2 text-sm font-semibold text-primary">
                    {t}
                  </div>
                  <p className="text-sm text-muted-foreground">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Built for mid-sized to large manufacturers running mixed additive +
              assembly lines.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {tiers.map((t) => (
              <Card
                key={t.name}
                className={t.highlight ? "border-primary shadow-md" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{t.name}</CardTitle>
                    {t.highlight && <Badge>Most popular</Badge>}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{t.price}</span>
                    <span className="text-sm text-muted-foreground">
                      {t.cadence}
                    </span>
                  </div>
                  <CardDescription>{t.note}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    className="mt-6 w-full"
                    variant={t.highlight ? "default" : "outline"}
                  >
                    <Link href="/projects">{t.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Boxes className="h-4 w-4 text-primary" /> GalvBot
          </div>
          <span className="sm:ml-auto">
            Heuristic layout optimization for hybrid manufacturing.
          </span>
        </div>
      </footer>
    </>
  );
}
