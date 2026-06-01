# GalvBot

**Optimized factory floor layouts for hybrid manufacturing.**

GalvBot is a functional MVP web app that helps factory managers lay out shops
that mix 3D printing / additive processes with traditional assembly lines. You
define a floor + equipment + constraints (or upload a photo/scan of an existing
floor), run a transparent optimizer, and get back a visually rendered, scored
layout you can iterate on and export.

It optimizes three pillars and grades every layout on a single composite score:

- **Material flow** — throughput-weighted transport distance between machines.
- **Worker safety** — aisle widths, exit clearance, heat separation, no-go zones.
- **Equipment utilization** — clearance satisfaction and packing compactness.

> GalvBot uses **heuristic** optimization (simulated annealing) and a
> **transparent** flow model — not a neural/CFD physics solver. It is
> decision-support tooling, not a code-compliance or structural-engineering
> authority. The UI says so wherever a model is heuristic.

---

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

The app runs with **zero configuration**: projects persist to `localStorage`,
the solver runs in your browser (Web Worker), and floor-scan extraction runs in
a serverless route. A realistic demo factory is seeded on first load.

Other scripts:

```bash
npm run build   # production build
npm start       # serve the production build
npm test        # run the Vitest suite (scoring + optimizer)
npm run lint    # eslint
```

Requires Node 18.18+ (developed on Node 22).

---

## What you can do

1. **Landing page** (`/`) — value prop, the three pillars, pricing, demo CTA.
2. **Projects** (`/projects`) — create/duplicate/delete projects; a hybrid-shop
   demo is pre-seeded. Each card shows an SVG layout preview.
3. **Import a scan** (`/projects/import`) — upload a blueprint/photo, review the
   auto-detected boundary + obstacle hints, calibrate real-world scale with two
   clicks, and drop into the editor. (Try the bundled sample blueprint.)
4. **Editor** (`/projects/[id]`) — the core screen:
   - Konva canvas: floor, obstacles, no-go zones, docks, draggable/rotatable
     machines with clearance halos, flow lines, and a flow heatmap overlay.
     Pan/zoom, grid snapping, fit-to-view, rectangle tools for obstacles/no-go.
   - **Left panel:** machine palette, machine list (lock/unlock), per-machine
     properties.
   - **Right panel tabs:** Solver (objective weights, settings, run/stop, live
     progress, before/after compare, Apply/Keep), Score (live composite +
     per-pillar bars + violations), Flows (throughput editor + heatmap toggle).
   - **Top bar:** tools, undo/redo, rotate, flow/heatmap toggles, floor & scale
     settings, export, theme.
5. **Export** — PNG of the canvas, full project JSON, and a one-page PDF summary
   (layout image + score breakdown + violations).

Keyboard: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y` redo, `R` rotate,
`L` lock, `Delete` remove, `Esc` deselect.

---

## Architecture

```
app/
  page.tsx                 # landing
  projects/                # dashboard, import, editor route
  api/scan/route.ts        # photo/scan extraction endpoint (nodejs runtime)
components/
  ui/                      # shadcn-style primitives (hand-authored, Tailwind v4)
  editor/                  # canvas, toolbar, panels, export
  projects/ scan/          # dashboard + scan importer
lib/
  types.ts                 # canonical data model (source of truth)
  geometry.ts              # polygon/rect/distance helpers
  optimizer/
    scoring.ts             # transparent per-pillar scoring + violations
    anneal.ts              # constructive init + simulated annealing
  flow/heatmap.ts          # transparent Manhattan-route flow field
  scan/                    # FloorExtractor interface + HeuristicFloorExtractor
  storage/                 # StorageProvider interface + Local + Supabase
  seed/demo.ts             # seeded hybrid-shop demo project
  store/editor.ts          # Zustand editor store (mutations, undo/redo, autosave)
