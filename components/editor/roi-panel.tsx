"use client";

import * as React from "react";
import { TrendingDown, AlertTriangle, Gauge } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import {
  computeBusinessCase,
  DEFAULT_ASSUMPTIONS,
  type EconomicAssumptions,
  type StationLoad,
} from "@/lib/economics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function utilColor(u: number) {
  if (u >= 1) return "var(--color-destructive)";
  if (u >= 0.85) return "var(--color-warning)";
  return "var(--color-success)";
}

export function RoiPanel() {
  const project = useEditor((s) => s.project);
  const [a, setA] = React.useState<EconomicAssumptions>(DEFAULT_ASSUMPTIONS);

  const bc = React.useMemo(
    () => (project ? computeBusinessCase(project, a) : null),
    [project, a]
  );

  if (!project || !bc) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Estimated annual material-handling cost
        </div>
        <div className="text-3xl font-bold tabular-nums text-foreground">
          {money(bc.annualTransportCost)}
          <span className="text-sm font-normal text-muted-foreground">/yr</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {bc.routedMetersPerDay.toLocaleString()} m travelled/day ·{" "}
          {bc.annualTransportHours.toLocaleString()} handler-hours/yr
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-primary">
          <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Optimizing the layout shortens these routes — re-run the solver and
          compare the before/after transport cost.
        </p>
      </div>

      {/* Assumptions */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assumptions
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Field
            id="labor"
            label="Labor $/hr"
            value={a.laborRatePerHour}
            onChange={(v) => setA({ ...a, laborRatePerHour: v })}
          />
          <Field
            id="days"
            label="Days/yr"
            value={a.operatingDaysPerYear}
            onChange={(v) => setA({ ...a, operatingDaysPerYear: v })}
          />
          <Field
            id="speed"
            label="Walk m/min"
            value={a.walkingSpeedMetersPerMin}
            onChange={(v) => setA({ ...a, walkingSpeedMetersPerMin: v })}
          />
        </div>
      </section>

      <Separator />

      {/* Bottleneck */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" /> Capacity & bottleneck
        </h3>
        {bc.stations.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Add flows between process machines to see capacity utilization.
          </p>
        ) : (
          <>
            {bc.bottleneck && (
              <div
                className="rounded-md border p-2 text-xs"
                style={{ borderColor: utilColor(bc.bottleneck.utilization) }}
              >
                <span className="font-semibold">Bottleneck:</span>{" "}
                {bc.bottleneck.label} at{" "}
                <span
                  className="font-semibold tabular-nums"
                  style={{ color: utilColor(bc.bottleneck.utilization) }}
                >
                  {Math.round(bc.bottleneck.utilization * 100)}%
                </span>{" "}
                of capacity
                {bc.bottleneck.utilization >= 1 && " — over capacity"}
              </div>
            )}
            <ul className="space-y-1.5">
              {bc.stations.map((s) => (
                <StationBar key={s.id} s={s} />
              ))}
            </ul>
            {bc.overCapacity.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {bc.overCapacity.length} station(s) demand more than their daily
                capacity — add a parallel unit or rebalance flow.
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Estimates only, from your assumptions and routed travel distances.
        Capacity uses typical per-machine defaults unless you set a machine&apos;s
        own value. Not a substitute for a time-study or industrial-engineering
        analysis.
      </p>
    </div>
  );
}

function StationBar({ s }: { s: StationLoad }) {
  const pct = Math.min(100, s.utilization * 100);
  return (
    <li>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="truncate">{s.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {s.load}/{s.capacity} ({Math.round(s.utilization * 100)}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: utilColor(s.utilization) }}
        />
      </div>
    </li>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[10px]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, +e.target.value))}
        className="h-8 text-xs"
      />
    </div>
  );
}
