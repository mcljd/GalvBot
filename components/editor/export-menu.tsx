"use client";

import * as React from "react";
import { Download, FileJson, Image as ImageIcon } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CanvasHandle } from "./canvas";

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ExportMenu({
  canvasRef,
}: {
  canvasRef: React.RefObject<CanvasHandle | null>;
}) {
  const project = useEditor((s) => s.project);
  const [open, setOpen] = React.useState(false);

  if (!project) return null;
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  function exportPng() {
    const url = canvasRef.current?.toDataURL();
    if (url) triggerDownload(url, `${slug}.png`);
    setOpen(false);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    triggerDownload(URL.createObjectURL(blob), `${slug}.json`);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Download className="h-4 w-4" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export layout</DialogTitle>
          <DialogDescription>
            Download the current layout in your preferred format.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={exportPng}>
            <ImageIcon className="h-4 w-4" /> PNG image of the canvas
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={exportJson}
          >
            <FileJson className="h-4 w-4" /> JSON project file
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
