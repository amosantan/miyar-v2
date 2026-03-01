import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
    MapPin, TrendingUp, Building2, DollarSign,
    ArrowUpDown, Search, Database, BarChart3,
} from "lucide-react";

function fmt(v: number | string | null | undefined): string {
    if (v == null) return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n) ? "—" : Math.round(n).toLocaleString();
}

function fmtPct(v: number | string | null | undefined): string {
    if (v == null) return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n) ? "—" : `${n.toFixed(1)}%`;
}

type SortKey = "areaName" | "saleP50" | "grossYield" | "fitoutMid" | "txnCount";

interface BenchmarkItem {
    id: number;
    areaName: string;
    saleP25: number | null;
    saleP50: number | null;
    saleP75: number | null;
    grossYield: number | null;
    fitoutLow: number | null;
    fitoutMid: number | null;
    fitoutHigh: number | null;
    txnCount: number;
    [key: string]: any;
}

export default function DldInsights() {
    const { data: benchmarks, isLoading } = trpc.design.getAreaBenchmarks.useQuery();
    const { data: stats } = trpc.design.getDldDataStats.useQuery();

    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("saleP50");
    const [sortAsc, setSortAsc] = useState(false);

    const sorted = useMemo(() => {
        if (!benchmarks) return [];
        let items = benchmarks.map((b: any) => ({
            id: b.areaId ?? b.id,
            areaName: b.areaName ?? b.areaNameEn ?? "Unknown",
            saleP25: b.saleP25 ?? b.recommendedFitoutLow ?? null,
            saleP50: b.saleP50 ?? null,
            saleP75: b.saleP75 ?? b.recommendedFitoutHigh ?? null,
            grossYield: b.grossYield ?? null,
            fitoutLow: b.recommendedFitoutLow ?? null,
            fitoutMid: b.recommendedFitoutMid ?? null,
            fitoutHigh: b.recommendedFitoutHigh ?? null,
            txnCount: (Number(b.transactionCount) || 0) + (Number(b.rentContractCount) || 0),
        }));

        if (search) {
            const q = search.toLowerCase();
            items = items.filter((i: BenchmarkItem) => i.areaName.toLowerCase().includes(q));
        }

        items.sort((a: BenchmarkItem, b: BenchmarkItem) => {
            const va = Number(a[sortKey]) || 0;
            const vb = Number(b[sortKey]) || 0;
            if (sortKey === "areaName") {
                return sortAsc
                    ? a.areaName.localeCompare(b.areaName)
                    : b.areaName.localeCompare(a.areaName);
            }
            return sortAsc ? va - vb : vb - va;
        });

        return items;
    }, [benchmarks, search, sortKey, sortAsc]);

    const topByYield = useMemo(() =>
        [...sorted]
            .filter(i => Number(i.grossYield) > 0)
            .sort((a, b) => Number(b.grossYield) - Number(a.grossYield))
            .slice(0, 10),
        [sorted],
    );

    const topBySale = useMemo(() =>
        [...sorted]
            .filter(i => Number(i.saleP50) > 0)
            .sort((a, b) => Number(b.saleP50) - Number(a.saleP50))
            .slice(0, 10),
        [sorted],
    );

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(false);
        }
    };

    if (isLoading) {
        return <PageSkeleton statCards={4} showTable />;
    }

    return (
        <div className="space-y-6 max-w-7xl">
            <PageHeader
                title="DLD Market Insights"
                description={`Dubai Land Department transaction & rent benchmarks across ${sorted.length} areas`}
                icon={MapPin}
                breadcrumbs={[{ label: "Market" }, { label: "DLD Insights" }]}
            />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { icon: Database, label: "Sale Transactions", value: fmt(stats?.transactionCount) },
                    { icon: Building2, label: "Rent Contracts", value: fmt(stats?.rentCount) },
                    { icon: MapPin, label: "Areas Benchmarked", value: String(sorted.length) },
                    { icon: DollarSign, label: "Avg Median Price", value: sorted.length > 0 ? `${fmt(sorted.reduce((s, i) => s + (Number(i.saleP50) || 0), 0) / sorted.length)} AED/sqm` : "—" },
                ].map(s => (
                    <Card key={s.label}>
                        <CardContent className="pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <s.icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                            </div>
                            <p className="text-lg font-bold text-foreground">{s.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Top Areas Side by Side */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Top by Yield */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-500" /> Top Areas by Gross Yield
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pb-3">
                        {topByYield.map((item, i) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm">
                                <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                                <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden relative">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/70 to-emerald-400/40 rounded-sm"
                                        style={{ width: `${Math.min(100, (Number(item.grossYield) / (Number(topByYield[0]?.grossYield) || 1)) * 100)}%` }}
                                    />
                                    <span className="relative px-2 text-xs font-medium truncate block leading-5">{item.areaName}</span>
                                </div>
                                <span className="text-xs font-semibold text-emerald-600 w-14 text-right">{fmtPct(item.grossYield)}</span>
                            </div>
                        ))}
                        {topByYield.length === 0 && <p className="text-xs text-muted-foreground">No yield data available</p>}
                    </CardContent>
                </Card>

                {/* Top by Sale Price */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1.5">
                            <DollarSign className="h-4 w-4 text-amber-500" /> Highest Median Sale Price
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pb-3">
                        {topBySale.map((item, i) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm">
                                <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                                <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden relative">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/70 to-amber-400/40 rounded-sm"
                                        style={{ width: `${Math.min(100, (Number(item.saleP50) / (Number(topBySale[0]?.saleP50) || 1)) * 100)}%` }}
                                    />
                                    <span className="relative px-2 text-xs font-medium truncate block leading-5">{item.areaName}</span>
                                </div>
                                <span className="text-xs font-semibold text-amber-600 w-24 text-right">{fmt(item.saleP50)} /sqm</span>
                            </div>
                        ))}
                        {topBySale.length === 0 && <p className="text-xs text-muted-foreground">No sale data available</p>}
                    </CardContent>
                </Card>
            </div>

            <Separator />

            {/* Full Area Table */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4" /> All Area Benchmarks
                    </h2>
                    <div className="relative w-60">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Filter areas..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-muted/50 text-left">
                                    {(
                                        [
                                            ["areaName", "Area"],
                                            ["saleP50", "Sale P50 (AED/sqm)"],
                                            ["grossYield", "Yield"],
                                            ["fitoutMid", "Fitout Rec."],
                                            ["txnCount", "Records"],
                                        ] as [SortKey, string][]
                                    ).map(([key, label]) => (
                                        <th
                                            key={key}
                                            className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold cursor-pointer hover:text-foreground transition-colors select-none"
                                            onClick={() => toggleSort(key)}
                                        >
                                            <span className="flex items-center gap-1">
                                                {label}
                                                {sortKey === key && <ArrowUpDown className="h-3 w-3" />}
                                            </span>
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                        Price Range
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(item => (
                                    <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
                                        <td className="px-3 py-2 font-medium">{item.areaName}</td>
                                        <td className="px-3 py-2 tabular-nums">{fmt(item.saleP50)}</td>
                                        <td className="px-3 py-2">
                                            {Number(item.grossYield) > 0 ? (
                                                <Badge
                                                    variant={Number(item.grossYield) >= 7 ? "default" : Number(item.grossYield) >= 5 ? "secondary" : "outline"}
                                                    className="text-[10px]"
                                                >
                                                    {fmtPct(item.grossYield)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums">{fmt(item.fitoutMid)}</td>
                                        <td className="px-3 py-2 text-muted-foreground tabular-nums">{fmt(item.txnCount)}</td>
                                        <td className="px-3 py-2">
                                            {Number(item.saleP25) > 0 && Number(item.saleP75) > 0 ? (
                                                <span className="text-xs text-muted-foreground">{fmt(item.saleP25)}–{fmt(item.saleP75)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {sorted.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                                            {search ? "No areas match your search" : "No DLD benchmark data available"}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2">
                    Source: Dubai Land Department · {fmt(stats?.transactionCount)} transactions + {fmt(stats?.rentCount)} rent contracts · Units: AED/sqm
                </p>
            </div>
        </div>
    );
}
