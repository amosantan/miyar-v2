import { getPreviousEvidenceRecord, createPriceChangeEvent, insertProjectInsight } from "../../db";
import { EvidenceRecord } from "../../../drizzle/schema";

export async function detectPriceChange(currentRecord: EvidenceRecord) {
    // Ensure we have valid price data and source linkage
    if (!currentRecord.priceTypical || !currentRecord.sourceRegistryId) return null;

    const currentPrice = parseFloat(currentRecord.priceTypical);
    if (isNaN(currentPrice)) return null;

    // Find the most recent record prior to this current one
    const previousRecord = await getPreviousEvidenceRecord(
        currentRecord.itemName,
        currentRecord.sourceRegistryId,
        currentRecord.captureDate
    );

    if (!previousRecord || !previousRecord.priceTypical) return null;

    const previousPrice = parseFloat(previousRecord.priceTypical);
    if (isNaN(previousPrice)) return null;

    // No change
    if (currentPrice === previousPrice) return null;

    const changePct = ((currentPrice - previousPrice) / Math.abs(previousPrice)) * 100;
    const changeDirection = currentPrice > previousPrice ? "increased" : "decreased";

    let severity: "none" | "minor" | "notable" | "significant" = "none";
    const absChange = Math.abs(changePct);

    // Custom thresholds for price volatility tracking
    if (absChange >= 10) severity = "significant";
    else if (absChange >= 5) severity = "notable";
    else if (absChange > 0) severity = "minor";

    if (severity === "none") return null;

    // Log it to the database
    const result = await createPriceChangeEvent({
        itemName: currentRecord.itemName.substring(0, 255),
        category: currentRecord.category.substring(0, 255),
        sourceId: currentRecord.sourceRegistryId,
        previousPrice: previousPrice.toString(),
        newPrice: currentPrice.toString(),
        changePct: changePct.toString(),
        changeDirection,
        severity,
        detectedAt: currentRecord.captureDate,
    });

    // Raise intelligence project insight if notable or significant
    if (severity === "significant" || severity === "notable") {
        const insightType = changeDirection === "increased" ? "cost_pressure" : "market_opportunity";
        await insertProjectInsight({
            insightType,
            severity: severity === "significant" ? "critical" : "warning",
            title: `${changeDirection === "increased" ? "Price Spike" : "Price Drop"} Detected: ${currentRecord.itemName}`.substring(0, 512),
            body: `A ${severity} price ${changeDirection} of ${Math.abs(changePct).toFixed(1)}% was detected for ${currentRecord.itemName} supplied via ${currentRecord.publisher}. Previous: ${previousPrice} AED, New: ${currentPrice} AED.`,
            actionableRecommendation: `Review associated material benchmarks to adjust expected forecasting costs accordingly.`,
            confidenceScore: "0.85",
            dataPoints: [
                { label: "Previous Price", value: previousPrice.toString() },
                { label: "New Price", value: currentPrice.toString() },
                { label: "Deviation %", value: `${changePct.toFixed(1)}%` },
            ],
            triggerCondition: `Change detector alert: abs(change) >= ${severity === "significant" ? 10 : 5}%`,
        });
    }

    return {
        id: result.id,
        itemName: currentRecord.itemName,
        previousPrice,
        newPrice: currentPrice,
        changePct,
        changeDirection,
        severity,
    };
}
