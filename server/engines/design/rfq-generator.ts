/**
 * RFQ Generator Engine (V4) — Design Brief Pipeline
 *
 * Material prices are accepted only as governed snapshots produced by the
 * server-internal material-resolution facade. This engine never reads legacy
 * price columns or reconstructs provenance from descriptive text.
 */

import type {
    GovernedMaterialPriceSnapshot,
    MaterialIdentityReference,
    MaterialPriceInsufficiencyReason,
    MaterialPriceSnapshot,
    SafeMaterialPriceProvenance,
} from "../../../shared/material-calculations";
import type { PriceUnitBasis } from "../../../shared/material-pricing";
import type { DesignBriefData } from "../design-brief";
import type { Room } from "./space-program";
import {
    resolveQuantityForUnitBasis,
    roundUpToPaintPacks,
} from "../material-pricing/quantity-policy";
import { calculateSurfaceAreas } from "./material-quantity-engine";

export const RFQ_NON_MATERIAL_POLICY = Object.freeze({
    version: "ev03-rfq-non-material-v1",
    defaultContingencyRate: 0.10,
    authorityApprovalFeeAed: 15_000,
    procurementManagementFeeAed: 25_000,
} as const);

export interface RfqMaterial {
    id: number;
    name?: string | null;
    productName?: string | null;
    category: string;
}

export interface RfqLineItem {
    projectId: number;
    organizationId: number;
    briefId?: number | null;
    sectionNo: number;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    unitRateAedMin: number | null;
    unitRateAedMax: number | null;
    totalAedMin: number | null;
    totalAedMax: number | null;
    productId?: number | null;
    specId?: number | null;
    benchmarkProposalId?: number | null;
    resolutionState: "resolved" | "insufficient";
    resolutionReason?: MaterialPriceInsufficiencyReason | null;
    resolvedPriceScope?: "supply_only" | "supply_and_install" | "legacy_unknown" | null;
    requestedGeography?: GovernedMaterialPriceSnapshot["requestedGeography"] | null;
    resolvedGeography?: GovernedMaterialPriceSnapshot["resolvedGeography"] | null;
    resolvedUnitBasis?: PriceUnitBasis | null;
    resolutionAsOf?: Date | null;
    resolverPolicyVersion?: string | null;
    benchmarkVersionId?: number | null;
    benchmarkVersion?: string | null;
    provenancePolicyVersion?: string | null;
    presentationProvenance?: SafeMaterialPriceProvenance | null;
    quantityPolicyVersion?: string | null;
    quantityConversionInputs?: Record<
        string,
        string | number | readonly string[]
    > | null;
    lineKind: "material" | "non_material_fee";
    nonMaterialPolicyVersion?: string | null;
    supplierName: string;
    pricingSource: "market-verified" | "estimated" | "manual";
    notes?: string;
}

export interface RfqPackResult {
    items: RfqLineItem[];
    summary: {
        totalSections: number;
        totalLineItems: number;
        subtotalMin: number | null;
        subtotalMax: number | null;
        contingencyMin: number | null;
        contingencyMax: number | null;
        grandTotalMin: number | null;
        grandTotalMax: number | null;
        marketVerifiedCount: number;
        estimatedCount: number;
        insufficientCount: number;
        budgetCapAed: number | null;
        budgetUtilizationPct: number | null;
        resolutionState: "complete" | "insufficient";
    };
}

const CATEGORY_MATERIAL_MAP: Record<string, {
    categories: string[];
    defaultUnit: string;
}> = {
    "Civil & MEP Works (Flooring, Ceilings, Partitions)": {
        categories: ["flooring", "ceiling", "partition", "tiles"],
        defaultUnit: "sqm",
    },
    "Civil & MEP Works (Partitions, HVAC, Data)": {
        categories: ["partition", "ceiling", "mechanical"],
        defaultUnit: "sqm",
    },
    "Civil & MEP Works": {
        categories: ["flooring", "ceiling", "partition"],
        defaultUnit: "sqm",
    },
    "Fixed Joinery (Kitchens, Wardrobes, Doors)": {
        categories: ["joinery", "kitchen", "doors", "wardrobes"],
        defaultUnit: "lm",
    },
    "Feature Joinery & Reception": {
        categories: ["joinery", "reception"],
        defaultUnit: "lm",
    },
    "Fixed Joinery & Millwork": {
        categories: ["joinery", "millwork"],
        defaultUnit: "lm",
    },
    "Sanitaryware & Wet Areas": {
        categories: ["sanitaryware", "brassware", "tiles"],
        defaultUnit: "set",
    },
    "Sanitaryware & Specialized Equipment": {
        categories: ["sanitaryware", "brassware", "equipment"],
        defaultUnit: "set",
    },
    "Pantry & Washrooms": {
        categories: ["sanitaryware", "kitchen", "tiles"],
        defaultUnit: "set",
    },
    "FF&E (Loose Furniture, Lighting, Art)": {
        categories: ["furniture", "lighting", "art", "decorative"],
        defaultUnit: "lot",
    },
    "FF&E (Custom Furniture, Drapery, Rugs)": {
        categories: ["furniture", "drapery", "rugs", "textiles"],
        defaultUnit: "lot",
    },
    "Workstations & Loose Furniture": {
        categories: ["furniture", "workstation", "seating"],
        defaultUnit: "nr",
    },
};

