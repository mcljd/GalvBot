"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  DoorOpen,
} from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { computeAnalytics } from "@/lib/analytics";
import { computeCompliance } from "@/lib/compliance";
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-1 py-1">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export function InsightsPanel() {
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);
  const removeExit = useEditor((s) => s.removeExit);
  const setTool = useEditor((s) => s.setTool);
  const a = React.useMemo(
    () => (project ? computeAnalytics(project) : null),
    [project]
  );
  const compliance = React.useMemo(
    () => (project ? computeCompliance(project) : null),
    [project]
  );

  if (!project || !a || !compliance) return null;

  const labelOf = (id: string) =>
    project.machines.find((m) => m.id === id)?.label ?? id;

  const errors = compliance.violations.filter((v) => v.severity === "error");
  const warns = compliance.violations.filter((v) => v.severity === "warn");
  const passes = errors.length === 0;

  return (
    <div className="space-y-4">
      {/* Egress & aisle compliance */}
      <section
        className="rounded-xl border p-3"
        style={{
          borderColor: passes
            ? "var(--color-success)"
            : "var(--color-destructive)",
        }}
      >
        <div className="flex items-center gap-2">
          {passes ? (
            <ShieldCheck className="h-5 w-5 text-success" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-destructive" />
          )}
          <div className="text-sm font-semibold">
            Egress &amp; aisle compliance
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Exits" value={`${compliance.exitCount}`} />
          <MiniStat
            label="Narrowest aisle"
            value={`${compliance.narrowestAisle} m`}
          />
          <MiniStat
            label="Max travel"
            value={`${compliance.maxTravelDistance} m`}
          />
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground">
          Targets: ≥ {compliance.standard.minExits} exits, ≥{" "}
          {compliance.standard.minAisleWidth} m aisles, ≤{" "}
          {compliance.standard.maxTravelDistance} m to an exit.
        </div>
        {compliance.violations.length > 0 && (
          <ul className="mt-2 space-y-1">
            {[...errors, ...warns].slice(0, 8).map((v, i) => (
              <li
                key={i}
                className={
                  v.severity === "error"
                    ? "rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px]"
                    : "rounded-md border border-warning/40 bg-warning/5 px-2 py-1 text-[11px]"
                }
              >
                {v.message}
              </li>
            ))}
          </ul>
        )}
        <button
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          onClick={() => setTool("place_exit")}
        >
          <DoorOpen className="h-3.5 w-3.5" /> Place an exit on the canvas
        </button>
        {(project.floor.exits?.length ?? 0) > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {project.floor.exits!.map((e, i) => (
              <button
                key={e.id}
                className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                onClick={() => removeExit(e.id)}
                title="Remove exit"
              >
                Exit {i + 1} ✕
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Advisory geometry check (corridor width via distance transform, routed
          travel to nearest exit) — not a stamped code determination. Verify
          against your governing code / AHJ.
        </p>
      </section>

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
