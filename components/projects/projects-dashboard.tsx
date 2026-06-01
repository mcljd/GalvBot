"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Plus, Trash2, MapPinned, ScanLine } from "lucide-react";
import type { LayoutProject } from "@/lib/types";
import { useProjects } from "@/hooks/use-projects";
import { bbox } from "@/lib/geometry";
import { round } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectThumbnail } from "./project-thumbnail";

export function ProjectsDashboard() {
  const router = useRouter();
  const { projects, loading, create, duplicate, remove } = useProjects();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function handleCreate() {
    setBusy(true);
    const p = await create(name.trim() || "Untitled Layout");
    setBusy(false);
    setOpen(false);
    setName("");
    router.push(`/editor?id=${p.id}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project is a factory floor layout you can edit, optimize, and
            export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/import">
              <ScanLine className="h-4 w-4" /> Import scan
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>
                Start with a blank 24 × 16 m floor. You can resize the boundary,
                draw obstacles, or import a scan inside the editor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                placeholder="e.g. Line 3 Retrofit"
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={busy}>
                Create & open
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onDuplicate={() => duplicate(p)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onDuplicate,
  onDelete,
}: {
  project: LayoutProject;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const b = bbox(project.floor.boundary);
  return (
    <Card className="group overflow-hidden">
      <Link
        href={`/editor?id=${project.id}`}
        className="block aspect-video border-b bg-canvas-bg"
      >
        <ProjectThumbnail project={project} className="h-full w-full" />
      </Link>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/editor?id=${project.id}`}
            className="font-semibold hover:underline"
          >
            {project.name}
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="secondary">{project.machines.length} machines</Badge>
          <Badge variant="outline">
            {round(b.w, 0)} × {round(b.h, 0)} m
          </Badge>
          <Badge variant="outline">{project.flows.length} flows</Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Updated {new Date(project.updatedAt).toLocaleString()}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button asChild size="sm" className="flex-1">
          <Link href={`/editor?id=${project.id}`}>
            <MapPinned className="h-4 w-4" /> Open
          </Link>
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Duplicate project"
          onClick={onDuplicate}
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Delete project"
          onClick={() => {
            if (confirm(`Delete "${project.name}"? This cannot be undone.`))
              onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Create your first factory layout to start optimizing material flow,
        safety, and utilization.
      </p>
      <Button className="mt-4" onClick={onNew}>
        <Plus className="h-4 w-4" /> New project
      </Button>
    </div>
  );
}
