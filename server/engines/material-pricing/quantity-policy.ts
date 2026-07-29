import type { PriceUnitBasis } from "../../../shared/material-pricing";
import {
  PAINT_QUANTITY_POLICY_VERSION,
  type MaterialPriceInsufficiencyReason,
} from "../../../shared/material-calculations";

export type ApprovedPaintCoverageProfile = {
  status: "approved";
  policyVersion: string;
  coverageM2PerLitrePerCoat: string;
  coatCount: number;
  wastePct: string;
  effectiveAt: Date | string;
  sourceDocumentDigest: string;
  packSizesLitres: readonly string[];
};

export type QuantityResolution =
  | {
      state: "resolved";
      quantity: number;
      quantityUnit: "sqm" | "lm" | "piece" | "pack" | "litre";
      policyVersion: string;
      conversionInputs: Record<string, string | number | readonly string[]>;
    }
  | {
      state: "insufficient";
      reason: Extract<
        MaterialPriceInsufficiencyReason,
        | "incompatible_quantity_unit"
        | "quantity_required"
        | "paint_coverage_invalid"
      >;
    };

export const DEFAULT_PAINT_COVERAGE_PROFILE: ApprovedPaintCoverageProfile = {
  status: "approved",
  policyVersion: PAINT_QUANTITY_POLICY_VERSION,
  coverageM2PerLitrePerCoat: "10.000",
  coatCount: 2,
  wastePct: "10.000",
  effectiveAt: new Date("2026-07-29T00:00:00.000Z"),
  sourceDocumentDigest:
    "owner-approved-fallback:10m2-per-litre-per-coat:2-coats:10pct-waste",
  packSizesLitres: [],
};

const MIN_PAINT_PACK_LITRES = 0.001;
const MAX_PAINT_PACK_LITRES = 100;
const MAX_PAINT_PACK_SIZE_COUNT = 12;

