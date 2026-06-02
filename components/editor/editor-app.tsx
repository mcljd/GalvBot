"use client";

import * as React from "react";
import Link from "next/link";
import { useEditor } from "@/lib/store/editor";
import { getStorageProvider } from "@/lib/storage";
import { makeDemoProject, DEMO_PROJECT_ID } from "@/lib/seed/demo";
import { computeFlowHeatmap } from "@/lib/flow/heatmap";
import { Button } from "@/components/ui/button";
import { LayoutCanvas, type CanvasHandle } from "./canvas";
import { Toolbar } from "./toolbar";
import { MachinePalette } from "./machine-palette";
import { MachineList } from "./machine-list";
import { MachineProperties } from "./machine-properties";
import { RightPanel } from "./right-panel";

export function EditorApp({ projectId }: { projectId: string }) {
  const project = useEditor((s) => s.project);
  const load = useEditor((s) => s.load);
  const reset = useEditor((s) => s.reset);
  const showHeatmap = useEditor((s) => s.showHeatmap);
  const [status, setStatus] = React.useState<"loading" | "ready" | "notfound">(
    "loading"
  );
  const canvasRef = React.useRef<CanvasHandle | null>(null);

  // load project from storage (or seed the demo if requested by id)
  React.useEffect(() => {
    let active = true;
    (async () => {
      const store = getStorageProvider();
      let p = await store.get(projectId);
      if (!p && projectId === DEMO_PROJECT_ID) {
        p = makeDemoProject();
        await store.save(p);
      }
      if (!active) return;
      if (p) {
        load(p);
        setStatus("ready");
      } else {
        setStatus("notfound");
      }
    })();
    return () => {
      active = false;
      reset();
    };
  }, [projectId, load, reset]);

  // keyboard shortcuts
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.getAttribute?.("role") === "textbox";
      const s = useEditor.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (typing) return;
      if (e.key.startsWith("Arrow") && s.selectedId && s.project) {
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : s.project.floor.gridResolution;
        const d =
          e.key === "ArrowLeft"
            ? [-step, 0]
            : e.key === "ArrowRight"
              ? [step, 0]
              : e.key === "ArrowUp"
                ? [0, -step]
                : [0, step];
        s.nudgeMachine(s.selectedId, d[0], d[1]);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        if (s.selectedId) s.rotateMachine(s.selectedId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedId) s.removeMachine(s.selectedId);
      } else if (e.key === "l" || e.key === "L") {
        if (s.selectedId) s.toggleLock(s.selectedId);
      } else if (e.key === "Escape") {
        s.select(null);
        s.setTool("select");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const heatmap = React.useMemo(
    () => (project && showHeatmap ? computeFlowHeatmap(project) : null),
    [project, showHeatmap]
  );

  if (status === "notfound") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold">Project not found</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted or never existed on this device.
        </p>
        <Button asChild>
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Toolbar canvasRef={canvasRef} onFit={() => canvasRef.current?.fit()} />
      <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[260px_1fr_340px] lg:overflow-hidden">
        {/* Left: palette + machines + properties */}
        <aside className="flex flex-col gap-4 overflow-y-auto border-r p-3 lg:max-h-full">
          <MachinePalette />
          <MachineList />
          <MachineProperties />
        </aside>

        {/* Center: canvas */}
        <div className="relative min-h-[60vh] bg-canvas-bg lg:min-h-0">
          {status === "ready" ? (
            <LayoutCanvas ref={canvasRef} heatmap={heatmap} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading layout…
            </div>
          )}
        </div>

        {/* Right: solver / score / flows */}
        <aside className="border-l">
          <RightPanel />
        </aside>
      </div>
    </div>
  );
}
