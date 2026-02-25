/**
 * Diagnostic: test LLM extraction with new prompts on real content.
 * Helps identify why full scrape returned 0 records.
 */
import "dotenv/config";
import { invokeLLM } from "../../../_core/llm";

async function main() {
    // 1. Fetch a known page with prices (IKEA UAE sofas)
    console.log("=== DIAGNOSTIC: Testing LLM extraction ===\n");

    const testUrl = "https://www.ikea.com/ae/en/cat/sofas-fu003/";
    console.log(`Fetching: ${testUrl}`);
    const resp = await fetch(testUrl);
    const html = await resp.text();
    const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    console.log(`Content length: ${text.length} chars`);
    console.log(`First 300 chars: ${text.substring(0, 300)}\n`);

    // 2. Build the material pricing prompt (same as in dynamic.ts)
    const prompt = `Extract products with prices from this IKEA UAE supplier/retailer page.
Geography: UAE
Page URL: ${testUrl}

IMPORTANT: Extract EXACT AED prices. If price is shown, include it. Skip items with no price.

Return a JSON array of objects with these EXACT fields:
- title: string (product name with specification, e.g. "Calacatta Marble Tile 60x60cm")
- rawText: string (product description or context, max 500 chars)
- value: number (price in AED — REQUIRED, skip items without price)
- valueMax: number|null (max price if a range is shown)
- unit: string (REQUIRED — "sqm", "piece", "unit", "m", "L", "set", etc.)
- category: string (one of: "floors", "walls", "ceilings", "sanitary", "lighting", "kitchen", "hardware", "joinery", "ffe", "other")
- brand: string|null (manufacturer/brand name if visible)
- publishedDate: string|null (ISO date if found)

Rules:
- Extract ALL priced items you can find, up to 50 maximum
- Price MUST be a number in AED — skip items with no visible price
- Do NOT invent prices
- Return empty array [] if no priced items found

Content (truncated to 16000 chars):
${text.substring(0, 16000)}`;

    // 3. Call LLM
    console.log("Calling LLM...");
    const sysPrompt = `You are a data extraction engine for the MIYAR real estate intelligence platform.
You extract structured evidence from website content of UAE construction/real estate websites.
Return ONLY valid JSON. Do not include markdown code fences or any other text.`;

    const result = await invokeLLM({
        messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
    });

    const content = result.choices[0]?.message?.content || "";
    console.log(`\nLLM Response length: ${content.length} chars`);
    console.log(`First 1500 chars of response:\n${content.substring(0, 1500)}\n`);

    // 4. Parse and check
    try {
        const parsed = JSON.parse(content);
        console.log("Parsed type:", typeof parsed);
        console.log("Is array:", Array.isArray(parsed));
        console.log("Keys:", Object.keys(parsed));

        const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.data || []);
        console.log(`\nTotal items: ${items.length}`);

        if (items.length > 0) {
            console.log("\nSample items:");
            for (const item of items.slice(0, 5)) {
                console.log(`  ${item.title} — ${item.value} AED/${item.unit} (${item.category})`);
            }
        } else {
            console.log("\n⚠️  LLM returned 0 items!");
            console.log("Full response for debugging:");
            console.log(content);
        }
    } catch (e) {
        console.log("❌ JSON parse error:", e);
        console.log("Raw response:", content.substring(0, 2000));
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error("Error:", err); process.exit(1); });
