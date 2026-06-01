import { SiteHeader } from "@/components/site-header";
import { ProjectsDashboard } from "@/components/projects/projects-dashboard";

export const metadata = {
  title: "Projects — GalvBot",
};

export default function ProjectsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ProjectsDashboard />
      </main>
    </>
  );
}
