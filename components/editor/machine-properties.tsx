"use client";

import { Copy, RotateCw, Trash2 } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export function MachineProperties() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const updateMachine = useEditor((s) => s.updateMachine);
  const rotateMachine = useEditor((s) => s.rotateMachine);
  const toggleLock = useEditor((s) => s.toggleLock);
  const duplicateMachine = useEditor((s) => s.duplicateMachine);
  const removeMachine = useEditor((s) => s.removeMachine);

  const m = project?.machines.find((x) => x.id === selectedId);
  if (!m) {
    return (
      <p className="text-xs text-muted-foreground">
        Select a machine on the canvas to edit its properties.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Properties
      </h3>

      <div className="space-y-1.5">
        <Label htmlFor="m-label">Label</Label>
        <Input
          id="m-label"
          value={m.label}
          onChange={(e) => updateMachine(m.id, { label: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="m-w">Width (m)</Label>
          <Input
            id="m-w"
            type="number"
            min={0.2}
            step={0.1}
            value={m.footprint.w}
            onChange={(e) =>
              updateMachine(m.id, {
                footprint: { ...m.footprint, w: Math.max(0.2, +e.target.value) },
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-d">Depth (m)</Label>
          <Input
            id="m-d"
            type="number"
            min={0.2}
            step={0.1}
            value={m.footprint.d}
            onChange={(e) =>
              updateMachine(m.id, {
                footprint: { ...m.footprint, d: Math.max(0.2, +e.target.value) },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="m-clear">Clearance (m)</Label>
        <Input
          id="m-clear"
          type="number"
          min={0}
          step={0.1}
          value={m.clearance}
          onChange={(e) =>
            updateMachine(m.id, { clearance: Math.max(0, +e.target.value) })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="m-heat">Heat output</Label>
        <select
          id="m-heat"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={m.heatOutput ?? "low"}
          onChange={(e) =>
            updateMachine(m.id, {
              heatOutput: e.target.value as "low" | "med" | "high",
            })
          }
        >
          <option value="low">Low</option>
          <option value="med">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="m-lock" className="cursor-pointer">
          Lock position
        </Label>
        <Switch
          id="m-lock"
          checked={!!m.fixed}
          onCheckedChange={() => toggleLock(m.id)}
        />
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => rotateMachine(m.id)}>
          <RotateCw className="h-4 w-4" /> Rotate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => duplicateMachine(m.id)}
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => removeMachine(m.id)}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Rotation: {m.rotationDeg ?? 0}° · Position:{" "}
        {m.pos ? `${m.pos.x.toFixed(1)}, ${m.pos.y.toFixed(1)} m` : "—"}
      </p>
    </div>
  );
}
