import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, FileText, Upload, BarChart3, ExternalLink, Trash2 } from "lucide-react";

const CATEGORIES = [
  "floors", "walls", "ceilings", "joinery", "lighting",
  "sanitary", "kitchen", "hardware", "ffe", "other",
] as const;

const GRADES = ["A", "B", "C"] as const;

const gradeColors: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  B: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  C: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function EvidenceVaultMI() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: records, isLoading, refetch } = trpc.marketIntel.evidence.list.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    reliabilityGrade: gradeFilter !== "all" ? gradeFilter : undefined,
    limit: 200,
  });

  const { data: stats } = trpc.marketIntel.evidence.stats.useQuery();

  const createMutation = trpc.marketIntel.evidence.create.useMutation({
    onSuccess: () => { toast.success("Evidence record created"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.marketIntel.evidence.delete.useMutation({
    onSuccess: () => { toast.success("Record deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (records ?? []).filter((r: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return r.itemName?.toLowerCase().includes(term) ||
      r.publisher?.toLowerCase().includes(term) ||
      r.recordId?.toLowerCase().includes(term);
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Evidence Vault</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Market price and cost evidence records with reliability grading
            </p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Evidence</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Evidence Record</DialogTitle>
              </DialogHeader>
              <AddEvidenceForm
                onSubmit={(data) => createMutation.mutate(data)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Records</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.byGrade?.A ?? 0}</div>
                <div className="text-xs text-muted-foreground">Grade A (High Reliability)</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{Object.keys(stats.byCategory ?? {}).length}</div>
                <div className="text-xs text-muted-foreground">Categories Covered</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.avgConfidence}%</div>
                <div className="text-xs text-muted-foreground">Avg Confidence</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item, publisher, or record ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {GRADES.map(g => (
                <SelectItem key={g} value={g}>Grade {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Records Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading evidence records...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No evidence records found</p>
                <p className="text-xs mt-1">Add evidence records to build your market intelligence database</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium">Record ID</th>
                      <th className="text-left p-3 font-medium">Item</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-right p-3 font-medium">Price (AED)</th>
                      <th className="text-left p-3 font-medium">Unit</th>
                      <th className="text-center p-3 font-medium">Grade</th>
                      <th className="text-center p-3 font-medium">Confidence</th>
                      <th className="text-left p-3 font-medium">Source</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((rec: any) => (
                      <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{rec.recordId}</td>
                        <td className="p-3 font-medium">{rec.itemName}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs capitalize">{rec.category}</Badge>
                        </td>
                        <td className="p-3 text-right font-mono">
                          {rec.priceTypical ? Number(rec.priceTypical).toLocaleString() : "—"}
                          {rec.priceMin && rec.priceMax && (
                            <span className="text-xs text-muted-foreground block">
                              {Number(rec.priceMin).toLocaleString()} – {Number(rec.priceMax).toLocaleString()}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs">{rec.unit}</td>
                        <td className="p-3 text-center">
                          <Badge className={`${gradeColors[rec.reliabilityGrade]} text-xs`}>
                            {rec.reliabilityGrade}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs font-medium ${rec.confidenceScore >= 70 ? "text-emerald-400" : rec.confidenceScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                            {rec.confidenceScore}%
                          </span>
                        </td>
                        <td className="p-3">
                          <a href={rec.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 max-w-[150px] truncate">
                            {rec.publisher || new URL(rec.sourceUrl).hostname}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(rec.captureDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this evidence record?")) {
                                deleteMutation.mutate({ id: rec.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ─── Add Evidence Form ──────────────────────────────────────────────────────

function AddEvidenceForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({
    category: "floors" as string,
    itemName: "",
    specClass: "",
    priceMin: "",
    priceTypical: "",
    priceMax: "",
    unit: "per sqm",
    currencyOriginal: "AED",
    sourceUrl: "",
    publisher: "",
    captureDate: new Date().toISOString().split("T")[0],
    reliabilityGrade: "B" as string,
    confidenceScore: 60,
    extractedSnippet: "",
    notes: "",
  });

  const handleSubmit = () => {
    if (!form.itemName || !form.sourceUrl || !form.unit) {
      toast.error("Item name, source URL, and unit are required");
      return;
    }
    onSubmit({
      ...form,
      priceMin: form.priceMin ? Number(form.priceMin) : undefined,
      priceTypical: form.priceTypical ? Number(form.priceTypical) : undefined,
      priceMax: form.priceMax ? Number(form.priceMax) : undefined,
      confidenceScore: Number(form.confidenceScore),
      reliabilityGrade: form.reliabilityGrade as "A" | "B" | "C",
      category: form.category as any,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Item Name *</Label>
          <Input value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="e.g. Porcelain Tile 60x60" />
        </div>
      </div>

      <div>
        <Label>Spec Class</Label>
        <Input value={form.specClass} onChange={(e) => setForm({ ...form, specClass: e.target.value })} placeholder="e.g. Grade 1, Commercial, Premium" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Price Min (AED)</Label>
          <Input type="number" value={form.priceMin} onChange={(e) => setForm({ ...form, priceMin: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label>Price Typical (AED)</Label>
          <Input type="number" value={form.priceTypical} onChange={(e) => setForm({ ...form, priceTypical: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label>Price Max (AED)</Label>
          <Input type="number" value={form.priceMax} onChange={(e) => setForm({ ...form, priceMax: e.target.value })} placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Unit *</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="per sqm, per piece, per linear m" />
        </div>
        <div>
          <Label>Currency</Label>
          <Input value={form.currencyOriginal} onChange={(e) => setForm({ ...form, currencyOriginal: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Source URL *</Label>
          <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." />
        </div>
        <div>
          <Label>Publisher</Label>
          <Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} placeholder="e.g. RAK Ceramics" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Capture Date</Label>
          <Input type="date" value={form.captureDate} onChange={(e) => setForm({ ...form, captureDate: e.target.value })} />
        </div>
        <div>
          <Label>Reliability Grade</Label>
          <Select value={form.reliabilityGrade} onValueChange={(v) => setForm({ ...form, reliabilityGrade: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="A">A — Verified / Official</SelectItem>
              <SelectItem value="B">B — Reputable / Published</SelectItem>
              <SelectItem value="C">C — Unverified / Estimated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Confidence Score (0-100)</Label>
          <Input type="number" min={0} max={100} value={form.confidenceScore} onChange={(e) => setForm({ ...form, confidenceScore: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <Label>Extracted Snippet</Label>
        <Textarea value={form.extractedSnippet} onChange={(e) => setForm({ ...form, extractedSnippet: e.target.value })} placeholder="Relevant text extracted from the source..." rows={3} />
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional context or observations..." rows={2} />
      </div>

      <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Create Evidence Record"}
      </Button>
    </div>
  );
}
