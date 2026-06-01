"use client";

import * as React from "react";
import type {
  LayoutProject,
  OptimizationResult,
  SolverSettings,
} from "@/lib/types";
import { anneal } from "@/lib/optimizer/anneal";
import type {
  SolverRequest,
  SolverResponse,
} from "@/workers/solver.worker";

export type OptimizerStatus = "idle" | "running" | "done" | "stopped";

export interface OptimizerProgress {
  iteration: number;
  total: number;
  bestTotal: number;
}

/**
 * Runs the simulated-annealing solver in a Web Worker so the UI stays
 * responsive, streaming progress back. Falls back to running on the main
 * thread if Workers are unavailable (e.g. some test environments).
 */
export function useOptimizer() {
  const [status, setStatus] = React.useState<OptimizerStatus>("idle");
  const [progress, setProgress] = React.useState<OptimizerProgress | null>(null);
  const [result, setResult] = React.useState<OptimizationResult | null>(null);
  const workerRef = React.useRef<Worker | null>(null);

  const cleanup = React.useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  const run = React.useCallback(
    (
      project: LayoutProject,
      settings: SolverSettings,
      startFromCurrent: boolean
    ) => {
      cleanup();
      setResult(null);
      setProgress({ iteration: 0, total: 0, bestTotal: 0 });
      setStatus("running");

      if (typeof Worker === "undefined") {
        // Synchronous fallback.
        const res = anneal(project, {
          settings,
          startFromCurrent,
          onProgress: (p) =>
            setProgress({
              iteration: p.iteration,
              total: p.total,
              bestTotal: p.bestTotal,
            }),
        });
        setResult(res);
        setStatus("done");
        return;
      }

      const worker = new Worker(
        new URL("../workers/solver.worker.ts", import.meta.url)
      );
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<SolverResponse>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setProgress({
            iteration: msg.iteration,
            total: msg.total,
            bestTotal: msg.bestTotal,
          });
        } else if (msg.type === "done") {
          setResult(msg.result);
          setStatus("done");
          cleanup();
        }
      };
      const req: SolverRequest = {
        type: "run",
        project,
        settings,
        startFromCurrent,
      };
      worker.postMessage(req);
    },
    [cleanup]
  );

  const stop = React.useCallback(() => {
    cleanup();
    setStatus((s) => (s === "running" ? "stopped" : s));
  }, [cleanup]);

  const dismiss = React.useCallback(() => {
    setResult(null);
    setProgress(null);
    setStatus("idle");
  }, []);

  return { status, progress, result, run, stop, dismiss };
}
