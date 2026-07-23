/**
 * EV-01b — Shared price sanity bound.
 *
 * A single AED figure above this ceiling is a property value, a project value,
 * or a parsing error — it is not the price of a material line item. The guard
 * existed only in `evidence-to-materials.ts`, so the benchmark proposal path
 * had no bound at all and a stray property listing could move a published
 * percentile. It lives here so both paths enforce the same number.
 */

export const MATERIAL_PRICE_SANITY_POLICY_VERSION = "price-sanity-v1" as const;

/** AED. Above this, the figure is not a material unit price. */
export const MATERIAL_PRICE_CEILING_AED = 10_000_000;

/** AED. At or below this, the figure carries no information. */
export const MATERIAL_PRICE_FLOOR_AED = 0;

function toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * True when every price on the record sits inside the plausible band for a
 * material unit price. Records with no positive price at all are not sane
 * inputs to a percentile either.
 */
export function isPlausibleMaterialPrice(record: {
    priceMin?: unknown;
    priceMax?: unknown;
    priceTypical?: unknown;
}): boolean {
    const values = [
        toNumber(record.priceMin),
        toNumber(record.priceMax),
        toNumber(record.priceTypical),
    ];

    const highest = Math.max(...values);
    if (highest <= MATERIAL_PRICE_FLOOR_AED) return false;
    return highest <= MATERIAL_PRICE_CEILING_AED;
}