function parseBudgetCap(value: string): number | null {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function materialName(material: RfqMaterial): string {
    return material.productName || material.name || `Material ${material.id}`;
}

function snapshotMap(snapshots: readonly MaterialPriceSnapshot[]) {
    const resolverClocks = new Set(
        snapshots.map(snapshot => snapshot.resolverAsOf)
    );
    if (resolverClocks.size > 1) {
        throw new Error("RFQ material snapshots must share one resolver asOf clock");
    }
    return new Map(
        snapshots.map(snapshot => [
            `${snapshot.reference.source}:${snapshot.reference.legacyId}`,
            snapshot,
        ])
    );
}

function materialReference(materialLibraryId: number): MaterialIdentityReference {
    return { source: "material_library", legacyId: materialLibraryId };
}

function pricingSource(snapshot: GovernedMaterialPriceSnapshot) {
    return snapshot.provenance.sourceLadderRung === "assumption"
        ? ("estimated" as const)
        : ("market-verified" as const);
}

function validPositiveRate(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? roundAed(parsed) : null;
}

function roundAed(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPersistedQuantity(value: number): number {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function buildMaterialLine(input: {
    projectId: number;
    organizationId: number;
    briefId?: number | null;
    sectionNo: number;
    itemCode: string;
    description: string;
    unit: string;
    quantity: number;
    material: RfqMaterial;
    snapshot?: MaterialPriceSnapshot;
    notes?: string;
    allowLegacyScopeUnknownEstimate?: boolean;
}): RfqLineItem {
    const { snapshot } = input;
    const explicitQuantityUnit = input.unit === "sqm"
        ? "sqm" as const
        : input.unit === "lm"
          ? "lm" as const
          : input.unit === "nr" ||
              input.unit === "set" ||
              input.unit === "piece"
            ? "piece" as const
            : input.unit === "pack"
              ? "pack" as const
            : input.unit === "litre"
              ? "litre" as const
              : undefined;
    const quantityResolution = snapshot?.state === "resolved"
        ? resolveQuantityForUnitBasis({
            unitBasis: snapshot.unitBasis,
            surfaceAreaM2: input.unit === "sqm" ? input.quantity : undefined,
            explicitQuantity: input.quantity,
            explicitQuantityUnit,
            paintCoverageProfile: snapshot.paintCoverageProfile
                ? {
                    status: "approved",
                    ...snapshot.paintCoverageProfile,
                }
                : undefined,
            paintCoverageState: snapshot.paintCoverageState,
            asOf: new Date(snapshot.resolverAsOf),
        })
        : null;
    const purchasedPaint = quantityResolution?.state === "resolved"
        && quantityResolution.quantityUnit === "litre"
        ? roundUpToPaintPacks(
            quantityResolution.quantity,
            snapshot?.state === "resolved"
                ? snapshot.paintCoverageProfile?.packSizesLitres ?? []
                : []
        )
        : null;
    const packRoundingInvalid =
        quantityResolution?.state === "resolved" &&
        quantityResolution.quantityUnit === "litre" &&
        snapshot?.state === "resolved" &&
        (snapshot.paintCoverageProfile?.packSizesLitres.length ?? 0) > 0 &&
        purchasedPaint === null;
    const resolvedQuantity = roundPersistedQuantity(
        purchasedPaint?.purchasedLitres
        ?? (quantityResolution?.state === "resolved"
            ? quantityResolution.quantity
            : input.quantity)
    );
    const resolvedUnit = quantityResolution?.state === "resolved"
        ? quantityResolution.quantityUnit
        : input.unit;
    const incompatible =
        snapshot?.state === "resolved" &&
        (
            quantityResolution?.state === "insufficient" ||
            packRoundingInvalid
        );
    const legacyEstimate =
        snapshot?.state === "resolved" &&
        snapshot.requestedPriceScope === "supply_and_install" &&
        snapshot.resolvedPriceScope === "legacy_unknown" &&
        input.allowLegacyScopeUnknownEstimate === true;
    const wrongScope =
        snapshot?.state === "resolved" &&
        (
            snapshot.requestedPriceScope !== "supply_and_install"
            || (
                snapshot.resolvedPriceScope !== "supply_and_install" &&
                !legacyEstimate
            )
        );
    const min = snapshot?.state === "resolved"
        ? validPositiveRate(snapshot.priceMin)
        : null;
    const max = snapshot?.state === "resolved"
        ? validPositiveRate(snapshot.priceMax)
        : null;
    const resolved =
        snapshot?.state === "resolved" &&
        !incompatible &&
        !wrongScope &&
        min !== null &&
        max !== null;
    const reason: MaterialPriceInsufficiencyReason | null = resolved
        ? null
        : incompatible
          ? packRoundingInvalid
            ? "paint_coverage_invalid"
            : quantityResolution?.state === "insufficient"
              ? quantityResolution.reason
              : "incompatible_quantity_unit"
          : wrongScope
            ? "no_governed_value"
          : snapshot?.state === "insufficient"
            ? snapshot.reason
            : "no_governed_value";

    return {
        projectId: input.projectId,
        organizationId: input.organizationId,
        briefId: input.briefId ?? null,
        sectionNo: input.sectionNo,
        itemCode: input.itemCode,
        description: input.description,
        unit: resolvedUnit,
        quantity: resolvedQuantity,
        unitRateAedMin: resolved ? min : null,
        unitRateAedMax: resolved ? max : null,
        totalAedMin: resolved ? roundAed(resolvedQuantity * min) : null,
        totalAedMax: resolved ? roundAed(resolvedQuantity * max) : null,
        productId: snapshot?.productId ?? null,
        specId: snapshot?.specificationId ?? null,
        benchmarkProposalId:
            snapshot?.state === "resolved" ? snapshot.benchmarkProposalId : null,
        resolutionState: resolved ? "resolved" : "insufficient",
        resolutionReason: reason,
        resolvedPriceScope:
            snapshot?.state === "resolved" ? snapshot.resolvedPriceScope : null,
        requestedGeography: snapshot?.requestedGeography ?? null,
        resolvedGeography:
            snapshot?.state === "resolved" ? snapshot.resolvedGeography : null,
        resolvedUnitBasis:
            snapshot?.state === "resolved" ? snapshot.unitBasis : null,
        resolutionAsOf: snapshot ? new Date(snapshot.resolverAsOf) : null,
        resolverPolicyVersion: snapshot?.policyVersion ?? null,
        benchmarkVersionId:
            snapshot?.state === "resolved" ? snapshot.benchmarkVersionId : null,
        benchmarkVersion:
            snapshot?.state === "resolved"
                ? snapshot.provenance.benchmarkVersion
                : null,
        provenancePolicyVersion:
            snapshot?.state === "resolved"
                ? snapshot.provenance.provenancePolicyVersion
                : null,
        presentationProvenance:
            snapshot?.state === "resolved" ? snapshot.provenance : null,
        quantityPolicyVersion:
            quantityResolution?.state === "resolved"
                ? quantityResolution.policyVersion
                : null,
        quantityConversionInputs:
            quantityResolution?.state === "resolved"
                ? quantityResolution.conversionInputs
                : null,
        lineKind: "material",
        nonMaterialPolicyVersion: null,
        // A material identity is not proof that the named supplier supplied the
        // governed value. Keep the compatibility field neutral.
        supplierName: "TBD",
        pricingSource:
            snapshot?.state === "resolved" ? pricingSource(snapshot) : "estimated",
        notes: [
            input.notes,
            resolved && quantityResolution?.state === "resolved"
                ? `Quantity policy: ${quantityResolution.policyVersion}.`
                : null,
            resolved && purchasedPaint
                && Object.keys(purchasedPaint.packCounts).length > 0
                ? `Supplier packs: ${Object.entries(purchasedPaint.packCounts)
                    .map(([size, count]) => `${count} × ${size} L`)
                    .join(", ")}.`
                : null,
            resolved && legacyEstimate
                ? "Legacy scope-unknown assumption; estimate only; not contractual supply-and-install coverage."
                : null,
            resolved ? null : `Pricing insufficient: ${reason}`,
        ].filter(Boolean).join(" ") || undefined,
    };
}

function fixedFeeLine(input: {
    projectId: number;
    organizationId: number;
    briefId?: number | null;
    sectionNo: number;
    itemCode: string;
    description: string;
    amount: number;
    supplierName: string;
    notes?: string;
}): RfqLineItem {
    return {
        projectId: input.projectId,
        organizationId: input.organizationId,
        briefId: input.briefId ?? null,
        sectionNo: input.sectionNo,
        itemCode: input.itemCode,
        description: input.description,
        unit: "sum",
        quantity: 1,
        unitRateAedMin: input.amount,
        unitRateAedMax: input.amount,
        totalAedMin: input.amount,
        totalAedMax: input.amount,
        resolutionState: "resolved",
        resolutionReason: null,
        lineKind: "non_material_fee",
        nonMaterialPolicyVersion: RFQ_NON_MATERIAL_POLICY.version,
        supplierName: input.supplierName,
        pricingSource: "estimated",
        notes: input.notes,
    };
}

function contingencyLine(input: {
    projectId: number;
    organizationId: number;
    briefId?: number | null;
    sectionNo: number;
    itemCode: string;
    description: string;
    subtotalMin: number | null;
    subtotalMax: number | null;
    rate: number;
    notes?: string;
}): RfqLineItem {
    const complete = input.subtotalMin !== null && input.subtotalMax !== null;
    const min = complete ? roundAed(input.subtotalMin! * input.rate) : null;
    const max = complete ? roundAed(input.subtotalMax! * input.rate) : null;
    return {
        projectId: input.projectId,
        organizationId: input.organizationId,
        briefId: input.briefId ?? null,
        sectionNo: input.sectionNo,
        itemCode: input.itemCode,
        description: input.description,
        unit: "sum",
        quantity: 1,
        unitRateAedMin: min,
        unitRateAedMax: max,
        totalAedMin: min,
        totalAedMax: max,
        resolutionState: complete ? "resolved" : "insufficient",
        resolutionReason: complete ? null : "no_governed_value",
        lineKind: "non_material_fee",
        nonMaterialPolicyVersion: RFQ_NON_MATERIAL_POLICY.version,
        supplierName: "",
        pricingSource: "estimated",
        notes: complete
            ? input.notes
            : [input.notes, "Cannot calculate contingency until all material lines resolve."]
                .filter(Boolean)
                .join(" "),
    };
}

function materialSubtotal(items: readonly RfqLineItem[]) {
    const materialItems = items.filter(item => item.lineKind === "material");
    if (
        materialItems.length === 0 ||
        materialItems.some(item =>
            item.resolutionState !== "resolved" ||
            item.totalAedMin === null ||
            item.totalAedMax === null
        )
    ) {
        return { min: null, max: null };
    }
    return {
        min: roundAed(
            materialItems.reduce((sum, item) => sum + item.totalAedMin!, 0)
        ),
        max: roundAed(
            materialItems.reduce((sum, item) => sum + item.totalAedMax!, 0)
        ),
    };
}

/**
 * A single scheduled wall finish may consume the canonical MQI wall surface.
 * Multiple finishes require explicit persisted allocation areas; inventing a
 * split would be an unapproved numerical policy.
 */
export function allocateScheduledWallAreas(
    room: Room,
    wallSchedules: readonly any[],
): Array<{ schedule: any; surfaceAreaM2: number | null }> {
    if (wallSchedules.length === 0) return [];
    const wallAreaM2 = calculateSurfaceAreas([room])[0]?.wallM2 ?? 0;
    return wallSchedules.map(schedule => ({
        schedule,
        surfaceAreaM2: wallSchedules.length === 1 ? wallAreaM2 : null,
    }));
}

export function buildRFQFromBrief(
    projectId: number,
    orgId: number,
    briefData: DesignBriefData,
    briefId: number | undefined,
    materials: readonly RfqMaterial[],
    priceSnapshots: readonly MaterialPriceSnapshot[],
): RfqPackResult {
    const items: RfqLineItem[] = [];
    const snapshots = snapshotMap(priceSnapshots);
    const budgetCap = parseBudgetCap(briefData.detailedBudget.totalBudgetCap);
    const materialsById = new Map(
        materials.map(material => [material.id, material])
    );

    briefData.boqFramework.coreAllocations.forEach((allocation, sectionIndex) => {
        const sectionNo = sectionIndex + 1;
        const mapping = CATEGORY_MATERIAL_MAP[allocation.category];
        const unit =
            allocation.explicitQuantityUnit ??
            mapping?.defaultUnit ??
            "unknown";
        const quantity = allocation.explicitQuantity ?? 0;
        const material =
            allocation.materialLibraryId === undefined
                ? undefined
                : materialsById.get(allocation.materialLibraryId);

        if (!material) {
            items.push({
                projectId,
                organizationId: orgId,
                briefId: briefId ?? null,
                sectionNo,
                itemCode: `${sectionNo.toString().padStart(2, "0")}-TBD`,
                description: `${allocation.category} — material specification required`,
                unit,
                quantity,
                unitRateAedMin: null,
                unitRateAedMax: null,
                totalAedMin: null,
                totalAedMax: null,
                resolutionState: "insufficient",
                resolutionReason: "identity_not_found",
                lineKind: "material",
                nonMaterialPolicyVersion: null,
                supplierName: "TBD",
                pricingSource: "estimated",
                notes: `${allocation.percentage}% allocation. Pricing insufficient: identity_not_found.`,
            });
            return;
        }

        items.push(buildMaterialLine({
            projectId,
            organizationId: orgId,
            briefId,
            sectionNo,
            itemCode: `${sectionNo.toString().padStart(2, "0")}-01`,
            description: `Supply & install ${materialName(material)} — ${allocation.category}`,
            unit,
            quantity,
            material,
            snapshot: snapshots.get(`material_library:${material.id}`),
            notes: allocation.notes || undefined,
            allowLegacyScopeUnknownEstimate: true,
        }));
    });

    const subtotal = materialSubtotal(items);
    const contingencyRate =
        RFQ_NON_MATERIAL_POLICY.defaultContingencyRate;
    const lastSection =
        items.length > 0 ? items[items.length - 1].sectionNo + 1 : 1;
    const contingency = contingencyLine({
        projectId,
        organizationId: orgId,
        briefId,
        sectionNo: lastSection,
        itemCode: "PS-CONT",
        description: `Contingency (${Math.round(contingencyRate * 100)}% of material sections)`,
        subtotalMin: subtotal.min,
        subtotalMax: subtotal.max,
        rate: contingencyRate,
        notes: briefData.detailedBudget.contingencyRecommendation,
    });
    items.push(
        contingency,
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            briefId,
            sectionNo: lastSection,
            itemCode: "PS-DM",
            description: "DM/DDA Approval Fees (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.authorityApprovalFeeAed,
            supplierName: "Dubai Authorities",
            notes: "Non-material authority fee allowance.",
        }),
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            briefId,
            sectionNo: lastSection,
            itemCode: "PS-FFE",
            description: "FF&E Procurement Management (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.procurementManagementFeeAed,
            supplierName: "Design Consultant",
        }),
    );

    const insufficientCount =
        items.filter(item => item.lineKind === "material" && item.resolutionState === "insufficient").length;
    const materialComplete = insufficientCount === 0 && subtotal.min !== null;
    const contingencyMin = contingency.totalAedMin;
    const contingencyMax = contingency.totalAedMax;
    const fixedFees =
        RFQ_NON_MATERIAL_POLICY.authorityApprovalFeeAed +
        RFQ_NON_MATERIAL_POLICY.procurementManagementFeeAed;
    const grandTotalMin =
        materialComplete && contingencyMin !== null
            ? roundAed(subtotal.min! + contingencyMin + fixedFees)
            : null;
    const grandTotalMax =
        materialComplete && contingencyMax !== null
            ? roundAed(subtotal.max! + contingencyMax + fixedFees)
            : null;
    const marketVerifiedCount =
        items.filter(item => item.lineKind === "material" && item.pricingSource === "market-verified").length;
    const estimatedCount =
        items.filter(item => item.pricingSource === "estimated").length;

    return {
        items,
        summary: {
            totalSections: lastSection,
            totalLineItems: items.length,
            subtotalMin: subtotal.min,
            subtotalMax: subtotal.max,
            contingencyMin,
            contingencyMax,
            grandTotalMin,
            grandTotalMax,
            marketVerifiedCount,
            estimatedCount,
            insufficientCount,
            budgetCapAed: budgetCap,
            budgetUtilizationPct:
                budgetCap && grandTotalMax !== null
                    ? Math.round((grandTotalMax / budgetCap) * 100)
                    : null,
            resolutionState: materialComplete ? "complete" : "insufficient",
        },
    };
}

