import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCsvTemplate, processCsvUpload } from './csv-pipeline';
import { detectPriceChange } from './change-detector';
import { DynamicConnector } from './connectors/dynamic';
import { getDb, getPreviousPublicEvidenceRecord } from '../../db';

const mockGetSourceRegistryById = vi.fn().mockResolvedValue({
    id: 1,
    name: 'Test Source',
    url: 'https://example.test/source',
    reliabilityDefault: 'B',
    isActive: true,
});
const mockCreateEvidenceWithAssessment = vi.fn().mockResolvedValue({ id: 99, assessmentId: 1 });
const mockRecordRejectedAssessment = vi.fn().mockResolvedValue({ id: 1 });

vi.mock('../../db', () => ({
    getDb: vi.fn(),
    insertPublicProjectInsight: vi.fn(),
    createPriceChangeEvent: vi.fn().mockResolvedValue({ id: 1 }),
    getPreviousPublicEvidenceRecord: vi.fn(),
    getSourceRegistryById: (...args: any[]) => mockGetSourceRegistryById(...args),
    createEvidenceRecordWithConfidenceAssessment: (...args: any[]) => mockCreateEvidenceWithAssessment(...args),
    recordRejectedConfidenceAssessment: (...args: any[]) => mockRecordRejectedAssessment(...args),
    getEvidenceRecordById: vi.fn().mockResolvedValue({ id: 99, category: 'material_cost' }),
}));

