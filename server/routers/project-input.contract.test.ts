import { describe, expect, it } from "vitest";
import { projectInputSchema } from "./project";

describe("project input compatibility", () => {
  it("accepts nullable stored descriptions and decimal strings from edit forms", () => {
    const result = projectInputSchema.parse({
      name: "Existing project",
      description: null,
      ctx03Gfa: "12500.5",
      fin01BudgetCap: "850",
    });
    expect(result.description).toBeUndefined();
    expect(result.ctx03Gfa).toBe(12500.5);
    expect(result.fin01BudgetCap).toBe(850);
  });

  it("still rejects non-numeric strings", () => {
    expect(() => projectInputSchema.parse({ name: "Invalid", ctx03Gfa: "twelve" }))
      .toThrow();
  });
});