export function buildRFQPack(
    projectId: number,
    orgId: number,
    finishSchedule: any[],
    rooms: Room[],
    materials: readonly RfqMaterial[],
    priceSnapshots: readonly MaterialPriceSnapshot[],
): RfqLineItem[] {
    const items: RfqLineItem[] = [];
    const byId = new Map(materials.map(material => [material.id, material]));
    const snapshots = snapshotMap(priceSnapshots);
    const schedulesForRoom = (roomId: string) =>
        finishSchedule.filter(item => item.roomId === roomId);
    const addScheduledLine = (input: {
        room: Room;
        schedule: any;
        sectionNo: number;
        itemCode: string;
        description: string;
        unit: string;
        quantity: number;
        notes?: string;
    }) => {
        const material = byId.get(input.schedule.materialLibraryId);
        if (!material) return;
        items.push(buildMaterialLine({
            projectId,
            organizationId: orgId,
            sectionNo: input.sectionNo,
            itemCode: input.itemCode,
            description: input.description,
            unit: input.unit,
            quantity: input.quantity,
            material,
            snapshot: snapshots.get(`material_library:${material.id}`),
            notes: input.notes,
        }));
    };

    for (const room of rooms) {
        for (const floor of schedulesForRoom(room.id).filter(item => item.element === "floor")) {
            const material = byId.get(floor.materialLibraryId);
            if (material) {
                addScheduledLine({
                    room,
                    schedule: floor,
                    sectionNo: 1,
                    itemCode: `FL-${room.id}`,
                    description: `Supply & install ${materialName(material)} to ${room.name}`,
                    unit: "sqm",
                    quantity: room.sqm,
                });
            }
        }
        const wallSchedules = schedulesForRoom(room.id).filter(item =>
            item.element.startsWith("wall_")
        );
        for (const { schedule: wall, surfaceAreaM2 } of
            allocateScheduledWallAreas(room, wallSchedules)) {
            const material = byId.get(wall.materialLibraryId);
            if (material) {
                addScheduledLine({
                    room,
                    schedule: wall,
                    sectionNo: 2,
                    itemCode: `WL-${room.id}-${wall.element.split("_")[1]}`,
                    description: `Supply & apply ${materialName(material)} to ${room.name} (${wall.element})`,
                    unit: "sqm",
                    quantity: surfaceAreaM2 ?? 0,
                    notes: surfaceAreaM2 === null
                        ? "Pricing insufficient: explicit approved wall-finish area split required."
                        : "Wall area: canonical MQI perimeter-height surface.",
                });
            }
        }
        const ceiling = schedulesForRoom(room.id).find(item => item.element === "ceiling");
        const ceilingMaterial = ceiling && byId.get(ceiling.materialLibraryId);
        if (ceiling && ceilingMaterial) {
            addScheduledLine({
                room,
                schedule: ceiling,
                sectionNo: 3,
                itemCode: `CL-${room.id}`,
                description: `Supply & install ${materialName(ceilingMaterial)} to ${room.name}`,
                unit: "sqm",
                quantity: room.sqm,
            });
        }
        const joinery = schedulesForRoom(room.id).find(item => item.element === "joinery");
        const joineryMaterial = joinery && byId.get(joinery.materialLibraryId);
        if (
            joinery &&
            joineryMaterial &&
            ["MBR", "BD2", "BD3", "KIT", "LVG"].includes(room.id)
        ) {
            addScheduledLine({
                room,
                schedule: joinery,
                sectionNo: 4,
                itemCode: `JN-${room.id}`,
                description: `Supply & install ${materialName(joineryMaterial)} to ${room.name}`,
                unit: "lm",
                quantity: 0,
                notes:
                    "Pricing insufficient: explicit compatible joinery linear metres required.",
            });
        }
    }

    const sanitaryware = materials.find(material => material.category === "sanitaryware");
    if (sanitaryware) {
        for (const room of rooms.filter(item =>
            ["MEN", "BTH", "UTL", "KIT"].includes(item.id)
        )) {
            items.push(buildMaterialLine({
                projectId,
                organizationId: orgId,
                sectionNo: 5,
                itemCode: `SW-${room.id}`,
                description: `Supply & install ${materialName(sanitaryware)} package for ${room.name}`,
                unit: "set",
                quantity: 0,
                material: sanitaryware,
                snapshot: snapshots.get(`material_library:${sanitaryware.id}`),
                notes:
                    "Pricing insufficient: explicit compatible sanitaryware piece quantity required.",
            }));
        }
    }

    const subtotal = materialSubtotal(items);
    const contingency = contingencyLine({
        projectId,
        organizationId: orgId,
        sectionNo: 6,
        itemCode: "PS-01",
        description: "Contingency (10% of material sections)",
        subtotalMin: subtotal.min,
        subtotalMax: subtotal.max,
        rate: RFQ_NON_MATERIAL_POLICY.defaultContingencyRate,
    });
    items.push(
        contingency,
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            sectionNo: 6,
            itemCode: "PS-02",
            description: "DM/DDA Approval Fees (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.authorityApprovalFeeAed,
            supplierName: "Dubai Authorities",
        }),
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            sectionNo: 6,
            itemCode: "PS-03",
            description: "FF&E Procurement Management (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.procurementManagementFeeAed,
            supplierName: "Design Consultant",
        }),
    );
    return items;
}