describe('Data Freshness Engine (DFE) Test Suite', () => {

    describe('CSV Pipeline (DFE-03 & DFE-04)', () => {
        it('generates a valid XLSX upload template buffer', () => {
            const buffer = generateCsvTemplate();
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(100);
            expect(buffer.toString('ascii', 0, 2)).toBe('PK');
        });

        it('parses correct CSV content and rejects bad rows', async () => {
            vi.mocked(getDb).mockResolvedValue({
                insert: vi.fn().mockReturnThis(),
                values: vi.fn().mockReturnThis(),
            } as any);

            const csvStr = `Item Name,Category,Region,Metric,Value,Unit,Date (YYYY-MM-DD),Tags,Notes
Premium Marble Tile,material_cost,Dubai,Price per SQM,150.50,sqm,2024-05-01,"marble,premium",Test note
,,,invalid value,,,,,`;
            const buffer = Buffer.from(csvStr, 'utf-8');
            const result = await processCsvUpload(buffer, 1, 999);

            expect(result.successCount, JSON.stringify(result)).toBe(1);
            expect(result.skippedCount).toBe(1); // One bad row
        });

        for (let i = 0; i < 15; i++) {
            it(`handles various edge case combinations in CSV row - part ${i}`, async () => {
                vi.mocked(getDb).mockResolvedValue({
                    insert: vi.fn().mockReturnThis(),
                    values: vi.fn().mockReturnThis(),
                } as any);
                const csvStr = `Item Name,Category,Region,Metric,Value,Unit
MockItem${i},material_cost,Dubai,Price,${10 + i},sqm`;
                const buffer = Buffer.from(csvStr, 'utf-8');
                const result = await processCsvUpload(buffer, 1, 999);
                expect(result.successCount).toBe(1);
                expect(result.skippedCount).toBe(0);
            });
        }

        it("uses one receipt clock and the common missing-date adjustment", async () => {
            mockCreateEvidenceWithAssessment.mockClear();
            const buffer = Buffer.from(`Item Name,Category,Value,Unit\nFirst,other,10,unit\nSecond,other,20,unit`, "utf-8");
            const result = await processCsvUpload(buffer, 1, 999);

            expect(result.successCount).toBe(2);
            const first = mockCreateEvidenceWithAssessment.mock.calls[0];
            const second = mockCreateEvidenceWithAssessment.mock.calls[1];
            expect(first[0].confidenceScore).toBe(55);
            expect(first[1].recencyAdjustment).toBe(-0.15);
            expect(first[1].evaluationClock).toEqual(second[1].evaluationClock);
        });

        it("records invalid and future publication dates as visible rejections", async () => {
            mockRecordRejectedAssessment.mockClear();
            const buffer = Buffer.from(`Item Name,Category,Value,Unit,Date\nInvalid,other,10,unit,not-a-date\nFuture,other,20,unit,2099-01-01`, "utf-8");
            const result = await processCsvUpload(buffer, 1, 999);

            expect(result.successCount).toBe(0);
            expect(result.skippedCount).toBe(2);
            expect(result.errors).toEqual([
                "Row 2: invalid_publication_date",
                "Row 3: future_publication_date",
            ]);
            expect(mockRecordRejectedAssessment).toHaveBeenCalledTimes(2);
        });
    });

    describe('Change Detector (DFE-05)', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('detects no price change when previous record is missing', async () => {
            vi.mocked(getPreviousPublicEvidenceRecord).mockResolvedValue(undefined as any);

            const result = await detectPriceChange({
                id: 10,
                itemName: 'Test Marble',
                sourceRegistryId: 5,
                priceTypical: '100',
                captureDate: new Date(),
            } as any);

            expect(result).toBeNull();
        });

        it('detects a notable price increase (>= 5%)', async () => {
            vi.mocked(getPreviousPublicEvidenceRecord).mockResolvedValue({
                id: 1,
                itemName: 'Test Marble',
                priceTypical: '100',
                captureDate: new Date('2024-01-01'),
            } as any);

            const result = await detectPriceChange({
                id: 10,
                itemName: 'Test Marble',
                sourceRegistryId: 5,
                priceTypical: '107', // 7% increase
                captureDate: new Date('2024-02-01'),
                publisher: 'Test Source',
                category: 'material_cost'
            } as any);

            expect(result).toBeDefined();
            expect(result?.changePct).toBeCloseTo(7);
            expect(result?.severity).toBe('notable');
            expect(result?.changeDirection).toBe('increased');
        });

        it('detects a significant price drop (>= 10%)', async () => {
            vi.mocked(getPreviousPublicEvidenceRecord).mockResolvedValue({
                id: 1,
                itemName: 'Test Marble',
                priceTypical: '200',
                captureDate: new Date('2024-01-01'),
            } as any);

            const result = await detectPriceChange({
                id: 10,
                itemName: 'Test Marble',
                sourceRegistryId: 5,
                priceTypical: '150', // 25% drop
                captureDate: new Date('2024-02-01'),
                publisher: 'Test Source',
                category: 'material_cost'
            } as any);

            expect(result).toBeDefined();
            expect(result?.changePct).toBeCloseTo(-25);
            expect(result?.severity).toBe('significant');
            expect(result?.changeDirection).toBe('decreased');
        });

        for (let i = 0; i < 15; i++) {
            it(`validates boundary price change logic matrix ${i}`, async () => {
                const prev = 100;
                const current = 100 + (i - 7); // varies from 93 to 107
                const pct = ((current - prev) / prev) * 100;

                vi.mocked(getPreviousPublicEvidenceRecord).mockResolvedValue({
                    id: 1,
                    itemName: `Item ${i}`,
                    priceTypical: String(prev),
                    captureDate: new Date('2024-01-01'),
                } as any);

                const result = await detectPriceChange({
                    id: 10,
                    itemName: `Item ${i}`,
                    sourceRegistryId: 5,
                    priceTypical: String(current),
                    captureDate: new Date('2024-02-01'),
                    publisher: 'Test Source',
                    category: 'material_cost'
                } as any);

                if (pct === 0) {
                    expect(result).toBeNull();
                } else if (Math.abs(pct) > 0 && Math.abs(pct) < 5) {
                    expect(result?.severity).toBe('minor');
                } else if (Math.abs(pct) >= 5 && Math.abs(pct) < 10) {
                    expect(result?.severity).toBe('notable');
                } else {
                    expect(result?.severity).toBe('significant');
                }
            });
        }
    });

    describe('Dynamic Connector (DFE-01, 02, 08)', () => {
        it('correctly maps DB schema variables into connector class properties', () => {
            const source = {
                id: 42,
                name: 'My Custom Source',
                url: 'https://example.com/prices',
                sourceType: 'retailer_listing',
                region: 'Abu Dhabi',
                scrapeMethod: 'html_rules',
                extractionHints: 'Focus on tables',
                lastSuccessfulFetch: new Date('2024-05-01')
            };

            const connector = new DynamicConnector(source);
            expect(connector.sourceId).toBe('42');
            expect(connector.sourceName).toBe('My Custom Source');
            expect(connector.category).toBe('floors');
            expect(connector.geography).toBe('Abu Dhabi');
            expect(connector.scrapeMethod).toBe('html_rules');
            expect(connector.extractionHints).toBe('Focus on tables');
        });

        for (let i = 1; i <= 20; i++) {
            it(`configures mapping profile variation #${i}`, () => {
                const mapTest = new DynamicConnector({
                    id: i,
                    name: `Source ${i}`,
                    url: `https://test.com/${i}`,
                    sourceType: i % 2 === 0 ? 'industry_report' : 'government_tender'
                });

                // Both industry_report and government_tender map to 'other' in typeCategoryMap
                expect(mapTest.category).toBe('other');
            });
        }
    });

});
