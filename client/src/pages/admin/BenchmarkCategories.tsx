
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Layers, Filter } from "lucide-react";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORY_LABELS: Record<string, string> = {
  materials: "Materials",
  finishes: "Finishes",
  ffe: "FF&E",
  procurement: "Procurement",
  cost_bands: "Cost Bands",
  tier_definitions: "Tier Definitions",
  style_families: "Style Families",
  brand_archetypes: "Brand Archetypes",
  risk_factors: "Risk Factors",
  lead_times: "Lead Times",
};

const CLASS_LABELS: Record<string, string> = {
  mid: "Mid",
  upper: "Upper-mid",
  luxury: "Luxury",
  ultra_luxury: "Ultra-luxury",
};

export default function BenchmarkCategories() {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");

  const { data: categories, isLoading } = trpc.admin.benchmarkCategories.list.useQuery(
    filterCategory !== "all" || filterClass !== "all"
      ? { category: filterCategory !== "all" ? filterCategory : undefined, projectClass: filterClass !== "all" ? filterClass : undefined }
      : undefined
  );

  const grouped = useMemo(() => {
    if (!categories) return {};
    const g: Record<string, typeof categories> = {};
    for (const cat of categories) {
      const key = cat.category;
      if (!g[key]) g[key] = [];
      g[key].push(cat);
    }
    return g;
  }, [categories]);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Benchmark Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extended benchmark library: materials, finishes, FF&E, procurement ranges, cost bands, and more
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {Object.entries(CLASS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {categories?.length || 0} records
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !categories || categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No benchmark categories found.
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  {CATEGORY_LABELS[category] || category}
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Class</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Market</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Confidence</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Source</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Valid From</th>
                        <th className="text-center p-2 font-medium text-muted-foreground">Valid To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-t border-border/50">
                          <td className="p-2 text-foreground">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && <p className="text-muted-foreground text-[10px] mt-0.5">{item.description}</p>}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className="text-[10px]">
                              {CLASS_LABELS[item.projectClass] || item.projectClass}
                            </Badge>
                          </td>
                          <td className="p-2 text-center text-muted-foreground">{item.market} / {item.submarket}</td>
                          <td className="p-2 text-center">
                            <Badge
                              variant={item.confidenceLevel === "high" ? "default" : item.confidenceLevel === "medium" ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {item.confidenceLevel}
                            </Badge>
                          </td>
                          <td className="p-2 text-center text-muted-foreground">{item.sourceType}</td>
                          <td className="p-2 text-center text-muted-foreground">
                            {item.validFrom ? new Date(item.validFrom).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-2 text-center text-muted-foreground">
                            {item.validTo ? new Date(item.validTo).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
