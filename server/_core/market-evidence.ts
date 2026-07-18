import { DLD_PUBLIC_SOURCE } from "../../shared/public-claims";

export type RawMarketEvidenceCounts = {
  transactionCount: unknown;
  transactionObservedThrough: unknown;
  rentContractCount: unknown;
  rentObservedThrough: unknown;
  projectCount: unknown;
};

export type MarketEvidenceSnapshot =
  | { available: false }
  | {
      available: true;
      scope: "indexed_subset";
      source: typeof DLD_PUBLIC_SOURCE;
      datasets: {
        transactions: { count: number; recordsDatedThrough: string };
        rentContracts: { count: number; recordsDatedThrough: string };
        projects: { count: number };
      };
    };

const SUCCESS_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 20_000;

function positiveSafeInteger(value: unknown): number | null {
  const parsed = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function realIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

export function validateMarketEvidenceSnapshot(raw: RawMarketEvidenceCounts): MarketEvidenceSnapshot {
  const transactionCount = positiveSafeInteger(raw.transactionCount);
  const rentContractCount = positiveSafeInteger(raw.rentContractCount);
  const projectCount = positiveSafeInteger(raw.projectCount);
  const transactionObservedThrough = realIsoDate(raw.transactionObservedThrough);
  const rentObservedThrough = realIsoDate(raw.rentObservedThrough);

  if (!transactionCount || !rentContractCount || !projectCount || !transactionObservedThrough || !rentObservedThrough) {
    return { available: false };
  }

  return {
    available: true,
    scope: "indexed_subset",
    source: DLD_PUBLIC_SOURCE,
    datasets: {
      transactions: { count: transactionCount, recordsDatedThrough: transactionObservedThrough },
      rentContracts: { count: rentContractCount, recordsDatedThrough: rentObservedThrough },
      projects: { count: projectCount },
    },
  };
}

type CacheEntry = { value: MarketEvidenceSnapshot; expiresAt: number };
let cache: CacheEntry | null = null;
let inFlight: Promise<MarketEvidenceSnapshot> | null = null;

export async function getCachedMarketEvidenceSnapshot(
  load: () => Promise<RawMarketEvidenceCounts | null>,
  now = Date.now(),
): Promise<MarketEvidenceSnapshot> {
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    let value: MarketEvidenceSnapshot = { available: false };
    try {
      const raw = await load();
      if (raw) value = validateMarketEvidenceSnapshot(raw);
    } catch {
      value = { available: false };
    }
    cache = {
      value,
      expiresAt: now + (value.available ? SUCCESS_TTL_MS : FAILURE_TTL_MS),
    };
    return value;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function resetMarketEvidenceCacheForTests() {
  cache = null;
  inFlight = null;
}
