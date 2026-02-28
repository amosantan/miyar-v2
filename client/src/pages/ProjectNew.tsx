import { ProjectForm } from "@/components/ProjectForm";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const createProject = trpc.project.create.useMutation();

  const handleSubmit = async (data: any) => {
    try {
      const result = await createProject.mutateAsync(data);
      toast.success("Project created successfully");
      setLocation(`/projects/${result.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    }
  };

  return (
    <ProjectForm
      onSubmit={handleSubmit}
      isPending={createProject.isPending}
      submitLabel="Create Project"
      onCancel={() => setLocation("/projects")}
    />
  );
}
