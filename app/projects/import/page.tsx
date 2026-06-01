import { SiteHeader } from "@/components/site-header";
import { ScanImporter } from "@/components/scan/scan-importer";

export const metadata = {
  title: "Import floor scan — GalvBot",
};

export default function ImportPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ScanImporter />
      </main>
    </>
  );
}
