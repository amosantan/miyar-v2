/**
 * MIYAR — Database Value Verifier
 *
 * Cross-checks current evidence record values against market reality
 * by sampling records and asking Gemini to validate if the prices
 * are within reasonable UAE market ranges.
 *
 * Used as a periodic health check, not per-ingestion.
 */

import { invokeLLM } from "../../_core/llm";

// ─── Types ───────────────────────────────────────────────────────

export interface VerificationRecord {
    id: number;
    itemName: string;
    category: string;
    priceTypical: string | null;
    unit: string;
    publisher: string | null;
    captureDate: Date;
}

export interface VerificationResult {
    recordId: number;
    itemName: string;
    status: "verified" | "suspect" | "invalid" | "no_price";
    reason: string;
    suggestedRange?: { min: number; max: number };
    confidenceAdjustment?: number;
}

export interface VerificationReport {
    verifiedAt: Date;
    totalChecked: number;
    verified: number;
    suspect: number;
    invalid: number;
    noPrice: number;
    results: VerificationResult[];
}

// ─── Helper: Call LLM with simple prompt ────────────────────────

async function askLLM(prompt: string): Promise<string> {
    const result = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
    });
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : JSON.stringify(content);
}

// ─── Verification Prompt ─────────────────────────────────────────

const VERIFY_PROMPT = `You are a UAE interior design and construction cost expert. Verify these material/fitout prices against current UAE market reality (2025-2026).

For each item, determine if the price is reasonable for the UAE market:
- "verified" = price is within expected market range
- "suspect" = price seems too high or too low but possible in edge cases
- "invalid" = price is clearly wrong (order of magnitude off, or nonsensical)

**Items to verify:**
{items}

Return JSON array:
[{
  "recordId": 123,
  "itemName": "...",
  "status": "verified" | "suspect" | "invalid",
  "reason": "Brief explanation",
  "suggestedRange": { "min": 100, "max": 500 }
}]`;

// ─── Main Verification Function ─────────────────────────────────

/**
 * Verify a batch of evidence records against market reality.
 * Samples up to 50 records and asks Gemini to cross-check.
 */
export async function verifyDatabaseValues(
    records: VerificationRecord[]
): Promise<VerificationReport> {
    const toCheck = records.filter((r) => r.priceTypical !== null);
    const noPrice = records.filter((r) => r.priceTypical === null);

    if (toCheck.length === 0) {
        return {
            verifiedAt: new Date(),
            totalChecked: records.length,
            verified: 0,
            suspect: 0,
            invalid: 0,
            noPrice: noPrice.length,
            results: noPrice.map((r) => ({
                recordId: r.id,
                itemName: r.itemName,
                status: "no_price" as const,
                reason: "Record has no price value to verify",
            })),
        };
    }

    // Sample up to 50 for AI verification
    const sample = toCheck.slice(0, 50);

    const itemsList = sample
        .map(
            (r) =>
                `ID: ${r.id} | "${r.itemName}" (${r.category}) | ${r.priceTypical} AED/${r.unit} | Source: ${r.publisher || "Unknown"} | Captured: ${r.captureDate.toISOString().split("T")[0]}`
        )
        .join("\n");

    const prompt = VERIFY_PROMPT.replace("{items}", itemsList);

    try {
        const response = await askLLM(prompt);

        // Parse AI response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            // AI didn't return valid JSON — mark all as unverifiable
            return {
                verifiedAt: new Date(),
                totalChecked: records.length,
                verified: 0,
                suspect: 0,
                invalid: 0,
                noPrice: noPrice.length,
                results: [],
            };
        }

        const aiResults = JSON.parse(jsonMatch[0]) as Array<{
            recordId: number;
            itemName: string;
            status: "verified" | "suspect" | "invalid";
            reason: string;
            suggestedRange?: { min: number; max: number };
        }>;

        // Combine AI results with no-price records
        const allResults: VerificationResult[] = [
            ...aiResults.map((r) => ({
                ...r,
                confidenceAdjustment:
                    r.status === "suspect" ? -20 : r.status === "invalid" ? -50 : 0,
            })),
            ...noPrice.map((r) => ({
                recordId: r.id,
                itemName: r.itemName,
                status: "no_price" as const,
                reason: "No price value",
            })),
        ];

        return {
            verifiedAt: new Date(),
            totalChecked: records.length,
            verified: aiResults.filter((r) => r.status === "verified").length,
            suspect: aiResults.filter((r) => r.status === "suspect").length,
            invalid: aiResults.filter((r) => r.status === "invalid").length,
            noPrice: noPrice.length,
            results: allResults,
        };
    } catch (err) {
        return {
            verifiedAt: new Date(),
            totalChecked: records.length,
            verified: 0,
            suspect: 0,
            invalid: 0,
            noPrice: noPrice.length,
            results: [],
        };
    }
}
