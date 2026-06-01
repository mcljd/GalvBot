import type { LayoutProject } from "@/lib/types";
import { MACHINE_META } from "@/lib/types";
import { bbox, rotatedFootprint } from "@/lib/geometry";

/** Lightweight SVG preview of a layout — no Konva, safe for lists/SSR. */
export function ProjectThumbnail({
  project,
  className,
}: {
  project: LayoutProject;
  className?: string;
}) {
  const b = bbox(project.floor.boundary);
  const pad = Math.max(b.w, b.h) * 0.04 + 0.5;
  const vb = `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
  const stroke = Math.max(b.w, b.h) / 200;

  return (
    <svg
      viewBox={vb}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Layout preview for ${project.name}`}
    >
      {/* floor */}
      <polygon
        points={project.floor.boundary.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="var(--color-canvas-bg)"
        stroke="var(--color-border)"
        strokeWidth={stroke * 2}
      />
      {/* obstacles */}
      {project.floor.obstacles.map((o) => (
        <polygon
          key={o.id}
          points={o.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="var(--color-muted-foreground)"
          opacity={0.5}
        />
      ))}
      {/* no-go zones */}
      {project.safetyRules
        .filter((r) => r.kind === "no_go_zone" && r.zone)
        .map((r, i) => (
          <polygon
            key={`nogo-${i}`}
            points={r.zone!.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="var(--color-destructive)"
            opacity={0.15}
          />
        ))}
      {/* machines */}
      {project.machines.map((m) => {
        if (!m.pos) return null;
        const f = rotatedFootprint(m);
        return (
          <rect
            key={m.id}
            x={m.pos.x}
            y={m.pos.y}
            width={f.w}
            height={f.d}
            rx={stroke}
            fill={MACHINE_META[m.type].color}
            opacity={0.85}
          />
        );
      })}
      {/* docks */}
      {project.floor.docks.map((d) => (
        <circle
          key={d.id}
          cx={d.pos.x}
          cy={d.pos.y}
          r={Math.max(b.w, b.h) / 60}
          fill={d.type === "inbound" ? "var(--color-success)" : "var(--color-primary)"}
        />
      ))}
    </svg>
  );
}
