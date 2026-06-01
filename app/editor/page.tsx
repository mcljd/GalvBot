"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EditorLoader } from "@/components/editor/editor-loader";
import { Button } from "@/components/ui/button";

function EditorFromQuery() {
  const params = useSearchParams();
  const id = params.get("id");

  if (!id) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold">No project specified</p>
        <Button asChild>
          <Link href="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }
  return <EditorLoader projectId={id} />;
}

export default function EditorPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
          Loading editor…
        </div>
      }
    >
      <EditorFromQuery />
    </React.Suspense>
  );
}
