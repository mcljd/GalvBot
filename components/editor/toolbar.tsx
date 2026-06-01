"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Boxes,
  MousePointer2,
  Redo2,
  RotateCw,
  Square,
  Undo2,
  Maximize,
  Route,
  Flame,
} from "lucide-react";
import { useEditor, type EditorTool } from "@/lib/store/editor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { FloorSettings } from "./floor-settings";
import { ExportMenu } from "./export-menu";
import type { CanvasHandle } from "./canvas";

const TOOLS: { id: EditorTool; label: string; icon: React.ElementType }[] = [
  { id: "select", label: "Select / move", icon: MousePointer2 },
  { id: "draw_obstacle", label: "Draw obstacle", icon: Square },
  { id: "draw_nogo", label: "Draw no-go zone", icon: Ban },
];

export function Toolbar({
  canvasRef,
  onFit,
}: {
  canvasRef: React.RefObject<CanvasHandle | null>;
  onFit: () => void;
}) {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const selectedId = useEditor((s) => s.selectedId);
  const rotateMachine = useEditor((s) => s.rotateMachine);
  const showFlows = useEditor((s) => s.showFlows);
  const showHeatmap = useEditor((s) => s.showHeatmap);
  const toggleFlows = useEditor((s) => s.toggleFlows);
  const toggleHeatmap = useEditor((s) => s.toggleHeatmap);
  const renameProject = useEditor((s) => s.renameProject);

  return (
    <div className="flex h-12 items-center gap-1 border-b bg-background px-2">
      <Button asChild variant="ghost" size="icon" aria-label="Back to projects">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <Link href="/" className="mr-1 hidden sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4 w-4" />
        </span>
      </Link>

      <input
        aria-label="Project name"
        className="w-40 truncate rounded-md bg-transparent px-2 py-1 text-sm font-medium hover:bg-accent focus:bg-accent focus:outline-none sm:w-56"
        value={project?.name ?? ""}
        onChange={(e) => renameProject(e.target.value)}
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        {TOOLS.map((t) => (
          <Button
            key={t.id}
            variant={tool === t.id ? "default" : "ghost"}
            size="icon"
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
          >
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        variant="ghost"
        size="icon"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Rotate selected (R)"
        aria-label="Rotate selected machine"
        disabled={!selectedId}
        onClick={() => selectedId && rotateMachine(selectedId)}
      >
        <RotateCw className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        variant={showFlows ? "secondary" : "ghost"}
        size="icon"
        title="Toggle flow lines"
        aria-label="Toggle flow lines"
        aria-pressed={showFlows}
        onClick={toggleFlows}
      >
        <Route className="h-4 w-4" />
      </Button>
      <Button
        variant={showHeatmap ? "secondary" : "ghost"}
        size="icon"
        title="Toggle flow heatmap"
        aria-label="Toggle flow heatmap"
        aria-pressed={showHeatmap}
        onClick={toggleHeatmap}
      >
        <Flame className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Fit to view"
        aria-label="Fit to view"
        onClick={onFit}
      >
        <Maximize className="h-4 w-4" />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <FloorSettings />
        <ExportMenu canvasRef={canvasRef} />
        <ThemeToggle />
      </div>
    </div>
  );
}
