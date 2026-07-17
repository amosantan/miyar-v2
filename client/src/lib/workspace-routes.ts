import type { WorkspaceSection } from "@/pages/ProjectDetail";

export function buildWorkspaceAliasUrl(
  projectId: string | number,
  section: WorkspaceSection,
  view: string,
  currentSearch = ""
) {
  const params = new URLSearchParams(currentSearch);
  params.set("section", section);
  params.set("view", view);
  return `/projects/${projectId}?${params.toString()}`;
}