export type CanonicalRfqMaterialAllocation = {
    roomId: string;
    roomName: string;
    element:
        | "floor"
        | "walls"
        | "ceiling"
        | "joinery"
        | "hardware"
        | "sanitaryware";
    materialLibraryId: number | null;
    surfaceAreaM2: string | number;
    explicitQuantity?: string | number | null;
    explicitQuantityUnit?: "sqm" | "lm" | "piece" | "pack" | "litre" | null;
};

/**
 * Issued reports use the same persisted canonical allocation identities and
 * quantities as MQI reconciliation. Non-surface units remain insufficient
 * until an explicit compatible quantity is persisted.
 */
export function buildRFQPackFromAllocations(
    projectId: number,
    orgId: number,
    allocations: readonly CanonicalRfqMaterialAllocation[],
    materials: readonly RfqMaterial[],
    priceSnapshots: readonly MaterialPriceSnapshot[],
    rooms: readonly { id: string; name: string }[] = [],
): RfqLineItem[] {
    const items: RfqLineItem[] = [];
    const byId = new Map(materials.map(material => [material.id, material]));
    const snapshots = snapshotMap(priceSnapshots);
    allocations.forEach((allocation, index) => {
        const material = allocation.materialLibraryId === null
            ? undefined
            : byId.get(allocation.materialLibraryId);
        if (!material) {
            items.push({
                projectId,
                organizationId: orgId,
                briefId: null,
                sectionNo: index + 1,
                itemCode: `MAT-${index + 1}`,
                description:
                    `${allocation.roomName} ${allocation.element} — material specification required`,
                unit: "sqm",
                quantity: Number(allocation.surfaceAreaM2),
                unitRateAedMin: null,
                unitRateAedMax: null,
                totalAedMin: null,
                totalAedMax: null,
                resolutionState: "insufficient",
                resolutionReason: "identity_not_found",
                lineKind: "material",
                nonMaterialPolicyVersion: null,
                supplierName: "TBD",
                pricingSource: "estimated",
                notes: "Pricing insufficient: identity_not_found.",
            });
            return;
        }
        const surfaceElement =
            allocation.element === "floor" ||
            allocation.element === "walls" ||
            allocation.element === "ceiling";
        const explicitUnit = surfaceElement
            ? "sqm"
            : allocation.explicitQuantityUnit ?? "unknown";
        const quantity = surfaceElement
            ? Number(allocation.surfaceAreaM2)
            : Number(allocation.explicitQuantity ?? 0);
        items.push(buildMaterialLine({
            projectId,
            organizationId: orgId,
            sectionNo: index + 1,
            itemCode: `MAT-${index + 1}`,
            description:
                `Supply & install ${materialName(material)} to ${allocation.roomName} (${allocation.element})`,
            unit: explicitUnit,
            quantity,
            material,
            snapshot: snapshots.get(`material_library:${material.id}`),
            notes: surfaceElement
                ? "Quantity from persisted canonical MQI allocation."
                : "Explicit non-surface quantity required.",
        }));
    });

    const sanitarywareRoomsWithAllocations = new Set(
        allocations
            .filter(allocation => allocation.element === "sanitaryware")
            .map(allocation => allocation.roomId)
    );
    const missingRequired = [
        ...rooms
            .filter(room =>
                SANITARYWARE_RFQ_ROOM_IDS.has(room.id) &&
                !sanitarywareRoomsWithAllocations.has(room.id)
            )
            .map(room => ({
                room,
                element: "sanitaryware",
                reason:
                    "Explicit sanitaryware identity and compatible piece quantity required.",
            })),
    ];
    for (const required of missingRequired) {
        const index = items.length;
        items.push({
            projectId,
            organizationId: orgId,
            briefId: null,
            sectionNo: index + 1,
            itemCode: `REQ-${index + 1}`,
            description:
                `${required.room.name} ${required.element} — specification and quantity required`,
            unit: required.element === "joinery" ? "lm" : "piece",
            quantity: 0,
            unitRateAedMin: null,
            unitRateAedMax: null,
            totalAedMin: null,
            totalAedMax: null,
            resolutionState: "insufficient",
            resolutionReason: "quantity_required",
            lineKind: "material",
            nonMaterialPolicyVersion: null,
            supplierName: "TBD",
            pricingSource: "estimated",
            notes: `Pricing insufficient: ${required.reason}`,
        });
    }

    const subtotal = materialSubtotal(items);
    items.push(
        contingencyLine({
            projectId,
            organizationId: orgId,
            sectionNo: allocations.length + 1,
            itemCode: "PS-01",
            description: "Contingency (10% of material sections)",
            subtotalMin: subtotal.min,
            subtotalMax: subtotal.max,
            rate: RFQ_NON_MATERIAL_POLICY.defaultContingencyRate,
        }),
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            sectionNo: allocations.length + 1,
            itemCode: "PS-02",
            description: "DM/DDA Approval Fees (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.authorityApprovalFeeAed,
            supplierName: "Dubai Authorities",
        }),
        fixedFeeLine({
            projectId,
            organizationId: orgId,
            sectionNo: allocations.length + 1,
            itemCode: "PS-03",
            description: "FF&E Procurement Management (Provisional)",
            amount: RFQ_NON_MATERIAL_POLICY.procurementManagementFeeAed,
            supplierName: "Design Consultant",
        }),
    );
    return items;
}

