"use client";

import * as React from "react";
import { Download, FileJson, FileText, Image as ImageIcon } from "lucide-react";
import { useEditor } from "@/lib/store/editor";
import { scoreLayout } from "@/lib/optimizer/scoring";
import { computeBusinessCase } from "@/lib/economics";
import { computeCompliance } from "@/lib/compliance";
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

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve({ w: 16, h: 9 });
    im.src = dataUrl;
  });
}

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

  async function exportPdf() {
    if (!project) return;
    const { jsPDF } = await import("jspdf");
    const score = scoreLayout(project);
    const bc = computeBusinessCase(project);
    const comp = computeCompliance(project);
    const img = canvasRef.current?.toDataURL();

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    doc.setFontSize(18);
    doc.text("GalvBot — Layout Summary", margin, y);
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(project.name, margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString(), margin, y);
    doc.setTextColor(0);
    y += 6;

    if (img) {
      const { w, h } = await imageSize(img);
      const drawH = Math.min(120, (contentW * h) / w);
      const drawW = (drawH * w) / h;
      doc.addImage(img, "PNG", margin, y, drawW, drawH);
      y += drawH + 8;
    }

    doc.setFontSize(13);
    doc.text("Score breakdown", margin, y);
    y += 6;
    doc.setFontSize(11);
    const rows: [string, number][] = [
      ["Composite", score.total],
      ["Material flow", score.materialFlow],
      ["Worker safety", score.safety],
      ["Utilization", score.utilization],
    ];
    for (const [label, val] of rows) {
      doc.setTextColor(80);
      doc.text(label, margin, y);
      doc.setTextColor(0);
      doc.text(`${val.toFixed(1)} / 100`, margin + 60, y);
      y += 6;
    }

    // Operating economics
    y += 4;
    doc.setFontSize(13);
    doc.text("Operating economics (estimated)", margin, y);
    y += 6;
    doc.setFontSize(11);
    const econ: [string, string][] = [
      [
        "Annual material handling",
        `$${bc.annualTransportCost.toLocaleString()}/yr`,
      ],
      ["Material travel", `${bc.routedMetersPerDay.toLocaleString()} m/day`],
      [
        "Bottleneck",
        bc.bottleneck
          ? `${bc.bottleneck.label} (${Math.round(
              bc.bottleneck.utilization * 100
            )}% capacity)`
          : "none identified",
      ],
    ];
    for (const [label, val] of econ) {
      doc.setTextColor(80);
      doc.text(label, margin, y);
      doc.setTextColor(0);
      doc.text(val, margin + 60, y);
      y += 6;
    }

    // Egress & aisle compliance
    y += 4;
    doc.setFontSize(13);
    doc.text("Egress & aisle compliance (advisory)", margin, y);
    y += 6;
    doc.setFontSize(11);
    const egress: [string, string][] = [
      ["Egress doors", `${comp.exitCount} (target ≥ ${comp.standard.minExits})`],
      [
        "Narrowest aisle",
        `${comp.narrowestAisle} m (min ${comp.standard.minAisleWidth} m)`,
      ],
      [
        "Max travel to exit",
        `${comp.maxTravelDistance} m (max ${comp.standard.maxTravelDistance} m)`,
      ],
    ];
    for (const [label, val] of egress) {
      doc.setTextColor(80);
      doc.text(label, margin, y);
      doc.setTextColor(0);
      doc.text(val, margin + 60, y);
      y += 6;
    }

    y += 4;
    doc.setFontSize(13);
    doc.text(`Violations (${score.violations.length})`, margin, y);
    y += 6;
    doc.setFontSize(10);
    if (score.violations.length === 0) {
      doc.setTextColor(0, 140, 80);
      doc.text("No safety violations detected.", margin, y);
      doc.setTextColor(0);
    } else {
      for (const v of score.violations) {
        if (y > 280) {
          doc.addPage();
          y = margin;
        }
        const prefix = v.severity === "error" ? "[ERROR] " : "[warn]  ";
        const lines = doc.splitTextToSize(prefix + v.message, contentW);
        if (v.severity === "error") doc.setTextColor(200, 40, 40);
        else doc.setTextColor(180, 130, 0);
        doc.text(lines, margin, y);
        y += lines.length * 5;
      }
      doc.setTextColor(0);
    }

    y = Math.min(y + 6, 290);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
      doc.splitTextToSize(
        "Generated by GalvBot using a heuristic layout optimizer and a transparent flow model. Decision-support only — not a code-compliance certification.",
        contentW
      ),
      margin,
      Math.min(y, 288)
    );

    doc.save(`${slug}-summary.pdf`);
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
          <Button
            variant="outline"
            className="justify-start"
            onClick={exportPdf}
          >
            <FileText className="h-4 w-4" /> One-page PDF summary
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