function finitePositive(value: string | number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validPaintPackSize(value: string): boolean {
  const litres = finitePositive(value);
  if (
    litres === null ||
    litres < MIN_PAINT_PACK_LITRES ||
    litres > MAX_PAINT_PACK_LITRES
  ) {
    return false;
  }
  const millilitres = litres * 1000;
  return (
    Number.isSafeInteger(Math.round(millilitres)) &&
    Math.abs(millilitres - Math.round(millilitres)) < 1e-9
  );
}

export function validateApprovedPaintCoverageProfile(
  profile: ApprovedPaintCoverageProfile,
  asOf: Date
): boolean {
  const coverage = finitePositive(profile.coverageM2PerLitrePerCoat);
  const waste = Number(profile.wastePct);
  const effectiveAt =
    profile.effectiveAt instanceof Date
      ? profile.effectiveAt
      : new Date(profile.effectiveAt);
  return (
    profile.status === "approved" &&
    Number.isFinite(asOf.getTime()) &&
    Number.isFinite(effectiveAt.getTime()) &&
    effectiveAt.getTime() <= asOf.getTime() &&
    coverage !== null &&
    coverage >= 1 &&
    coverage <= 30 &&
    Number.isInteger(profile.coatCount) &&
    profile.coatCount >= 1 &&
    profile.coatCount <= 5 &&
    Number.isFinite(waste) &&
    waste >= 0 &&
    waste <= 30 &&
    profile.sourceDocumentDigest.trim().length > 0 &&
    profile.packSizesLitres.length <= MAX_PAINT_PACK_SIZE_COUNT &&
    new Set(profile.packSizesLitres).size === profile.packSizesLitres.length &&
    profile.packSizesLitres.every(validPaintPackSize)
  );
}

export function roundUpToPaintPacks(
  litresRequired: number,
  packSizesLitres: readonly string[]
): { purchasedLitres: number; packCounts: Record<string, number> } | null {
  if (!Number.isFinite(litresRequired) || litresRequired <= 0) return null;
  const sizes = packSizesLitres
    .map(size => Number(size))
    .filter((size, index) =>
      validPaintPackSize(packSizesLitres[index]) &&
      Number.isFinite(size)
    )
    .sort((a, b) => b - a);
  if (
    sizes.length !== packSizesLitres.length ||
    sizes.length > MAX_PAINT_PACK_SIZE_COUNT
  ) {
    return null;
  }
  if (sizes.length === 0) {
    return {
      purchasedLitres: Number(litresRequired.toFixed(3)),
      packCounts: {},
    };
  }

  // Search in millilitres so a real supplier pack is never represented as an
  // ambiguous "gallon". Minimize purchased volume, then total pack count.
  const requiredMl = Math.ceil(litresRequired * 1000);
  const packMl = sizes.map(size => Math.round(size * 1000));
  const largest = packMl[0];
  if (!Number.isSafeInteger(requiredMl) || requiredMl <= 0) return null;

  // Dijkstra over residues modulo the largest pack. Memory depends only on
  // approved pack denominations (bounded above), never on project litres.
  type Node = { residue: number; volume: number; count: number };
  const heap: Node[] = [{ residue: 0, volume: 0, count: 0 }];
  const push = (node: Node) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const before = heap[parent];
      if (
        before.volume < node.volume ||
        (before.volume === node.volume && before.count <= node.count)
      ) break;
      heap[index] = before;
      index = parent;
    }
    heap[index] = node;
  };
  const pop = (): Node | undefined => {
    const first = heap[0];
    const last = heap.pop();
    if (!first || !last || heap.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= heap.length) break;
      let child = left;
      if (
        right < heap.length &&
        (heap[right].volume < heap[left].volume ||
          (heap[right].volume === heap[left].volume &&
            heap[right].count < heap[left].count))
      ) child = right;
      if (
        heap[child].volume > last.volume ||
        (heap[child].volume === last.volume &&
          heap[child].count >= last.count)
      ) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
    return first;
  };
  const bestVolume = Array<number>(largest).fill(Number.POSITIVE_INFINITY);
  const bestCount = Array<number>(largest).fill(Number.POSITIVE_INFINITY);
  const previousResidue = Array<number>(largest).fill(-1);
  const previousPack = Array<number>(largest).fill(-1);
  bestVolume[0] = 0;
  bestCount[0] = 0;
  while (heap.length > 0) {
    const current = pop()!;
    if (
      current.volume !== bestVolume[current.residue] ||
      current.count !== bestCount[current.residue]
    ) continue;
    for (let index = 0; index < packMl.length; index += 1) {
      const volume = current.volume + packMl[index];
      const residue = volume % largest;
      const count = current.count + 1;
      if (
        volume < bestVolume[residue] ||
        (volume === bestVolume[residue] && count < bestCount[residue])
      ) {
        bestVolume[residue] = volume;
        bestCount[residue] = count;
        previousResidue[residue] = current.residue;
        previousPack[residue] = index;
        push({ residue, volume, count });
      }
    }
  }

  let selected = Number.POSITIVE_INFINITY;
  let selectedCount = Number.POSITIVE_INFINITY;
  let selectedResidue = -1;
  let selectedLargestCount = 0;
  for (let residue = 0; residue < largest; residue += 1) {
    const base = bestVolume[residue];
    if (!Number.isFinite(base)) continue;
    const largestCount =
      base >= requiredMl ? 0 : Math.ceil((requiredMl - base) / largest);
    const volume = base + largestCount * largest;
    const count = bestCount[residue] + largestCount;
    if (
      volume < selected ||
      (volume === selected && count < selectedCount)
    ) {
      selected = volume;
      selectedCount = count;
      selectedResidue = residue;
      selectedLargestCount = largestCount;
    }
  }
  if (!Number.isFinite(selected) || selectedResidue < 0) return null;
  const packCounts: Record<string, number> = {};
  if (selectedLargestCount > 0) {
    packCounts[String(sizes[0])] = selectedLargestCount;
  }
  let cursor = selectedResidue;
  while (cursor !== 0) {
    const packIndex = previousPack[cursor];
    const predecessor = previousResidue[cursor];
    if (packIndex < 0 || predecessor < 0) return null;
    const label = String(sizes[packIndex]);
    packCounts[label] = (packCounts[label] ?? 0) + 1;
    cursor = predecessor;
  }
  return {
    purchasedLitres: Number((selected / 1000).toFixed(3)),
    packCounts,
  };
}

