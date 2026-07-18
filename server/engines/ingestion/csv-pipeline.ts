import * as xlsx from "xlsx";
import { randomUUID } from "crypto";
import {
    createEvidenceRecordWithConfidenceAssessment,
    getSourceRegistryById,
    getEvidenceRecordById,
    recordRejectedConfidenceAssessment,
} from "../../db";
import { detectPriceChange } from "./change-detector";
import {
    evaluateConnectorConfidence,
    classifyPublicationDate,
    REGISTRY_SOURCE_GRADE_POLICY_VERSION,
} from "./confidence-policy";

function generateRecordId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    return `MYR-PE-CSV-${ts}-${rand}`.toUpperCase();
}

export function generateCsvTemplate(): Buffer {
    const wsData = [
        ["Item Name", "Category", "Region", "Metric", "Value", "Unit", "Date (YYYY-MM-DD)", "Tags", "Notes"],
        ["Sample Tile 60x60", "material_cost", "Dubai", "Price per SQM", "125.50", "sqm", "2026-02-01", "ceramics, flooring", "Premium finish"],
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Upload Template");

    // write to buffer
    return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

export async function processCsvUpload(buffer: Buffer, sourceId: number, addedByUserId: number) {
    const receiptClock = new Date();
    const runId = `CSV-${randomUUID().substring(0, 8)}`;
    const source = await getSourceRegistryById(sourceId);
    if (!source) throw new Error("Source not found");

    const wb = xlsx.read(buffer, { type: "buffer", cellDates: true });
    if (!wb.SheetNames.length) throw new Error("Empty spreadsheet");

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[] = xlsx.utils.sheet_to_json(ws);

    if (rawData.length === 0) {
        throw new Error("No data found in rows");
    }

    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        try {
            // Map columns (fuzzy match to allow slight variations in headers)
            const title = row["Item Name"] || row["Title"] || row["Name"];
            const category = row["Category"] || row["category"] || source.sourceType || "other";
            const geography = row["Region"] || row["Geography"] || source.region || "UAE";
            const metric = row["Metric"] || row["metric"] || title;
            const valRaw = row["Value"] || row["Price"] || row["Cost"];
            const value = parseFloat(valRaw);
            const unit = row["Unit"] || row["unit"] || "unit";

            const dateRawValue = row["Date (YYYY-MM-DD)"] ?? row["Date"] ?? row["date"];
            const dateRaw = dateRawValue instanceof Date
                ? dateRawValue.toISOString()
                : dateRawValue == null || dateRawValue === ""
                    ? null
                    : String(dateRawValue);

            const tagsRaw = row["Tags"] || row["tags"];
            const tags = tagsRaw && typeof tagsRaw === "string"
                ? tagsRaw.split(",").map(s => s.trim()).filter(Boolean)
                : [];

            const notes = row["Notes"] || row["notes"] || "";

            if (!title) {
                const publication = classifyPublicationDate(dateRaw, receiptClock);
                await recordRejectedConfidenceAssessment({
                    runId,
                    sourceId: String(source.id),
                    actorId: addedByUserId,
                    corpusScope: "legacy_unscoped",
                    origin: "csv_upload",
                    outcome: "rejected",
                    evaluationClock: receiptClock,
                    rawPublicationText: publication.raw,
                    datePrecision: publication.status === "missing" ? "missing" : publication.precision === "datetime" ? "timestamp" : publication.precision,
                    parsingStatus: publication.status,
                    parsedPublicationDate: publication.parsedAt,
                    registryGradePolicyId: REGISTRY_SOURCE_GRADE_POLICY_VERSION,
                    confidencePolicyId: "ingestion-confidence-v1",
                    mergePolicyId: "evidence-confidence-merge-latest-v1",
                    grade: source.reliabilityDefault,
                    mergeDecision: "rejected",
                    rejectionCode: "missing_item_name",
                });
                errors.push(`Row ${i + 2}: Missing Item Name/Title`);
                skippedCount++;
                continue;
            }
            if (isNaN(value)) {
                const publication = classifyPublicationDate(dateRaw, receiptClock);
                await recordRejectedConfidenceAssessment({
                    runId,
                    sourceId: String(source.id),
                    actorId: addedByUserId,
                    corpusScope: "legacy_unscoped",
                    origin: "csv_upload",
                    outcome: "rejected",
                    evaluationClock: receiptClock,
                    rawPublicationText: publication.raw,
                    datePrecision: publication.status === "missing" ? "missing" : publication.precision === "datetime" ? "timestamp" : publication.precision,
                    parsingStatus: publication.status,
                    parsedPublicationDate: publication.parsedAt,
                    registryGradePolicyId: REGISTRY_SOURCE_GRADE_POLICY_VERSION,
                    confidencePolicyId: "ingestion-confidence-v1",
                    mergePolicyId: "evidence-confidence-merge-latest-v1",
                    grade: source.reliabilityDefault,
                    mergeDecision: "rejected",
                    rejectionCode: "invalid_numeric_value",
                });
                errors.push(`Row ${i + 2}: Invalid or missing numeric Value`);
                skippedCount++;
                continue;
            }

            const confidence = evaluateConnectorConfidence({
                grade: source.reliabilityDefault,
                publicationDate: dateRaw,
                evaluatedAt: receiptClock,
            });
            if (!confidence.accepted) {
                await recordRejectedConfidenceAssessment({
                    runId,
                    sourceId: String(source.id),
                    actorId: addedByUserId,
                    corpusScope: "legacy_unscoped",
                    origin: "csv_upload",
                    outcome: "rejected",
                    evaluationClock: receiptClock,
                    rawPublicationText: confidence.publicationDate.raw,
                    datePrecision: confidence.publicationDate.status === "missing"
                        ? "missing"
                        : confidence.publicationDate.precision === "datetime" ? "timestamp" : confidence.publicationDate.precision,
                    parsingStatus: confidence.publicationDate.status,
                    parsedPublicationDate: confidence.publicationDate.parsedAt,
                    registryGradePolicyId: REGISTRY_SOURCE_GRADE_POLICY_VERSION,
                    confidencePolicyId: "ingestion-confidence-v1",
                    mergePolicyId: "evidence-confidence-merge-latest-v1",
                    grade: source.reliabilityDefault,
                    mergeDecision: "rejected",
                    rejectionCode: confidence.rejectionCode,
                });
                errors.push(`Row ${i + 2}: ${confidence.rejectionCode}`);
                skippedCount++;
                continue;
            }

            const summary = notes ? `Uploaded Data: ${notes}` : `Bulk uploaded value for ${title}`;

            const categoryMap: Record<string, string> = {
                material_cost: "floors",
                fitout_rate: "other",
                market_trend: "other",
                competitor_project: "other",
            };
            const acceptedCategories = new Set(["floors", "walls", "ceilings", "joinery", "lighting", "sanitary", "kitchen", "hardware", "ffe", "other"]);
            const normalizedCategory = acceptedCategories.has(String(category))
                ? String(category)
                : categoryMap[String(category)] || "other";
            const confidenceScore = Math.round(confidence.initial.score * 100);
            const { id: newRecordId } = await createEvidenceRecordWithConfidenceAssessment({
                recordId: generateRecordId(),
                sourceRegistryId: source.id,
                sourceUrl: source.url,
                category: normalizedCategory as any,
                itemName: String(title).substring(0, 255),
                title: String(metric).substring(0, 512), // mapping metric to title for context
                priceTypical: isNaN(value) ? null : value.toString(),
                unit: String(unit).substring(0, 32),
                currencyOriginal: "AED",
                captureDate: confidence.publicationDate.parsedAt || receiptClock,
                reliabilityGrade: source.reliabilityDefault as any,
                confidenceScore,
                extractedSnippet: summary.substring(0, 500),
                publisher: source.name,
                tags: tags,
                notes: `Uploaded via CSV bulk tool. Row context: ${JSON.stringify(row).substring(0, 200)}`,
                runId,
                createdBy: addedByUserId,
            }, {
                runId,
                sourceId: String(source.id),
                actorId: addedByUserId,
                corpusScope: "legacy_unscoped",
                origin: "csv_upload",
                outcome: "accepted",
                evaluationClock: receiptClock,
                rawPublicationText: confidence.publicationDate.raw,
                datePrecision: confidence.publicationDate.status === "missing"
                    ? "missing"
                    : confidence.publicationDate.precision === "datetime" ? "timestamp" : confidence.publicationDate.precision,
                parsingStatus: confidence.publicationDate.status,
                parsedPublicationDate: confidence.publicationDate.parsedAt,
                registryGradePolicyId: REGISTRY_SOURCE_GRADE_POLICY_VERSION,
                confidencePolicyId: confidence.initial.policyVersion,
                mergePolicyId: "evidence-confidence-merge-latest-v1",
                grade: source.reliabilityDefault,
                baseConfidence: confidence.initial.baseScore,
                recencyAdjustment: confidence.initial.dateAdjustment,
                confidenceAfterRecency: confidence.initial.score,
                candidateScore: confidenceScore,
                finalScore: confidenceScore,
                mergeDecision: "inserted",
            });

            const insertedRecord = await getEvidenceRecordById(newRecordId);
            if (insertedRecord) {
                await detectPriceChange(insertedRecord);
            }

            successCount++;
        } catch (e) {
            errors.push(`Row ${i + 2}: ${(e as Error).message}`);
            skippedCount++;
        }
    }

    return {
        totalRows: rawData.length,
        successCount,
        skippedCount,
        errors: errors.slice(0, 10), // only return top 10 errors
    };
}
