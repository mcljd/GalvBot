"use client";

import * as React from "react";
import { Stage, Layer, Rect, Line, Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { useEditor } from "@/lib/store/editor";
import { MACHINE_META, type Machine, type Vec2 } from "@/lib/types";
import { bbox, machineCenter, rotatedFootprint } from "@/lib/geometry";
import { computeSnap } from "@/lib/editor/snap";
import { useElementSize } from "@/hooks/use-element-size";
import type { HeatmapField } from "@/lib/flow/heatmap";

interface View {
  scale: number; // pixels per meter
  x: number; // stage offset px
  y: number;
}

export interface CanvasHandle {
  /** Returns a PNG data URL of the current canvas. */
  toDataURL: () => string | null;
  fit: () => void;
}

interface CanvasProps {
  heatmap?: HeatmapField | null;
}

export const LayoutCanvas = React.forwardRef<CanvasHandle, CanvasProps>(
  function LayoutCanvas({ heatmap }, ref) {
    const { ref: boxRef, width, height } = useElementSize<HTMLDivElement>();
    const stageRef = React.useRef<Konva.Stage>(null);

    const project = useEditor((s) => s.project);
    const selectedId = useEditor((s) => s.selectedId);
    const tool = useEditor((s) => s.tool);
    const showFlows = useEditor((s) => s.showFlows);
    const showHeatmap = useEditor((s) => s.showHeatmap);
    const select = useEditor((s) => s.select);
    const setMachinePos = useEditor((s) => s.setMachinePos);
    const pushHistory = useEditor((s) => s.pushHistory);
    const addSafetyRule = useEditor((s) => s.addSafetyRule);
    const updateFloor = useEditor((s) => s.updateFloor);

    const [view, setView] = React.useState<View>({ scale: 20, x: 0, y: 0 });
    const [draft, setDraft] = React.useState<{ start: Vec2; end: Vec2 } | null>(
      null
    );
    const [guides, setGuides] = React.useState<{ x?: number; y?: number }>({});

    const floorBox = React.useMemo(
      () => (project ? bbox(project.floor.boundary) : { x: 0, y: 0, w: 0, h: 0 }),
      [project]
    );

    const fit = React.useCallback(() => {
      if (!project || width === 0 || height === 0) return;
      const b = bbox(project.floor.boundary);
      const pad = 40;
      const scale = Math.min(
        (width - pad * 2) / (b.w || 1),
        (height - pad * 2) / (b.h || 1)
      );
      setView({
        scale,
        x: (width - b.w * scale) / 2 - b.x * scale,
        y: (height - b.h * scale) / 2 - b.y * scale,
      });
    }, [project, width, height]);

    // fit when project or size first becomes available
    const fittedRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      if (project && width && height && fittedRef.current !== project.id) {
        fit();
        fittedRef.current = project.id;
      }
    }, [project, width, height, fit]);

    React.useImperativeHandle(ref, () => ({
      toDataURL: () =>
        stageRef.current
          ? stageRef.current.toDataURL({ pixelRatio: 2 })
          : null,
      fit,
    }));

    const toMeters = React.useCallback(
      (px: { x: number; y: number }): Vec2 => ({
        x: (px.x - view.x) / view.scale,
        y: (px.y - view.y) / view.scale,
      }),
      [view]
    );

    if (!project) return <div ref={boxRef} className="h-full w-full" />;

    const grid = project.floor.gridResolution;
    const machineById = (id: string) => project.machines.find((m) => m.id === id);

    function clampMachine(m: Machine, pos: Vec2): Vec2 {
      const f = rotatedFootprint(m);
      return {
        x: Math.min(Math.max(floorBox.x, pos.x), floorBox.x + floorBox.w - f.w),
        y: Math.min(Math.max(floorBox.y, pos.y), floorBox.y + floorBox.h - f.d),
      };
    }

    function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const oldScale = view.scale;
      const dir = e.evt.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(120, Math.max(4, oldScale * dir));
      const mx = (pointer.x - view.x) / oldScale;
      const my = (pointer.y - view.y) / oldScale;
      setView({
        scale: newScale,
        x: pointer.x - mx * newScale,
        y: pointer.y - my * newScale,
      });
    }

    // background drawing / panning
    function onStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
      if (e.target !== e.target.getStage() && e.target.name() !== "floor")
        return;
      if (tool === "select") {
        select(null);
        return;
      }
      const stage = stageRef.current!;
      const p = toMeters(stage.getPointerPosition()!);
      setDraft({ start: p, end: p });
    }

    function onStageMouseMove() {
      if (!draft) return;
      const stage = stageRef.current!;
      setDraft({ ...draft, end: toMeters(stage.getPointerPosition()!) });
    }

    function onStageMouseUp() {
      if (!draft) return;
      const x = Math.min(draft.start.x, draft.end.x);
      const y = Math.min(draft.start.y, draft.end.y);
      const w = Math.abs(draft.end.x - draft.start.x);
      const h = Math.abs(draft.end.y - draft.start.y);
      setDraft(null);
      if (w < 0.3 || h < 0.3) return;
      const poly: Vec2[] = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      if (tool === "draw_obstacle") {
        updateFloor({
          obstacles: [
            ...project!.floor.obstacles,
            { id: `obs_${Date.now()}`, polygon: poly, label: "Obstacle" },
          ],
        });
      } else if (tool === "draw_nogo") {
        addSafetyRule({ kind: "no_go_zone", zone: poly });
      }
    }

    return (
      <div ref={boxRef} className="relative h-full w-full overflow-hidden">
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          onWheel={onWheel}
          draggable={tool === "select"}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage())
              setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
          style={{ cursor: tool === "select" ? "default" : "crosshair" }}
        >
          {/* Floor + grid */}
          <Layer listening>
            <Line
              name="floor"
              points={project.floor.boundary.flatMap((p) => [p.x, p.y])}
              closed
              fill="var(--color-canvas-bg)"
              stroke="var(--color-border)"
              strokeWidth={2 / view.scale}
            />
            <GridLines box={floorBox} step={grid} scale={view.scale} />
          </Layer>

          {/* Heatmap overlay */}
          {showHeatmap && heatmap && (
            <Layer listening={false} opacity={0.7}>
              <HeatmapLayer field={heatmap} />
            </Layer>
          )}

          {/* Obstacles + no-go + docks */}
          <Layer listening={false}>
            {project.floor.obstacles.map((o) => (
              <Line
                key={o.id}
                points={o.polygon.flatMap((p) => [p.x, p.y])}
                closed
                fill="var(--color-muted-foreground)"
                opacity={0.55}
              />
            ))}
            {project.safetyRules
              .filter((r) => r.kind === "no_go_zone" && r.zone)
              .map((r) => (
                <Line
                  key={r.id}
                  points={r.zone!.flatMap((p) => [p.x, p.y])}
                  closed
                  fill="var(--color-destructive)"
                  opacity={0.18}
                  stroke="var(--color-destructive)"
                  strokeWidth={1 / view.scale}
                  dash={[0.3, 0.3]}
                />
              ))}
            {project.floor.docks.map((d) => (
              <Group key={d.id} x={d.pos.x} y={d.pos.y}>
                <Circle
                  radius={0.4}
                  fill={
                    d.type === "inbound"
                      ? "var(--color-success)"
                      : "var(--color-primary)"
                  }
                />
                <Text
                  text={d.type === "inbound" ? "IN" : "OUT"}
                  fontSize={0.5}
                  fill="var(--color-foreground)"
                  x={0.6}
                  y={-0.25}
                />
              </Group>
            ))}
          </Layer>

          {/* Flow lines */}
          {showFlows && (
            <Layer listening={false}>
              {project.flows.map((f, i) => {
                const a = machineById(f.from);
                const b = machineById(f.to);
                if (!a?.pos || !b?.pos) return null;
                const ca = machineCenter(a)!;
                const cb = machineCenter(b)!;
                const wpx = Math.min(
                  6 / view.scale,
                  (0.5 + f.unitsPerDay / 60) / view.scale
                );
                return (
                  <Line
                    key={i}
                    points={[ca.x, ca.y, cb.x, cb.y]}
                    stroke="var(--color-primary)"
                    strokeWidth={wpx}
                    opacity={0.35}
                  />
                );
              })}
            </Layer>
          )}

          {/* Machines */}
          <Layer>
            {project.machines.map((m) => (
              <MachineNode
                key={m.id}
                machine={m}
                scale={view.scale}
                selected={selectedId === m.id}
                draggable={tool === "select" && !m.fixed}
                onSelect={() => select(m.id)}
                onDragStart={pushHistory}
                onDragMove={(pos) => {
                  const mf = rotatedFootprint(m);
                  const others = project.machines
                    .filter((o) => o.id !== m.id && o.pos)
                    .map((o) => {
                      const of = rotatedFootprint(o);
                      return { pos: o.pos!, w: of.w, d: of.d };
                    });
                  const snap = computeSnap(
                    { pos, w: mf.w, d: mf.d },
                    others,
                    floorBox,
                    grid
                  );
                  setGuides({ x: snap.guideX, y: snap.guideY });
                  return clampMachine(m, snap.pos);
                }}
                onDragEnd={(pos) => {
                  setGuides({});
                  setMachinePos(m.id, clampMachine(m, pos), false);
                }}
              />
            ))}

            {/* Alignment guides */}
            {guides.x !== undefined && (
              <Line
                points={[guides.x, floorBox.y, guides.x, floorBox.y + floorBox.h]}
                stroke="var(--color-primary)"
                strokeWidth={1 / view.scale}
                dash={[0.4, 0.3]}
                listening={false}
              />
            )}
            {guides.y !== undefined && (
              <Line
                points={[floorBox.x, guides.y, floorBox.x + floorBox.w, guides.y]}
                stroke="var(--color-primary)"
                strokeWidth={1 / view.scale}
                dash={[0.4, 0.3]}
                listening={false}
              />
            )}

            {/* Drawing draft rect */}
            {draft && (
              <Rect
                x={Math.min(draft.start.x, draft.end.x)}
                y={Math.min(draft.start.y, draft.end.y)}
                width={Math.abs(draft.end.x - draft.start.x)}
                height={Math.abs(draft.end.y - draft.start.y)}
                fill={
                  tool === "draw_nogo"
                    ? "var(--color-destructive)"
                    : "var(--color-muted-foreground)"
                }
                opacity={0.3}
              />
            )}
          </Layer>
        </Stage>

        <ScaleBadge scale={view.scale} />
      </div>
    );
  }
);