workers/solver.worker.ts   # runs the solver off the main thread
tests/                     # Vitest specs for scoring + optimizer
```

### The optimizer (`lib/optimizer/`)

- **Scoring** (`scoring.ts`) works on machine footprints + clearance rects. Each
  pillar is normalized to `0..100` (higher = better) and combined using the
  project's objective weights. Hard problems (overlaps, out-of-bounds,
  obstacle/no-go intrusion, blocked exits, insufficient heat separation) surface
  as `error` violations and heavily penalize safety; narrow aisles surface as
  `warn`.
- **Search** (`anneal.ts`) starts from a constructive heuristic (place machines
  by flow centrality, packed into free cells) and refines with **simulated
  annealing** (translate / rotate / swap moves, geometric cooling). Energy =
  `100 − composite + 25 × errorCount`, so the search avoids infeasible layouts
  regardless of the weights. `fixed` (locked) machines are never moved. The
  PRNG is seeded (`mulberry32`) for reproducible runs.
- It runs in a **Web Worker** (`workers/solver.worker.ts`) and streams progress
  (current + best score) back to the UI; a main-thread fallback exists for
  environments without `Worker`.

### Flow model (`lib/flow/heatmap.ts`)

A transparent heuristic: trace L-shaped (Manhattan) routes between connected
machines and accumulate throughput along the cells crossed. Rendered as a
heatmap overlay to highlight congested aisles. Clearly labeled as heuristic.

---

## Swapping in a better floor extractor

Photo/scan extraction lives behind a clean interface:

```ts
interface FloorExtractor {
  extract(image: Buffer): Promise<FloorProposal>;
}
```

The MVP ships `HeuristicFloorExtractor` (`lib/scan/heuristic.ts`) — a
deterministic CV pass with `sharp`: grayscale → border-background estimate →
content bounding box (boundary) → dark connected components (obstacle hints). It
returns proposals in image-pixel space, so the UI always runs the required
two-point scale calibration before converting to meters.

To plug in a stronger model (OpenCV.js, an ML segmenter, or a paid API),
implement `FloorExtractor` and use it in `app/api/scan/route.ts`. No UI changes
needed.

---

## Optional Supabase persistence

The app is fully functional without a backend. To switch persistence to
Supabase Postgres:

1. Create the table — see [`supabase/schema.sql`](./supabase/schema.sql).
2. Set env vars (see `.env.example`):

   ```bash
   NEXT_PUBLIC_STORAGE_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

`getStorageProvider()` (`lib/storage/index.ts`) selects the adapter from these
vars and **falls back to localStorage** if Supabase is requested but
misconfigured, so the app never hard-fails. All env vars are optional.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_STORAGE_PROVIDER` | No | Set to `supabase` to use the Supabase adapter; anything else uses localStorage. |
| `NEXT_PUBLIC_SUPABASE_URL` | Only for Supabase | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Only for Supabase | Supabase anon key. |

---

## Deploying to Vercel

It's a standard Next.js 15 App Router app. Push to a Git repo and import into
Vercel. All heavy compute is client-side (Web Worker) or in the `/api/scan`
serverless route (Node.js runtime, used by `sharp`), well within typical limits.

---

## Tech stack & notes

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with hand-authored **shadcn/ui-style** primitives
- **Zustand** (editor state) + **TanStack Query** (provider wired for future
  server calls)
- **react-konva / Konva** for the 2D editor (the data model is 3D-ready: a
  three.js view could be added later without changing `lib/types.ts`)
- **Vitest** for the optimizer + scoring unit tests

**Design decisions made along the way** (per the brief's "make a sensible
choice and note it"):

- Built on Next 15.5 (latest 15.x) rather than pinning an exact 15.0; React 19.
- shadcn/ui primitives are hand-authored for Tailwind v4 rather than generated
  via the CLI, for reproducibility in a scripted build.
- Scale calibration is implemented as the spec's two-point + real-distance flow
  in the scan importer; the editor's "Floor" dialog covers manual sizing.
- The solver optimizes the same composite score the UI displays, plus a hard
  feasibility penalty, so "what you see is what it optimizes."