export function expectedCanonicalRfqMaterialLineCount(
    allocations: readonly CanonicalRfqMaterialAllocation[],
    rooms: readonly { id: string }[]
): number {
    const sanitarywareRoomsWithAllocations = new Set(
        allocations
            .filter(allocation => allocation.element === "sanitaryware")
            .map(allocation => allocation.roomId)
    );
    return (
        allocations.length +
        rooms.filter(
            room =>
                SANITARYWARE_RFQ_ROOM_IDS.has(room.id) &&
                !sanitarywareRoomsWithAllocations.has(room.id)
        ).length
    );
}

// Legacy finish schedules explicitly model joinery for these room types. The
// canonical allocation path is allocation-driven and must not invent absent
// joinery without a persisted applicability/quantity decision.
const LEGACY_JOINERY_RFQ_ROOM_IDS = new Set([
    "MBR",
    "BD2",
    "BD3",
    "KIT",
    "LVG",
]);
const SANITARYWARE_RFQ_ROOM_IDS = new Set(["MEN", "BTH", "UTL", "KIT"]);

/**
 * Counts material lines that an issued RFQ must contain. Missing schedule
 * identities or an absent sanitaryware product remain in the expected count,
 * so they cannot disappear and make a partial RFQ look complete. Joinery here
 * is required only when the legacy finish schedule explicitly contains it.
 */
export function expectedIssuedMaterialRfqLineCount(
    finishSchedule: readonly any[],
    rooms: readonly Room[],
): number {
    const scheduled = finishSchedule.filter(row =>
        row.element === "floor"
        || row.element === "ceiling"
        || row.element?.startsWith("wall_")
        || (
            row.element === "joinery"
            && LEGACY_JOINERY_RFQ_ROOM_IDS.has(String(row.roomId))
        )
    ).length;
    const sanitaryware = rooms.filter(room =>
        SANITARYWARE_RFQ_ROOM_IDS.has(room.id)
    ).length;
    return scheduled + sanitaryware;
}
