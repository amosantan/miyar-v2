/**
 * Run an initial materials sync from all existing evidence records.
 * Usage: npx tsx server/engines/ingestion/seeds/run-materials-sync.ts
 */
import "dotenv/config";
import { syncEvidenceToMaterials } from "../evidence-to-materials";

async function main() {
    console.log("🔄 Syncing Evidence Vault → Materials Library...\n");

    const result = await syncEvidenceToMaterials(undefined, 2000); // All evidence

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Materials Sync Complete");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  Created:  ${result.created} new materials`);
    console.log(`  Updated:  ${result.updated} existing materials`);
    console.log(`  Skipped:  ${result.skipped} (no price or duplicate)`);
}

main()
    .then(() => { console.log("\nDone!"); process.exit(0); })
    .catch((err) => { console.error("Failed:", err); process.exit(1); });
