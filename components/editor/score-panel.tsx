"use client";

import * as React from "react";
import { useEditor } from "@/lib/store/editor";
import { scoreLayout } from "@/lib/optimizer/scoring";
import { ScoreDisplay } from "./score-display";

export function ScorePanel() {
  const project = useEditor((s) => s.project);
  const score = React.useMemo(
    () => (project ? scoreLayout(project) : null),
    [project]
  );

  if (!project || !score) {
    return (
      <p className="text-xs text-muted-foreground">No layout loaded.</p>
    );
  }

  return (
    <div className="space-y-4">
      <ScoreDisplay score={score} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Scores are computed by a transparent heuristic model from the current
        machine positions, flow throughput, and your safety rules. They update
        live as you edit. This is decision-support, not a code-compliance
        certification.
      </p>
    </div>
  );
}
