"use client";

import dynamic from "next/dynamic";

// Konva touches `window`, so the editor must render client-side only.
const EditorApp = dynamic(
  () => import("./editor-app").then((m) => m.EditorApp),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  }
);

export function EditorLoader({ projectId }: { projectId: string }) {
  return <EditorApp projectId={projectId} />;
}
