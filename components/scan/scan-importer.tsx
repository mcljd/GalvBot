"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, Ruler, Loader2, ArrowLeft, Info } from "lucide-react";
import type { Vec2 } from "@/lib/types";
import type { FloorProposal } from "@/lib/scan/types";
import { getStorageProvider } from "@/lib/storage";
import { createEmptyProject } from "@/lib/project";
import { extractFloorInBrowser } from "@/lib/scan/browser";
import { uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Step = "upload" | "review";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ScanImporter() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("upload");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<FloorProposal | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // calibration: two points in ORIGINAL image-pixel coords + a real distance
  const [points, setPoints] = React.useState<Vec2[]>([]);
  const [realDistance, setRealDistance] = React.useState<number>(5);
  const [name, setName] = React.useState("Imported floor");
  const imgRef = React.useRef<HTMLImageElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    setPoints([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      let proposal: FloorProposal | null = null;
      // Prefer the server route (sharp); fall back to in-browser extraction
      // when no Node server is available (e.g. the static GitHub Pages demo).
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`${BASE_PATH}/api/scan`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          const json = await res.json();
          proposal = json.proposal as FloorProposal;
        }
      } catch {
        // ignore — fall back to browser extraction below
      }
      if (!proposal) {
        proposal = await extractFloorInBrowser(file);
      }
      setProposal(proposal);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function onImageClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!proposal || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = proposal.imageWidth / rect.width;
    const scaleY = proposal.imageHeight / rect.height;
    const p = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  }

  const pixelDist =
    points.length === 2
      ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
      : 0;
  const metersPerPixel =
    pixelDist > 0 && realDistance > 0 ? realDistance / pixelDist : 0;
  const calibrated = metersPerPixel > 0;

  function handleCreate() {
    if (!proposal || !calibrated) return;
    const bMinX = Math.min(...proposal.boundary.map((p) => p.x));
    const bMinY = Math.min(...proposal.boundary.map((p) => p.y));
    const toM = (p: Vec2): Vec2 => ({
      x: (p.x - bMinX) * metersPerPixel,
      y: (p.y - bMinY) * metersPerPixel,
    });

    const floor = {
      id: uid("floor"),
      name,
      boundary: proposal.boundary.map(toM),
      obstacles: proposal.obstacles.map((o) => ({
        id: uid("obs"),
        polygon: o.polygon.map(toM),
        label: o.label,
      })),
      docks: [],
      gridResolution: 0.5,
    };
    const project = createEmptyProject(name, floor);
    void getStorageProvider()
      .save(project)
      .then(() => router.push(`/editor?id=${project.id}`));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/projects">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Import a floor scan</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a top-down blueprint or photo. We&apos;ll propose a boundary and
        obstacle hints — you review, calibrate the real-world scale, and we drop
        you into the editor to refine.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {step === "upload" && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center hover:bg-accent/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <div className="font-medium">
                  {loading ? "Analyzing image…" : "Drop an image or click to upload"}
                </div>
                <div className="text-xs text-muted-foreground">
                  PNG / JPG blueprint or top-down photo, up to 12 MB
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            <div className="mt-3 text-center text-xs text-muted-foreground">
              No file handy?{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                disabled={loading}
                onClick={async () => {
                  const res = await fetch(`${BASE_PATH}/sample-floor-scan.png`);
                  const blob = await res.blob();
                  handleFile(
                    new File([blob], "sample-floor-scan.png", {
                      type: "image/png",
                    })
                  );
                }}
              >
                Try a sample blueprint
              </button>
              .
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && proposal && previewUrl && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div
              className="relative inline-block w-full cursor-crosshair select-none overflow-hidden rounded-lg border"
              onClick={onImageClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={previewUrl}
                alt="Uploaded floor scan"
                className="block w-full"
              />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${proposal.imageWidth} ${proposal.imageHeight}`}
                preserveAspectRatio="none"
              >
                <polygon
                  points={proposal.boundary.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(249,115,22,0.12)"
                  stroke="#f97316"
                  strokeWidth={proposal.imageWidth / 250}
                />
                {proposal.obstacles.map((o, i) => (
                  <polygon
                    key={i}
                    points={o.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="rgba(100,116,139,0.35)"
                    stroke="#64748b"
                    strokeWidth={proposal.imageWidth / 350}
                  />
                ))}
                {points.length === 2 && (
                  <line
                    x1={points[0].x}
                    y1={points[0].y}
                    x2={points[1].x}
                    y2={points[1].y}
                    stroke="#22c55e"
                    strokeWidth={proposal.imageWidth / 200}
                  />
                )}
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={proposal.imageWidth / 120}
                    fill="#22c55e"
                  />
                ))}
              </svg>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" /> {proposal.note}
            </p>
          </div>

          <aside className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Confidence {Math.round(proposal.confidence * 100)}%
              </Badge>
              <Badge variant="outline">
                {proposal.obstacles.length} obstacles
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scan-name">Project name</Label>
              <Input
                id="scan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Ruler className="h-4 w-4" /> Scale calibration
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                Click two points on the image across a feature of known length
                (a wall, a doorway), then enter its real distance.
              </p>
              <div className="mb-2 text-xs">
                Points set:{" "}
                <span className="font-medium">{points.length} / 2</span>
                {points.length === 2 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({Math.round(pixelDist)} px)
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="real-dist">Real distance (m)</Label>
                <Input
                  id="real-dist"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={realDistance}
                  onChange={(e) => setRealDistance(+e.target.value)}
                />
              </div>
              {calibrated && (
                <p className="mt-2 text-xs text-success">
                  Scale: {(metersPerPixel * 100).toFixed(2)} cm / px ·{" "}
                  {(
                    (proposal.boundary[1].x - proposal.boundary[0].x) *
                    metersPerPixel
                  ).toFixed(1)}{" "}
                  ×{" "}
                  {(
                    (proposal.boundary[2].y - proposal.boundary[1].y) *
                    metersPerPixel
                  ).toFixed(1)}{" "}
                  m floor
                </p>
              )}
              {points.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs"
                  onClick={() => setPoints([])}
                >
                  Reset points
                </Button>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!calibrated}
              onClick={handleCreate}
            >
              Create project & open editor
            </Button>
            {!calibrated && (
              <p className="text-center text-[11px] text-muted-foreground">
                Calibration is required before continuing.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
