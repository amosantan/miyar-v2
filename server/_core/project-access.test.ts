import { describe, expect, it, vi } from "vitest";
import { requireProjectForOrg } from "./project-access";

describe("requireProjectForOrg", () => {
  it("returns a project owned by the caller's organization", async () => {
    const project = { id: 12, orgId: 7 } as any;
    const lookup = vi.fn().mockResolvedValue(project);

    await expect(requireProjectForOrg(12, 7, lookup)).resolves.toBe(project);
    expect(lookup).toHaveBeenCalledWith(12);
  });

  it("conceals a project owned by another organization", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: 12, orgId: 8 });

    await expect(requireProjectForOrg(12, 7, lookup)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  });

  it("rejects legacy projects without an organization boundary", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: 12, orgId: null });

    await expect(requireProjectForOrg(12, 7, lookup)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns the same response for a missing project", async () => {
    const lookup = vi.fn().mockResolvedValue(undefined);

    await expect(requireProjectForOrg(99, 7, lookup)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found",
    });
  });
});