export function resolveQuantityForUnitBasis(input: {
  unitBasis: PriceUnitBasis;
  surfaceAreaM2?: number;
  explicitQuantity?: number;
  explicitQuantityUnit?: "sqm" | "lm" | "piece" | "pack" | "litre";
  paintCoverageProfile?: ApprovedPaintCoverageProfile;
  paintCoverageState?: "fallback" | "approved" | "invalid";
  asOf: Date;
}): QuantityResolution {
  if (input.unitBasis === "per_sqm") {
    const quantity =
      input.explicitQuantityUnit === "sqm"
        ? input.explicitQuantity
        : input.surfaceAreaM2;
    if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
      return { state: "insufficient", reason: "quantity_required" };
    }
    return {
      state: "resolved",
      quantity,
      quantityUnit: "sqm",
      policyVersion: "ev03-direct-unit-v1",
      conversionInputs: { surfaceAreaM2: quantity },
    };
  }

  if (input.unitBasis === "per_litre" && input.surfaceAreaM2 !== undefined) {
    if (
      input.paintCoverageState === "invalid"
      || (input.paintCoverageState === "approved" && !input.paintCoverageProfile)
    ) {
      return { state: "insufficient", reason: "paint_coverage_invalid" };
    }
    const profile =
      input.paintCoverageProfile ?? DEFAULT_PAINT_COVERAGE_PROFILE;
    if (!validateApprovedPaintCoverageProfile(profile, input.asOf)) {
      return { state: "insufficient", reason: "paint_coverage_invalid" };
    }
    const coverage = Number(profile.coverageM2PerLitrePerCoat);
    const wasteMultiplier = 1 + Number(profile.wastePct) / 100;
    const litres =
      (input.surfaceAreaM2 * profile.coatCount * wasteMultiplier) / coverage;
    if (!Number.isFinite(litres) || litres <= 0) {
      return { state: "insufficient", reason: "paint_coverage_invalid" };
    }
    return {
      state: "resolved",
      quantity: Number(litres.toFixed(3)),
      quantityUnit: "litre",
      policyVersion: profile.policyVersion,
      conversionInputs: {
        surfaceAreaM2: input.surfaceAreaM2,
        coverageM2PerLitrePerCoat: profile.coverageM2PerLitrePerCoat,
        coatCount: profile.coatCount,
        wastePct: profile.wastePct,
        sourceDocumentDigest: profile.sourceDocumentDigest,
        packSizesLitres: profile.packSizesLitres,
      },
    };
  }

  const expectedUnit: Record<
    Exclude<PriceUnitBasis, "per_sqm" | "per_litre">,
    "lm" | "piece" | "pack"
  > = {
    per_lm: "lm",
    per_piece: "piece",
    per_pack: "pack",
  };
  if (input.unitBasis === "per_litre") {
    if (input.explicitQuantityUnit !== "litre") {
      return { state: "insufficient", reason: "quantity_required" };
    }
  } else if (input.explicitQuantityUnit !== expectedUnit[input.unitBasis]) {
    return { state: "insufficient", reason: "incompatible_quantity_unit" };
  }
  if (
    input.explicitQuantity === undefined ||
    !Number.isFinite(input.explicitQuantity) ||
    input.explicitQuantity <= 0
  ) {
    return { state: "insufficient", reason: "quantity_required" };
  }
  if (
    (input.unitBasis === "per_piece" || input.unitBasis === "per_pack") &&
    !Number.isSafeInteger(input.explicitQuantity)
  ) {
    return { state: "insufficient", reason: "quantity_required" };
  }
  return {
    state: "resolved",
    quantity: input.explicitQuantity,
    quantityUnit:
      input.unitBasis === "per_litre"
        ? "litre"
        : expectedUnit[input.unitBasis],
    policyVersion: "ev03-direct-unit-v1",
    conversionInputs: {
      explicitQuantity: input.explicitQuantity,
      explicitQuantityUnit: input.explicitQuantityUnit,
    },
  };
}
