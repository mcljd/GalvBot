"use client";

import { MACHINE_META, type MachineType } from "@/lib/types";
import { useEditor, selectFloorBBox } from "@/lib/store/editor";
import { Button } from "@/components/ui/button";

const ORDER: MachineType[] = [
  "3d_printer",
  "cnc",
  "post_processing",
  "qc_inspection",
  "assembly_station",
  "packaging",
  "raw_material",
  "storage_rack",
];

export function MachinePalette() {
  const addMachine = useEditor((s) => s.addMachine);
  const project = useEditor((s) => s.project);

  function add(type: MachineType) {
    const b = selectFloorBBox(project);
    const meta = MACHINE_META[type];
    // drop near the floor center
    addMachine(type, {
      x: b.x + b.w / 2 - meta.defaultFootprint.w / 2,
      y: b.y + b.h / 2 - meta.defaultFootprint.d / 2,
    });
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Add equipment
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ORDER.map((type) => {
          const meta = MACHINE_META[type];
          return (
            <Button
              key={type}
              variant="outline"
              size="sm"
              className="h-auto justify-start gap-2 py-2 text-left"
              onClick={() => add(type)}
              title={`Add ${meta.label}`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              <span className="truncate text-xs">{meta.label}</span>
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Click to add at floor center, then drag into place.
      </p>
    </div>
  );
}
