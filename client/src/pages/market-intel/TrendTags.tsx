import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Tags, Trash2, Hash } from "lucide-react";

const TAG_CATEGORIES = [
  "material_trend", "design_trend", "market_trend",
  "buyer_preference", "sustainability", "technology", "pricing", "other",
] as const;

const categoryLabels: Record<string, string> = {
  material_trend: "Material Trend",
  design_trend: "Design Trend",
  market_trend: "Market Trend",
  buyer_preference: "Buyer Preference",
  sustainability: "Sustainability",
  technology: "Technology",
  pricing: "Pricing",
  other: "Other",
};

const categoryColors: Record<string, string> = {
  material_trend: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  design_trend: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  market_trend: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  buyer_preference: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  sustainability: "bg-green-500/20 text-green-400 border-green-500/30",
  technology: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  pricing: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default function TrendTags() {
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: tags, isLoading, refetch } = trpc.marketIntel.tags.list.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const createMutation = trpc.marketIntel.tags.create.useMutation({
    onSuccess: () => { toast.success("Tag created"); setShowAdd(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.marketIntel.tags.delete.useMutation({
    onSuccess: () => { toast.success("Tag deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const tag of (tags ?? [])) {
      const cat = (tag as any).category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tag);
    }
    return groups;
  }, [tags]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trend Tags</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Controlled vocabulary tags for market signals — attach to competitors and scenarios
            </p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Tag</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Create Trend Tag</DialogTitle></DialogHeader>
              <TagForm onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex gap-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {TAG_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground flex items-center">
            {(tags ?? []).length} tags total
          </div>
        </div>

        {/* Tags by Category */}
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading tags...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Tags className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground">No trend tags defined yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create tags to track market signals and trends</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, catTags]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  {categoryLabels[category] ?? category}
                  <Badge variant="outline" className="text-xs ml-1">{catTags.length}</Badge>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {catTags.map((tag: any) => (
                    <div key={tag.id} className="group relative">
                      <Badge className={`${categoryColors[category] ?? categoryColors.other} text-sm px-3 py-1.5 cursor-default`}>
                        {tag.name}
                        <button
                          className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-destructive"
                          onClick={() => { if (confirm(`Delete tag "${tag.name}"?`)) deleteMutation.mutate({ id: tag.id }); }}
                        >
                          ×
                        </button>
                      </Badge>
                      {tag.description && (
                        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {tag.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TagForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ name: "", category: "market_signal" as string, description: "" });

  return (
    <div className="space-y-4">
      <div>
        <Label>Tag Name *</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. biophilic design" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TAG_CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description of this trend or signal..." />
      </div>
      <Button onClick={() => { if (!form.name) { toast.error("Name required"); return; } onSubmit(form); }} disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Create Tag"}
      </Button>
    </div>
  );
}
