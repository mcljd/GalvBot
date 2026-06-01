"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { bbox } from "@/lib/geometry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Lightweight scale/floor calibration for manually-drawn floors: set the bay
 * dimensions in meters and the solver grid resolution. (Photo-scan import uses
 * the dedicated two-point pixel calibration flow.)
 */
export function FloorSettings() {
  const project = useEditor((s) => s.project);
  const updateFloor = useEditor((s) => s.updateFloor);
  const [open, setOpen] = React.useState(false);

  if (!project) return null;
  const b = bbox(project.floor.boundary);

  function setSize(w: number, h: number) {
    updateFloor({
      boundary: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" /> Floor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Floor & scale</DialogTitle>
          <DialogDescription>
            Dimensions are in real-world meters. The grid resolution controls how
            finely the solver discretizes the floor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-w">Width (m)</Label>
            <Input
              id="f-w"
              type="number"
              min={4}
              step={0.5}
              defaultValue={Math.round(b.w)}
              onChange={(e) =>
                setSize(Math.max(4, +e.target.value), Math.round(b.h))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-h">Height (m)</Label>
            <Input
              id="f-h"
              type="number"
              min={4}
              step={0.5}
              defaultValue={Math.round(b.h)}
              onChange={(e) =>
                setSize(Math.round(b.w), Math.max(4, +e.target.value))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-grid">Grid resolution (m / cell)</Label>
          <Input
            id="f-grid"
            type="number"
            min={0.25}
            max={2}
            step={0.25}
            value={project.floor.gridResolution}
            onChange={(e) =>
              updateFloor({
                gridResolution: Math.min(2, Math.max(0.25, +e.target.value)),
              })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Changing dimensions resets the boundary to a rectangle. Obstacles and
          no-go zones are preserved.
        </p>
      </DialogContent>
    </Dialog>
  );
}
