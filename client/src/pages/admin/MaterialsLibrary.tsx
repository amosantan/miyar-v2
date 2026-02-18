import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Package, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["tile", "stone", "wood", "metal", "fabric", "glass", "paint", "wallpaper", "lighting", "furniture", "fixture", "accessory", "other"] as const;
const TIERS = ["economy", "mid", "premium", "luxury", "ultra_luxury"] as const;
const LEAD_BANDS = ["short", "medium", "long", "critical"] as const;

export default function MaterialsLibrary() {
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterTier, setFilterTier] = useState<string>("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "", category: "stone" as typeof CATEGORIES[number], tier: "mid" as typeof TIERS[number],
    typicalCostLow: "", typicalCostHigh: "", costUnit: "AED/sqm",
    leadTimeDays: "", leadTimeBand: "medium" as typeof LEAD_BANDS[number],
    supplierName: "", notes: "",
  });

  const materials = trpc.design.listMaterials.useQuery({
    category: filterCategory || undefined,
    tier: filterTier || undefined,
  });

  const createMutation = trpc.design.createMaterial.useMutation({
    onSuccess: () => {
      toast.success("Material created");
      materials.refetch();
      setCreateOpen(false);
    },
    onError: (err) => toast.error("Failed", { description: err.message }),
  });

  const deleteMutation = trpc.design.deleteMaterial.useMutation({
    onSuccess: () => {
      toast.success("Material archived");
      materials.refetch();
    },
  });

  const filtered = useMemo(() => {
    if (!materials.data) return [];
    if (!search) return materials.data;
    const lower = search.toLowerCase();
    return materials.data.filter(m =>
      m.name.toLowerCase().includes(lower) ||
      m.supplierName?.toLowerCase().includes(lower) ||
      m.notes?.toLowerCase().includes(lower)
    );
  }, [materials.data, search]);

  const tierColors: Record<string, string> = {
    economy: "bg-gray-100 text-gray-700",
    mid: "bg-blue-100 text-blue-700",
    premium: "bg-purple-100 text-purple-700",
    luxury: "bg-amber-100 text-amber-700",
    ultra_luxury: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Materials Library</h2>
          <p className="text-muted-foreground">{materials.data?.length || 0} materials in catalog</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Material</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Material to Catalog</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Material name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
                  <SelectContent>{TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input placeholder="Cost low" type="number" value={form.typicalCostLow} onChange={e => setForm(f => ({ ...f, typicalCostLow: e.target.value }))} />
                <Input placeholder="Cost high" type="number" value={form.typicalCostHigh} onChange={e => setForm(f => ({ ...f, typicalCostHigh: e.target.value }))} />
                <Input placeholder="Unit" value={form.costUnit} onChange={e => setForm(f => ({ ...f, costUnit: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Lead time (days)" type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))} />
                <Select value={form.leadTimeBand} onValueChange={v => setForm(f => ({ ...f, leadTimeBand: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Lead band" /></SelectTrigger>
                  <SelectContent>{LEAD_BANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input placeholder="Supplier name" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
              <Input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  name: form.name,
                  category: form.category,
                  tier: form.tier,
                  typicalCostLow: form.typicalCostLow ? Number(form.typicalCostLow) : undefined,
                  typicalCostHigh: form.typicalCostHigh ? Number(form.typicalCostHigh) : undefined,
                  costUnit: form.costUnit,
                  leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
                  leadTimeBand: form.leadTimeBand,
                  supplierName: form.supplierName || undefined,
                  notes: form.notes || undefined,
                })}
                disabled={!form.name || createMutation.isPending}
              >
                Add to Catalog
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTier} onValueChange={setFilterTier}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {TIERS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Materials Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No materials found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(mat => (
            <Card key={mat.id} className="group">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{mat.name}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{mat.category}</Badge>
                      <Badge className={`text-xs ${tierColors[mat.tier] || ""}`}>{mat.tier}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteMutation.mutate({ id: mat.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Cost: {mat.typicalCostLow}–{mat.typicalCostHigh} {mat.costUnit}</span>
                  <span>Lead: {mat.leadTimeDays}d ({mat.leadTimeBand})</span>
                  {mat.supplierName && <span className="col-span-2">Supplier: {mat.supplierName}</span>}
                </div>
                {mat.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{mat.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
