"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { computeAnalytics } from "@/lib/analytics";
import { MACHINE_META, type MachineType } from "@/lib/types";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function InsightsPanel() {
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);
  const a = React.useMemo(
    () => (project ? computeAnalytics(project) : null),
    [project]
  );

  if (!project || !a) return null;

  const labelOf = (id: string) =>
    project.machines.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Machines" value={`${a.machineCount}`} />
        <Stat label="Connected power" value={`${a.totalPowerKw} kW`} />
        <Stat
          label="Space utilization"
          value={`${a.utilizationPct}%`}
          sub={`${a.footprintArea} / ${a.usableFloorArea} m²`}
        />
        <Stat
          label="Throughput"
          value={`${a.totalThroughput.toLocaleString()}`}
          sub="units / day"
        />
        <Stat
          label="Routed work"
          value={a.routedWork.toLocaleString()}
          sub="m·units/day"
        />
        <Stat label="High-heat machines" value={`${a.highHeatCount}`} />
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Equipment mix
        </h3>
        <ul className="space-y-1">
          {(Object.entries(a.byType) as [MachineType, number][]).map(
            ([type, count]) => (
              <li
                key={type}
                className="flex items-center gap-2 text-xs"
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: MACHINE_META[type].color }}
                />
                <span className="flex-1">{MACHINE_META[type].label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {count}
                </span>
              </li>
            )
          )}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Walkability
        </h3>
        {!a.reachabilityChecked ? (
          <p className="text-[11px] text-muted-foreground">
            Add an inbound dock to check that every machine is reachable on foot.
          </p>
        ) : a.unreachable.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> All machines are reachable
            from an inbound dock.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {a.unreachable.length} machine(s) blocked off from docks:
            </p>
            <ul className="space-y-1">
              {a.unreachable.map((id) => (
                <li key={id}>
                  <button
                    className="w-full rounded-md border border-warning/40 bg-warning/5 px-2 py-1 text-left text-xs hover:bg-warning/10"
                    onClick={() => select(id)}
                  >
                    {labelOf(id)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Power is summed from each machine&apos;s rating (typical defaults where
        unset). Walkability flood-fills aisle cells from inbound docks with
        machines treated as solid — a heuristic check, not a fire-code audit.
      </p>
    </div>
  );
}
