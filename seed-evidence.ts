import { getDb } from "./server/db";
import { evidenceRecords } from "./drizzle/schema";
import { nanoid } from "nanoid";

async function run() {
  const db = await getDb();
  if (!db) return;
  const project1Id = 1;
  const project2Id = 2;

  const evidence = [
    {
      recordId: `MYR-ER-${nanoid(6)}`,
      projectId: project1Id,
      title: "Dubai Market Brief Q3",
      category: "other",
      itemName: "Market Report Q3",
      reliabilityGrade: "A",
      sourceUrl: "https://example.com/dubai-q3",
      unit: "report",
      captureDate: new Date(),
      confidenceScore: 90,
      extractedSnippet: "Market is growing.",
      createdBy: 1,
    },
    {
      recordId: `MYR-ER-${nanoid(6)}`,
      projectId: project1Id,
      title: "Regional Material Cost Index",
      category: "other",
      itemName: "Cost Benchmark",
      reliabilityGrade: "A",
      sourceUrl: "https://example.com/material-index",
      unit: "index",
      captureDate: new Date(),
      confidenceScore: 85,
      extractedSnippet: "Steel +5%",
      createdBy: 1,
    },
    {
      recordId: `MYR-ER-${nanoid(6)}`,
      projectId: project2Id, // seed 1 for project 2 just in case
      title: "Competitor Analysis - Luxury Villas",
      category: "other",
      itemName: "Competitor Intelligence",
      reliabilityGrade: "B",
      sourceUrl: "https://example.com/competitors",
      unit: "report",
      captureDate: new Date(),
      confidenceScore: 75,
      extractedSnippet: "Luxury villas show strong performance.",
      createdBy: 1,
    }
  ];

  for (const e of evidence) {
    await db.insert(evidenceRecords).values(e as any);
  }
  console.log("Seeded 3 evidence records for project 1 and 2");
  process.exit(0);
}
run();
