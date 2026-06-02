"use client";

import { AlertTriangle, XCircle } from "lucide-react";
import type { LayoutScore } from "@/lib/types";
import { cn } from "@/lib/utils";

function scoreColor(v: number) {
  if (v >= 80) return "var(--color-success)";
  if (v >= 55) return "var(--color-warning)";
  return "var(--color-destructive)";
}

/** Text qualifier so quality isn't conveyed by color alone (WCAG 1.4.1). */
export function scoreLabel(v: number) {
  if (v >= 80) return "good";
  if (v >= 55) return "fair";
  return "poor";
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value.toFixed(1)}
          <span className="ml-1 font-normal text-muted-foreground">
            ({scoreLabel(value)})
          </span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value.toFixed(1)} out of 100, ${scoreLabel(value)}`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
    </div>
  );
}

export function ScoreDisplay({
  score,
  compact = false,
}: {
  score: LayoutScore;
  compact?: boolean;
}) {
  const errors = score.violations.filter((v) => v.severity === "error");
  const warns = score.violations.filter((v) => v.severity === "warn");

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Composite score
          </div>
          <div
            className="text-4xl font-bold tabular-nums"
            style={{ color: scoreColor(score.total) }}
          >
            {score.total.toFixed(1)}
            <span className="ml-2 align-middle text-sm font-medium capitalize text-muted-foreground">
              {scoreLabel(score.total)}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          higher is better
          <br />
          0–100 scale
        </div>
      </div>

      <div className="space-y-3">
        <Bar label="Material flow" value={score.materialFlow} />
        <Bar label="Worker safety" value={score.safety} />
        <Bar label="Utilization" value={score.utilization} />
      </div>

      {!compact && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-destructive">
              <XCircle className="h-3.5 w-3.5" /> {errors.length} errors
            </span>
            <span className="flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3.5 w-3.5" /> {warns.length} warnings
            </span>
          </div>
          {score.violations.length === 0 ? (
            <p className="text-xs text-success">
              No safety violations detected.
            </p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {[...errors, ...warns].map((v, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs",
                    v.severity === "error"
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-warning/40 bg-warning/5"
                  )}
                >
                  {v.severity === "error" ? (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  )}
                  <span>{v.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
