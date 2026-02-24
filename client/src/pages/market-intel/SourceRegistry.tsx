import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, BookOpen, Trash2, Edit, Zap, ExternalLink, ShieldCheck, ShieldOff, Download, Upload, Loader2 } from "lucide-react";

const SOURCE_TYPES = [
  "supplier_catalog", "manufacturer_catalog", "developer_brochure",
  "industry_report", "government_tender", "procurement_portal",
  "trade_publication", "retailer_listing", "aggregator", "other",
] as const;

const SCRAPE_METHODS = [
  "html_llm", "html_rules", "json_api", "rss_feed", "csv_upload", "email_forward"
] as const;

const methodLabels: Record<string, string> = {
  html_llm: "HTML + LLM Extraction",
  html_rules: "HTML Rules / RegEx",
  json_api: "JSON API directly",
  rss_feed: "RSS/Atom Feed",
  csv_upload: "CSV/Excel Upload",
  email_forward: "Email Forward Processing",
};

const typeLabels: Record<string, string> = {
  supplier_catalog: "Supplier Catalog",
  manufacturer_catalog: "Manufacturer Catalog",
  developer_brochure: "Developer Brochure",
  industry_report: "Industry Report",
  government_tender: "Government Tender",
  procurement_portal: "Procurement Portal",
  trade_publication: "Trade Publication",
  retailer_listing: "Retailer Listing",
  aggregator: "Aggregator",
  other: "Other",
};

