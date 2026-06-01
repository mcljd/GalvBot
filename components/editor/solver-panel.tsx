"use client";

import * as React from "react";
import { Play, Square, Check, Undo2, Loader2 } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { useOptimizer } from "@/hooks/use-optimizer";
import { scoreLayout } from "@/lib/optimizer/scoring";
import { DEFAULT_SOLVER_SETTINGS, type LayoutScore } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScoreDisplay } from "./score-display";

const WEIGHT_KEYS = [
  { key: "materialFlow", label: "Material flow" },
  { key: "safety", label: "Worker safety" },
  { key: "utilization", label: "Utilization" },
] as const;

export function SolverPanel() {
  const project = useEditor((s) => s.project);
  const setWeights = useEditor((s) => s.setWeights);
  const applyPlacements = useEditor((s) => s.applyPlacements);
  const pushHistory = useEditor((s) => s.pushHistory);

  const { status, progress, result, run, stop, dismiss } = useOptimizer();
  const [iterations, setIterations] = React.useState(
    DEFAULT_SOLVER_SETTINGS.iterations
  );
  const [startTemp, setStartTemp] = React.useState(
    DEFAULT_SOLVER_SETTINGS.startTemp
  );
  const [startFromCurrent, setStartFromCurrent] = React.useState(false);
  const [baseline, setBaseline] = React.useState<LayoutScore | null>(null);

  if (!project) return null;

  function handleRun() {
    if (!project) return;
    setBaseline(scoreLayout(project));
    run(
      project,
      {
        ...DEFAULT_SOLVER_SETTINGS,
        iterations,
        startTemp,
        seed: Math.floor(Math.random() * 1_000_000_000),
      },
      startFromCurrent
    );
  }

  function handleApply() {
    if (!result) return;
    pushHistory();
    applyPlacements(result.placements);
    dismiss();
    setBaseline(null);
  }

  const running = status === "running";
  const showResult = (status === "done" || status === "stopped") && result;

  return (
    <div className="space-y-5">
      {/* Objective weights */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Objective weights
        </h3>
        <div className="space-y-3">
          {WEIGHT_KEYS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <Label>{label}</Label>
                <span className="tabular-nums text-muted-foreground">
                  {project.weights[key].toFixed(2)}
                </span>
              </div>
              <Slider
                value={[project.weights[key]]}
                min={0}
                max={1}
                step={0.05}
                aria-label={`${label} weight`}
                onValueChange={([v]) =>
                  setWeights({ ...project.weights, [key]: v })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Solver settings */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Solver settings
        </h3>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <Label>Iterations</Label>
            <span className="tabular-nums text-muted-foreground">
              {iterations.toLocaleString()}
            </span>
          </div>
          <Slider
            value={[iterations]}
            min={500}
            max={12000}
            step={500}
            aria-label="Iterations"
            onValueChange={([v]) => setIterations(v)}
            disabled={running}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <Label>Start temperature</Label>
            <span className="tabular-nums text-muted-foreground">
              {startTemp.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[startTemp]}
            min={1}
            max={30}
            step={0.5}
            aria-label="Start temperature"
            onValueChange={([v]) => setStartTemp(v)}
            disabled={running}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <Label htmlFor="from-current" className="cursor-pointer text-xs">
            Start from current layout
          </Label>
          <Switch
            id="from-current"
            checked={startFromCurrent}
            disabled={running}
            onCheckedChange={setStartFromCurrent}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Off = reorganize from a flow-ordered constructive layout. On = refine
          your current arrangement. Locked machines never move.
        </p>
      </section>

      {/* Run / progress */}
      <section className="space-y-3">
        {!running && !showResult && (
          <Button className="w-full" onClick={handleRun}>
            <Play className="h-4 w-4" /> Optimize layout
          </Button>
        )}

        {running && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Optimizing…
              </span>
              <span className="tabular-nums">
                best {progress?.bestTotal.toFixed(1) ?? "—"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    ((progress?.iteration ?? 0) / iterations) * 100
                  )}%`,
                }}
              />
            </div>
            <Button variant="outline" className="w-full" onClick={stop}>
              <Square className="h-4 w-4" /> Stop
            </Button>
          </div>
        )}

        {showResult && result && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Optimization result
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">
                  Before (yours)
                </div>
                {baseline && <ScoreDisplay score={baseline} compact />}
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">
                  After (optimized)
                </div>
                <ScoreDisplay score={result.score} compact />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {baseline && (
                <DeltaNote before={baseline.total} after={result.score.total} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleApply}>
                <Check className="h-4 w-4" /> Apply optimized
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  dismiss();
                  setBaseline(null);
                }}
              >
                <Undo2 className="h-4 w-4" /> Keep mine
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DeltaNote({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  if (Math.abs(delta) < 0.1)
    return <span>The optimizer matched your current score.</span>;
  if (delta > 0)
    return (
      <span className="text-success">
        +{delta.toFixed(1)} composite points vs. your layout.
      </span>
    );
  return (
    <span className="text-warning">
      Your current layout already scores {Math.abs(delta).toFixed(1)} points
      higher — keep it.
    </span>
  );
}
