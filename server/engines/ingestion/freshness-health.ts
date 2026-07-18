export type OverallFreshnessHealth = "healthy" | "aging" | "degraded" | "unknown";

export function deriveOverallFreshnessHealth(counts: {
  totalSources: number;
  agingCount: number;
  staleCount: number;
  unknownCount: number;
}): OverallFreshnessHealth {
  if (counts.totalSources === 0 || counts.unknownCount === counts.totalSources) return "unknown";
  if (counts.staleCount > counts.totalSources * 0.3) return "degraded";
  if (counts.agingCount > counts.totalSources * 0.5) return "aging";
  return "healthy";
}
