import * as xlsx from "xlsx";
import { createEvidenceRecord, getSourceRegistryById, getEvidenceRecordById } from "../../db";
import { detectPriceChange } from "./change-detector";

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
    const source = await getSourceRegistryById(sourceId);
    if (!source) throw new Error("Source not found");

    const wb = xlsx.read(buffer, { type: "buffer" });
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

            const dateRaw = row["Date (YYYY-MM-DD)"] || row["Date"] || row["date"];
            let publishedDate = new Date();
            if (dateRaw) {
                const parsed = new Date(dateRaw);
                if (!isNaN(parsed.getTime())) publishedDate = parsed;
            }

            const tagsRaw = row["Tags"] || row["tags"];
            const tags = tagsRaw && typeof tagsRaw === "string"
                ? tagsRaw.split(",").map(s => s.trim()).filter(Boolean)
                : [];

            const notes = row["Notes"] || row["notes"] || "";

            if (!title) {
                errors.push(`Row ${i + 2}: Missing Item Name/Title`);
                skippedCount++;
                continue;
            }
            if (isNaN(value)) {
                errors.push(`Row ${i + 2}: Invalid or missing numeric Value`);
                skippedCount++;
                continue;
            }

            const summary = notes ? `Uploaded Data: ${notes}` : `Bulk uploaded value for ${title}`;

            const { id: newRecordId } = await createEvidenceRecord({
                recordId: generateRecordId(),
                sourceRegistryId: source.id,
                sourceUrl: source.url,
                category: String(category).substring(0, 64) as any,
                itemName: String(title).substring(0, 255),
                title: String(metric).substring(0, 512), // mapping metric to title for context
                priceTypical: isNaN(value) ? null : value.toString(),
                unit: String(unit).substring(0, 32),
                currencyOriginal: "AED",
                captureDate: publishedDate,
                reliabilityGrade: source.reliabilityDefault as any,
                confidenceScore: source.reliabilityDefault === "A" ? 90 : 70, // 0-100 scale
                extractedSnippet: summary.substring(0, 500),
                publisher: source.name,
                tags: tags,
                notes: `Uploaded via CSV bulk tool. Row context: ${JSON.stringify(row).substring(0, 200)}`,
                createdBy: addedByUserId,
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
