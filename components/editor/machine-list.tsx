"use client";

import { Lock, LockOpen } from "lucide-react";
import { MACHINE_META } from "@/lib/types";
import { useEditor } from "@/lib/store/editor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function MachineList() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const select = useEditor((s) => s.select);
  const toggleLock = useEditor((s) => s.toggleLock);

  if (!project) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Machines ({project.machines.length})
      </h3>
      <ul className="space-y-1">
        {project.machines.map((m) => (
          <li key={m.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm",
                selectedId === m.id
                  ? "border-primary bg-accent"
                  : "border-transparent hover:bg-accent/50"
              )}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: MACHINE_META[m.type].color }}
                aria-hidden
              />
              <button
                className="flex-1 truncate text-left"
                onClick={() => select(m.id)}
              >
                {m.label}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={m.fixed ? "Unlock machine" : "Lock machine"}
                onClick={() => toggleLock(m.id)}
              >
                {m.fixed ? (
                  <Lock className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </li>
        ))}
        {project.machines.length === 0 && (
          <li className="text-xs text-muted-foreground">
            No machines yet — add some from the palette above.
          </li>
        )}
      </ul>
    </div>
  );
}