export default function SourceRegistry() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: sources, isLoading, refetch } = trpc.marketIntel.sources.list.useQuery();

  const createMutation = trpc.marketIntel.sources.create.useMutation({
    onSuccess: () => { toast.success("Source added"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.marketIntel.sources.update.useMutation({
    onSuccess: () => { toast.success("Source updated"); setEditId(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.marketIntel.sources.delete.useMutation({
    onSuccess: () => { toast.success("Source deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const seedMutation = trpc.marketIntel.sources.seedDefaults.useMutation({
    onSuccess: (data) => { toast.success(`Seeded ${data.created} sources (${data.skipped ?? 0} already existed)`); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const testScrapeMutation = trpc.marketIntel.sources.testScrape.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Extracted ${data.extractedCount} items in ${data.durationMs}ms`);
        console.log("Test Scrape Preview:", data.previewRecords);
      } else {
        toast.error(`Scrape failed: ${data.error}`);
      }
    },
    onError: (e) => toast.error(`Test scrape error: ${e.message}`),
  });

  const scrapeNowMutation = trpc.marketIntel.sources.scrapeNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Scrape complete. Extracted: ${data.evidenceCreated}, Failed: ${data.evidenceSkipped}`);
      refetch();
    },
    onError: (e) => toast.error(`Scrape failed: ${e.message}`),
  });

  const downloadTemplateMutation = trpc.marketIntel.sources.downloadCsvTemplate.useMutation({
    onSuccess: (data) => {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${data.base64}`;
      link.download = "MIYAR_Bulk_Evidence_Template.xlsx";
      link.click();
      toast.success("Template downloaded");
    },
    onError: (e) => toast.error(`Download failed: ${e.message}`),
  });

  const uploadCsvMutation = trpc.marketIntel.sources.uploadCsv.useMutation({
    onSuccess: (data) => {
      toast.success(`Uploaded successfully. Inserted: ${data.successCount}, Skipped: ${data.skippedCount}`);
      if (data.errors && data.errors.length > 0) {
        console.warn("Upload Warnings:", data.errors);
        toast.warning(`Finished with ${data.errors.length} warnings. See console.`);
      }
      refetch();
    },
    onError: (e) => toast.error(`Upload failed: ${e.message}`),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, sourceId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.loading(`Uploading to source #${sourceId}...`, { id: "csv_upload" });
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(",")[1];
      uploadCsvMutation.mutate(
        { sourceId, base64File: base64 },
        { onSettled: () => toast.dismiss("csv_upload") }
      );
    };
    reader.readAsDataURL(file);
    // clear input
    e.target.value = '';
  };

  const whitelisted = (sources ?? []).filter((s: any) => s.isWhitelisted);
  const nonWhitelisted = (sources ?? []).filter((s: any) => !s.isWhitelisted);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Source Registry</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage whitelisted data sources for market intelligence extraction
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadTemplateMutation.mutate()} disabled={downloadTemplateMutation.isPending}>
              <Download className="h-4 w-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Zap className="h-4 w-4 mr-2" />
              {seedMutation.isPending ? "Seeding..." : "Seed UAE Sources"}
            </Button>
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Source</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Source</DialogTitle>
                </DialogHeader>
                <SourceForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{sources?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground">Total Sources</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-400">{whitelisted.length}</div>
              <div className="text-xs text-muted-foreground">Whitelisted</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {new Set((sources ?? []).map((s: any) => s.sourceType)).size}
              </div>
              <div className="text-xs text-muted-foreground">Source Types</div>
            </CardContent>
          </Card>
        </div>

        {/* Sources List */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading sources...</div>
        ) : (sources ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No sources registered yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Seed Defaults" to add 12 curated UAE sources</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {(sources ?? []).map((src: any) => (
              <Card key={src.id} className="bg-card/50 hover:bg-card/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{src.name}</h3>
                        {src.isWhitelisted ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />Whitelisted
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            <ShieldOff className="h-3 w-3 mr-1" />Not Whitelisted
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Grade {src.reliabilityDefault}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{typeLabels[src.sourceType] ?? src.sourceType}</span>
                        <span>·</span>
                        <a href={src.url} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1">
                          {new URL(src.url).hostname}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {src.region && <><span>·</span><span>{src.region}</span></>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                        {src.scrapeMethod && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium bg-secondary/50">
                            {methodLabels[src.scrapeMethod] ?? src.scrapeMethod}
                          </Badge>
                        )}
                        {src.scrapeSchedule && (
                          <span className="flex items-center gap-1 font-mono">
                            <Zap className="h-3 w-3" /> {src.scrapeSchedule}
                          </span>
                        )}
                        {src.consecutiveFailures > 0 && (
                          <span className={`flex items-center gap-1 ${src.consecutiveFailures >= 5 ? 'text-destructive font-bold' : 'text-amber-500'}`}>
                            <ShieldOff className="h-3 w-3" /> Fails: {src.consecutiveFailures}
                            {src.consecutiveFailures >= 5 && " (DISABLED)"}
                          </span>
                        )}
                      </div>
                      {src.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{src.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 items-center">
                      <div className="relative">
                        <input
                          type="file"
                          accept=".csv, .xlsx"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={(e) => handleFileUpload(e, src.id)}
                          disabled={uploadCsvMutation.isPending}
                          title="Upload Bulk Evidence"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs mr-2 relative pointer-events-none">
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          Upload
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs mr-2"
                        onClick={() => scrapeNowMutation.mutate({ id: src.id })}
                        disabled={scrapeNowMutation.isPending}
                      >
                        {scrapeNowMutation.isPending && scrapeNowMutation.variables?.id === src.id ? (
                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        ) : null}
                        Scrape Now
                      </Button>
                      <Dialog open={editId === src.id} onOpenChange={(open) => setEditId(open ? src.id : null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Edit Source</DialogTitle>
                          </DialogHeader>
                          <SourceForm
                            initial={src}
                            onSubmit={(data) => updateMutation.mutate({ id: src.id, ...data })}
                            isLoading={updateMutation.isPending}
                            onTestScrape={(id) => {
                              toast.loading("Running test scrape...", { id: "test-scrape" });
                              testScrapeMutation.mutate({ id }, { onSettled: () => toast.dismiss("test-scrape") });
                            }}
                            isTesting={testScrapeMutation.isPending}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete source "${src.name}"?`)) {
                            deleteMutation.mutate({ id: src.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── Source Form ─────────────────────────────────────────────────────────────

function SourceForm({ initial, onSubmit, isLoading, onTestScrape, isTesting }: {
  initial?: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onTestScrape?: (id: number) => void;
  isTesting?: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    sourceType: initial?.sourceType ?? "supplier_catalog",
    reliabilityDefault: initial?.reliabilityDefault ?? "B",
    isWhitelisted: initial?.isWhitelisted ?? true,
    region: initial?.region ?? "UAE",
    notes: initial?.notes ?? "",
    scrapeMethod: initial?.scrapeMethod ?? "html_llm",
    scrapeSchedule: initial?.scrapeSchedule ?? "0 6 * * 1", // default monday 6am
    extractionHints: initial?.extractionHints ?? "",
    requestDelayMs: initial?.requestDelayMs ?? 2000,
  });

  const handleSubmit = () => {
    if (!form.name || !form.url) {
      toast.error("Name and URL are required");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. RAK Ceramics UAE" />
      </div>
      <div>
        <Label>URL *</Label>
        <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Source Type</Label>
          <Select value={form.sourceType} onValueChange={(v) => setForm({ ...form, sourceType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map(t => (
                <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Default Reliability</Label>
          <Select value={form.reliabilityDefault} onValueChange={(v) => setForm({ ...form, reliabilityDefault: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A — Verified</SelectItem>
              <SelectItem value="B">B — Reputable</SelectItem>
              <SelectItem value="C">C — Unverified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Region</Label>
          <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={form.isWhitelisted} onCheckedChange={(v) => setForm({ ...form, isWhitelisted: v })} />
          <Label>Whitelisted</Label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-border/50 pt-4 mt-2">
        <div>
          <Label>Ingestion Method</Label>
          <Select value={form.scrapeMethod} onValueChange={(v) => setForm({ ...form, scrapeMethod: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCRAPE_METHODS.map(m => (
                <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Schedule (Cron Expr)</Label>
          <Input value={form.scrapeSchedule} onChange={(e) => setForm({ ...form, scrapeSchedule: e.target.value })} placeholder="0 6 * * 1" />
        </div>
      </div>

      {
        ["html_llm", "html_rules"].includes(form.scrapeMethod) && (
          <div className="pt-2">
            <Label>Extraction Hints (for LLM / Parser)</Label>
            <Textarea
              value={form.extractionHints}
              onChange={(e) => setForm({ ...form, extractionHints: e.target.value })}
              placeholder="e.g. Find prices in the tables under 'Material Costs'. Exclude installation."
              rows={2}
            />
          </div>
        )
      }

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={1} />
      </div>
      <div className="flex gap-2 w-full pt-2">
        {initial && onTestScrape && (
          <Button
            variant="outline"
            className="flex-1"
            type="button"
            disabled={isTesting}
            onClick={() => onTestScrape(initial.id)}
          >
            {isTesting ? "Testing..." : "Test Scrape"}
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={isLoading} className="flex-1">
          {isLoading ? "Saving..." : initial ? "Update Source" : "Add Source"}
        </Button>
      </div>
    </div >
  );
}
