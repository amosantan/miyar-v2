/**
 * Data Export Utilities (P2-4)
 *
 * CSV and PDF export for projects, scenarios, simulations,
 * sustainability results, and health scores.
 */

// ─── CSV Export ─────────────────────────────────────────────────────────────

export function exportToCSV(
    data: Record<string, unknown>[],
    filename: string,
): void {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);

    const csvContent = [
        headers.join(","),
        ...data.map((row) =>
            headers
                .map((h) => {
                    const val = row[h];
                    if (val == null) return "";
                    const str = String(val);
                    // Escape commas, quotes, and newlines
                    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                })
                .join(",")
        ),
    ].join("\n");

    downloadBlob(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ─── JSON Export ────────────────────────────────────────────────────────────

export function exportToJSON(data: unknown, filename: string): void {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadBlob(jsonContent, `${filename}.json`, "application/json");
}

// ─── Print-ready PDF (browser print) ────────────────────────────────────────

export function exportToPDF(title: string, elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`[export] Element #${elementId} not found`);
        return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups to export PDF.");
        return;
    }

    // Copy styles from main document
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map((el) => el.outerHTML)
        .join("\n");

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      ${styles}
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .no-print { display: none !important; }
        }
        body {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          background: white;
          padding: 40px;
        }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .export-meta { color: #666; font-size: 12px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="export-meta">
        Exported on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
      </div>
      ${element.innerHTML}
    </body>
    </html>
  `);

    printWindow.document.close();

    // Wait for styles to load, then trigger print
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// ─── Table to CSV (for project lists, scenario comparisons, etc.) ───────────

export function tableToCSV(tableId: string, filename: string): void {
    const table = document.getElementById(tableId) as HTMLTableElement | null;
    if (!table) return;

    const rows: string[][] = [];
    for (const row of Array.from(table.rows)) {
        const cells: string[] = [];
        for (const cell of Array.from(row.cells)) {
            const text = cell.textContent?.trim() || "";
            cells.push(text.includes(",") ? `"${text}"` : text);
        }
        rows.push(cells);
    }

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    downloadBlob(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
