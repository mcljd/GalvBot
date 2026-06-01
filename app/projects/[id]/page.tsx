import { EditorLoader } from "@/components/editor/editor-loader";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorLoader projectId={id} />;
}
