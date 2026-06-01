"use client";

import * as React from "react";
import { Plus, Trash2, Flame, ArrowRight } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { MACHINE_META } from "@/lib/types";
import { computeFlowHeatmap } from "@/lib/flow/heatmap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function FlowPanel() {
  const project = useEditor((s) => s.project);
  const addFlow = useEditor((s) => s.addFlow);
  const updateFlow = useEditor((s) => s.updateFlow);
  const removeFlow = useEditor((s) => s.removeFlow);
  const showHeatmap = useEditor((s) => s.showHeatmap);
  const toggleHeatmap = useEditor((s) => s.toggleHeatmap);

  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [units, setUnits] = React.useState(50);

  const analysis = React.useMemo(() => {
    if (!project || project.flows.length === 0) return null;
    const field = computeFlowHeatmap(project);
    const totalUnits = project.flows.reduce((s, f) => s + f.unitsPerDay, 0);
    return { routedWork: field.routedWork, totalUnits };
  }, [project]);

  if (!project) return null;
  const machines = project.machines;
  const labelOf = (id: string) =>
    machines.find((m) => m.id === id)?.label ?? "—";

  function handleAdd() {
    if (!from || !to || from === to) return;
    addFlow(from, to, Math.max(0, units));
    setFrom("");
    setTo("");
    setUnits(50);
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Material flows ({project.flows.length})
        </h3>
        {machines.length < 2 ? (
          <p className="text-xs text-muted-foreground">
            Add at least two machines to define material flow between them.
          </p>
        ) : (
          <>
            <div className="space-y-2 rounded-lg border p-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="flow-from" className="text-[11px]">
                    From
                  </Label>
                  <select
                    id="flow-from"
                    className={selectClass}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="flow-to" className="text-[11px]">
                    To
                  </Label>
                  <select
                    id="flow-to"
                    className={selectClass}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="flow-units" className="text-[11px]">
                    Throughput (units/day)
                  </Label>
                  <Input
                    id="flow-units"
                    type="number"
                    min={0}
                    value={units}
                    onChange={(e) => setUnits(+e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={!from || !to || from === to}
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {from && to && from === to && (
                <p className="text-[11px] text-destructive">
                  Source and destination must differ.
                </p>
              )}
            </div>

            <ul className="mt-3 space-y-1.5">
              {project.flows.map((f, i) => (
                <li
                  key={`${f.from}-${f.to}-${i}`}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        MACHINE_META[
                          machines.find((m) => m.id === f.from)?.type ??
                            "assembly_station"
                        ].color,
                    }}
                  />
                  <span className="flex flex-1 items-center gap-1 truncate">
                    <span className="truncate">{labelOf(f.from)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{labelOf(f.to)}</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={f.unitsPerDay}
                    onChange={(e) =>
                      updateFlow(i, { unitsPerDay: Math.max(0, +e.target.value) })
                    }
                    className="h-7 w-16 text-right text-xs"
                    aria-label={`Throughput for ${labelOf(f.from)} to ${labelOf(
                      f.to
                    )}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label="Remove flow"
                    onClick={() => removeFlow(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
              {project.flows.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  No flows yet. Add throughput edges between machines above.
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      <Separator />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Flow heatmap
          </h3>
          <Button
            variant={showHeatmap ? "secondary" : "outline"}
            size="sm"
            onClick={toggleHeatmap}
          >
            <Flame className="h-4 w-4" /> {showHeatmap ? "On" : "Off"}
          </Button>
        </div>
        {analysis && (
          <div className="grid grid-cols-2 gap-2">
            <Metric
              label="Routed transport work"
              value={`${analysis.routedWork.toLocaleString()} m·units/day`}
            />
            <Metric
              label="Total throughput"
              value={`${analysis.totalUnits.toLocaleString()} units/day`}
            />
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The heatmap routes each flow with A* around walls, obstacles, and
          no-go zones (and softly around other machines), then accumulates
          throughput along the cells each route crosses. It is a transparent,
          obstacle-aware routing model — not a CFD or neural physics simulation —
          to help you spot congested aisles. &ldquo;Routed transport work&rdquo;
          sums throughput × routed distance; lower is leaner.
        </p>
      </section>
    </div>
  );
}
