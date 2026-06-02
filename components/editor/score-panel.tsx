"use client";

import * as React from "react";
import { Lightbulb, ArrowRight, Wand2 } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { scoreLayout } from "@/lib/optimizer/scoring";
import { generateSuggestions, type Suggestion } from "@/lib/recommend";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScoreDisplay } from "./score-display";

const kindStyle: Record<Suggestion["kind"], string> = {
  flow: "border-primary/40 bg-primary/5",
  capacity: "border-warning/40 bg-warning/5",
  safety: "border-destructive/40 bg-destructive/5",
  egress: "border-destructive/40 bg-destructive/5",
};

export function ScorePanel() {
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);
  const setMachinePos = useEditor((s) => s.setMachinePos);
  const pushHistory = useEditor((s) => s.pushHistory);

  const score = React.useMemo(
    () => (project ? scoreLayout(project) : null),
    [project]
  );
  const suggestions = React.useMemo(
    () => (project ? generateSuggestions(project) : []),
    [project]
  );

  if (!project || !score) {
    return <p className="text-xs text-muted-foreground">No layout loaded.</p>;
  }

  return (
    <div className="space-y-4">
      <ScoreDisplay score={score} />

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Lightbulb className="h-3.5 w-3.5" /> Suggestions
        </h3>
        {suggestions.length === 0 ? (
          <p className="text-[11px] text-success">
            No high-impact improvements found — this layout looks well balanced.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li
                key={i}
                className={cn("rounded-md border p-2 text-xs", kindStyle[s.kind])}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => s.machineId && select(s.machineId)}
                  >
                    {s.title}
                    {s.gain > 0 && (
                      <span className="ml-1 text-success">
                        +{s.gain.toFixed(1)}
                      </span>
                    )}
                  </button>
                  {s.move && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 shrink-0 px-2 text-[11px]"
                      onClick={() => {
                        pushHistory();
                        select(s.move!.machineId);
                        setMachinePos(s.move!.machineId, s.move!.pos, false);
                      }}
                    >
                      <Wand2 className="h-3 w-3" /> Apply
                    </Button>
                  )}
                </div>
                <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" />
                  {s.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Scores and suggestions come from a transparent heuristic model of machine
        positions, routed flow, capacity and egress. They update live as you
        edit — decision-support, not a code-compliance certification.
      </p>
    </div>
  );
}
