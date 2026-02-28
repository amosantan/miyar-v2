
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download, Info } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

interface ParsedRow {
  typology: string;
  location: string;
  marketTier: string;
  materialLevel: number;
  costPerSqftLow?: number;
  costPerSqftMid?: number;
  costPerSqftHigh?: number;
  avgSellingPrice?: number;
  absorptionRate?: number;
  competitiveDensity?: number;
  sourceType?: "synthetic" | "client_provided" | "curated";
  dataYear?: number;
  region?: string;
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { rows: [], errors: ["File must have a header row and at least one data row"] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length < 4) {
      errors.push(`Row ${i + 1}: insufficient columns (need at least typology, location, marketTier, materialLevel)`);
      continue;
    }

    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || "";
    });

    const typology = obj.typology || obj.project_type || "";
    const location = obj.location || obj.market_location || "";
    const marketTier = obj.market_tier || obj.markettier || obj.tier || "";
    const materialLevel = Number(obj.material_level || obj.materiallevel || 3);

    if (!typology || !location || !marketTier) {
      errors.push(`Row ${i + 1}: missing required field (typology, location, or marketTier)`);
      continue;
    }

    rows.push({
      typology,
      location,
      marketTier,
      materialLevel: isNaN(materialLevel) ? 3 : materialLevel,
      costPerSqftLow: obj.cost_per_sqft_low ? Number(obj.cost_per_sqft_low) : undefined,
      costPerSqftMid: obj.cost_per_sqft_mid ? Number(obj.cost_per_sqft_mid) : undefined,
      costPerSqftHigh: obj.cost_per_sqft_high ? Number(obj.cost_per_sqft_high) : undefined,
      avgSellingPrice: obj.avg_selling_price ? Number(obj.avg_selling_price) : undefined,
      absorptionRate: obj.absorption_rate ? Number(obj.absorption_rate) : undefined,
      competitiveDensity: obj.competitive_density ? Number(obj.competitive_density) : undefined,
      sourceType: (obj.source_type as any) || "client_provided",
      dataYear: obj.data_year ? Number(obj.data_year) : undefined,
      region: obj.region || "UAE",
    });
  }

  return { rows, errors };
}

function CsvImportContent() {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const csvImport = trpc.admin.benchmarks.csvImport.useMutation();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCSV(text);
      setParsedRows(rows);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    try {
      const result = await csvImport.mutateAsync({ rows: parsedRows });
      toast.success(`Successfully imported ${result.imported} benchmark records`);
      setParsedRows([]);
      setParseErrors([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    }
  }

  function downloadTemplate() {
    const headers = "typology,location,market_tier,material_level,cost_per_sqft_low,cost_per_sqft_mid,cost_per_sqft_high,avg_selling_price,absorption_rate,competitive_density,source_type,data_year,region";
    const example = "Residential,Prime,Luxury,4,350,450,600,2500,0.85,3,client_provided,2025,UAE";
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "miyar-benchmark-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">CSV Import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import benchmark data from CSV files into the active benchmark version
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Download Template
        </Button>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Upload CSV File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {fileName ? (
                <span className="text-foreground font-medium">{fileName}</span>
              ) : (
                "Click to select a CSV file or drag and drop"
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Required columns: typology, location, market_tier, material_level
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {/* Parse Results */}
      {(parsedRows.length > 0 || parseErrors.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Parse Results
              <Badge variant="secondary">{parsedRows.length} rows</Badge>
              {parseErrors.length > 0 && (
                <Badge variant="destructive">{parseErrors.length} errors</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parseErrors.length > 0 && (
              <div className="mb-4 space-y-1">
                {parseErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {err}
                  </div>
                ))}
              </div>
            )}

            {parsedRows.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">#</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Typology</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Location</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Tier</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Material</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cost Low</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cost Mid</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cost High</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 px-2">{row.typology}</td>
                          <td className="py-1.5 px-2">{row.location}</td>
                          <td className="py-1.5 px-2">{row.marketTier}</td>
                          <td className="py-1.5 px-2">{row.materialLevel}</td>
                          <td className="py-1.5 px-2">{row.costPerSqftLow ?? "—"}</td>
                          <td className="py-1.5 px-2">{row.costPerSqftMid ?? "—"}</td>
                          <td className="py-1.5 px-2">{row.costPerSqftHigh ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing first 20 of {parsedRows.length} rows
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleImport} disabled={csvImport.isPending} className="gap-2">
                    {csvImport.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {csvImport.isPending ? "Importing..." : `Import ${parsedRows.length} Records`}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setParsedRows([]);
                      setParseErrors([]);
                      setFileName("");
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CsvImport() {
  return (
    <>
      <CsvImportContent />
    </>
  );
}
