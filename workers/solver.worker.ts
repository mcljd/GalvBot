/// <reference lib="webworker" />
import { anneal } from "../lib/optimizer/anneal";
import type { LayoutProject, SolverSettings } from "../lib/types";

export type SolverRequest = {
  type: "run";
  project: LayoutProject;
  settings: SolverSettings;
  startFromCurrent: boolean;
};

export type SolverResponse =
  | {
      type: "progress";
      iteration: number;
      total: number;
      bestTotal: number;
    }
  | {
      type: "done";
      result: ReturnType<typeof anneal>;
    };

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  const msg = e.data;
  if (msg.type !== "run") return;

  const result = anneal(msg.project, {
    settings: msg.settings,
    startFromCurrent: msg.startFromCurrent,
    onProgress: (p) => {
      const res: SolverResponse = {
        type: "progress",
        iteration: p.iteration,
        total: p.total,
        bestTotal: p.bestTotal,
      };
      (self as unknown as Worker).postMessage(res);
    },
  });

  const done: SolverResponse = { type: "done", result };
  (self as unknown as Worker).postMessage(done);
};
