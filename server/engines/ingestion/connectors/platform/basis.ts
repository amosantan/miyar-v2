/**
 * EV-01b — Deterministic price-basis parser.
 *
 * A listed retail price for a tile may be per piece, per box, or per square
 * metre. Guessing wrong corrupts every downstream benchmark, so this parser
 * only reports a basis the listing actually states, and returns `unknown`
 * otherwise. `unknown` is a truthful answer, not a failure: the proposal
 * generator refuses to publish a benchmark keyed on it.
 *
 * No LLM, no network, no heuristics that infer a basis from dimensions —
 * "60x120 cm" tells you the tile's size, not what the price is per.
 */

export const PRICE_BASIS_POLICY_VERSION = "price-basis-policy-v1" as const;

export type PriceBasis =
    | "per_piece"
    | "per_pack"
    | "per_sqm"
    | "per_lm"
    | "per_litre"
    | "unknown";

export interface PriceBasisResult {
    basis: PriceBasis;
    /** Units per pack, or litres per container. Null when not derivable. */
    packQuantity: number | null;
    /** The exact substring that justified the verdict, for audit. */
    evidence: string | null;
    policyVersion: typeof PRICE_BASIS_POLICY_VERSION;
}

function unknownBasis(): PriceBasisResult {
    return {
        basis: "unknown",
        packQuantity: null,
        evidence: null,
        policyVersion: PRICE_BASIS_POLICY_VERSION,
    };
}

function resolved(
    basis: PriceBasis,
    packQuantity: number | null,
    evidence: string
): PriceBasisResult {
    return {
        basis,
        packQuantity,
        evidence,
        policyVersion: PRICE_BASIS_POLICY_VERSION,
    };
}

/**
 * Ordered most-specific first. An explicit area or length rate outranks a pack
 * count, because "AED 90 per sqm (box of 6)" is a per-square-metre price.
 */
// Note on the `/` alternatives: they deliberately carry no leading `\b`.
// A word boundary before "/" requires a word character immediately before it,
// which "AED 45 / lm" does not have — the space defeats it.
const AREA_RATE = /(?:\bper\s*(?:sq(?:uare)?\.?\s*m(?:et(?:re|er))?|sqm|m2|m²)\b|\/\s*(?:sqm|m2|m²)\b)/i;
const LENGTH_RATE = /(?:\bper\s*(?:l(?:inear|in)?\.?\s*m(?:et(?:re|er))?|lm|rm|r\.?m)\b|\/\s*(?:lm|rm)\b)/i;
const PACK_COUNT = /\b(?:pack|box|set|carton|bundle|case)\s*(?:of|:)?\s*(\d{1,4})\b/i;
const PACK_COUNT_TRAILING = /\b(\d{1,4})\s*(?:pcs?|pieces?|nos?\.?)\s*(?:\/|per\s*)?(?:pack|box|set|carton)\b/i;
const VOLUME_LITRE = /\b(\d{1,4}(?:\.\d{1,3})?)\s*(?:l|lt|ltr|liters?|litres?)\b/i;
const VOLUME_ML = /\b(\d{1,5}(?:\.\d{1,2})?)\s*(?:ml|millilit(?:re|er)s?)\b/i;
const UNIT_RATE = /(?:\bper\s*(?:piece|pc|pcs|unit|each|item)\b|\/\s*(?:piece|pc|unit)\b|\beach\b)/i;

/**
 * Parse the price basis from whatever text the source actually published —
 * typically the product title, optionally plus a unit or description field.
 *
 * @param text Product title and any unit/short-description text, concatenated.
 */
export function parsePriceBasis(text: string | null | undefined): PriceBasisResult {
    if (!text) return unknownBasis();

    // Collapse the HTML entities and whitespace variants that storefront JSON
    // routinely carries, so the patterns see plain text.
    const normalized = text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/[   ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return unknownBasis();

    const area = normalized.match(AREA_RATE);
    if (area) return resolved("per_sqm", null, area[0]);

    const length = normalized.match(LENGTH_RATE);
    if (length) return resolved("per_lm", null, length[0]);

    const pack = normalized.match(PACK_COUNT) ?? normalized.match(PACK_COUNT_TRAILING);
    if (pack) {
        const quantity = Number.parseInt(pack[1], 10);
        if (Number.isFinite(quantity) && quantity > 0) {
            return resolved("per_pack", quantity, pack[0]);
        }
    }

    const litres = normalized.match(VOLUME_LITRE);
    if (litres) {
        const quantity = Number.parseFloat(litres[1]);
        if (Number.isFinite(quantity) && quantity > 0) {
            return resolved("per_litre", quantity, litres[0]);
        }
    }

    const millilitres = normalized.match(VOLUME_ML);
    if (millilitres) {
        const quantity = Number.parseFloat(millilitres[1]);
        if (Number.isFinite(quantity) && quantity > 0) {
            return resolved("per_litre", quantity / 1000, millilitres[0]);
        }
    }

    const unit = normalized.match(UNIT_RATE);
    if (unit) return resolved("per_piece", null, unit[0]);

    // Dimensions alone ("60x120 cm, 9 mm") do not state a basis. Say so.
    return unknownBasis();
}

/** The evidence-record `unit` string implied by a resolved basis. */
export function basisToUnit(basis: PriceBasis): string {
    switch (basis) {
        case "per_sqm":
            return "sqm";
        case "per_lm":
            return "lm";
        case "per_litre":
            return "L";
        case "per_pack":
            return "pack";
        case "per_piece":
            return "piece";
        case "unknown":
        default:
            return "unit";
    }
}