function GridLines({
  box,
  step,
  scale,
}: {
  box: { x: number; y: number; w: number; h: number };
  step: number;
  scale: number;
}) {
  const lines: React.ReactNode[] = [];
  const sw = 0.5 / scale;
  for (let x = box.x; x <= box.x + box.w + 1e-6; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        points={[x, box.y, x, box.y + box.h]}
        stroke="var(--color-canvas-grid)"
        strokeWidth={sw}
      />
    );
  }
  for (let y = box.y; y <= box.y + box.h + 1e-6; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        points={[box.x, y, box.x + box.w, y]}
        stroke="var(--color-canvas-grid)"
        strokeWidth={sw}
      />
    );
  }
  return <>{lines}</>;
}

function MachineNode({
  machine,
  scale,
  selected,
  draggable,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  machine: Machine;
  scale: number;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: (pos: Vec2) => Vec2;
  onDragEnd: (pos: Vec2) => void;
}) {
  if (!machine.pos) return null;
  const f = rotatedFootprint(machine);
  const meta = MACHINE_META[machine.type];
  const c = machine.clearance;
  const labelSize = Math.max(0.35, Math.min(0.7, f.w / 6));

  return (
    <Group
      x={machine.pos.x}
      y={machine.pos.y}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={onDragStart}
      dragBoundFunc={function (this: Konva.Node, posPx) {
        // posPx is absolute stage px; convert to meters via current scale & stage pos
        const stage = this.getStage();
        if (!stage) return posPx;
        const sx = stage.x();
        const sy = stage.y();
        const meters = {
          x: (posPx.x - sx) / scale,
          y: (posPx.y - sy) / scale,
        };
        const clamped = onDragMove(meters);
        return { x: clamped.x * scale + sx, y: clamped.y * scale + sy };
      }}
      onDragEnd={(e) => onDragEnd({ x: e.target.x(), y: e.target.y() })}
    >
      {/* clearance halo */}
      <Rect
        x={-c}
        y={-c}
        width={f.w + 2 * c}
        height={f.d + 2 * c}
        fill={meta.color}
        opacity={0.08}
        cornerRadius={0.1}
      />
      {/* footprint */}
      <Rect
        width={f.w}
        height={f.d}
        fill={meta.color}
        opacity={selected ? 0.95 : 0.82}
        cornerRadius={0.08}
        stroke={selected ? "var(--color-foreground)" : meta.color}
        strokeWidth={(selected ? 2.5 : 0.5) / scale}
      />
      {machine.fixed && (
        <Rect
          width={f.w}
          height={f.d}
          stroke="var(--color-foreground)"
          dash={[0.2, 0.2]}
          strokeWidth={1.5 / scale}
          cornerRadius={0.08}
        />
      )}
      <Text
        text={machine.label}
        fontSize={labelSize}
        fontStyle="600"
        fill="#0b0b0b"
        width={f.w}
        height={f.d}
        align="center"
        verticalAlign="middle"
        padding={0.1}
        listening={false}
        wrap="word"
      />
    </Group>
  );
}

function HeatmapLayer({ field }: { field: HeatmapField }) {
  const cells: React.ReactNode[] = [];
  const max = field.max || 1;
  for (let r = 0; r < field.rows; r++) {
    for (let col = 0; col < field.cols; col++) {
      const v = field.values[r * field.cols + col];
      if (v <= 0) continue;
      const t = Math.min(1, v / max);
      cells.push(
        <Rect
          key={`${r}-${col}`}
          x={field.origin.x + col * field.cell}
          y={field.origin.y + r * field.cell}
          width={field.cell}
          height={field.cell}
          fill={heatColor(t)}
          opacity={0.15 + t * 0.6}
        />
      );
    }
  }
  return <>{cells}</>;
}

/** Blue → cyan → yellow → red ramp. */
function heatColor(t: number): string {
  const stops = [
    [59, 130, 246],
    [16, 185, 129],
    [234, 179, 8],
    [239, 68, 68],
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  const f = seg - i;
  const c = stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function ScaleBadge({ scale }: { scale: number }) {
  // a 1m reference bar
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span
        className="block h-1 rounded bg-foreground"
        style={{ width: `${Math.max(8, scale)}px` }}
      />
      1 m
    </div>
  );
}
