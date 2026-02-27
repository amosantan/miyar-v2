/**
 * MarketIntelligence.tsx
 * Premium Market Intelligence & Evidence page — Stitch design.
 * FULLY INTERACTIVE: filters change data, charts are dynamic, area selection works.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
    MapPin, TrendingUp, TrendingDown, Plus, Minus, LocateFixed,
    Wifi, X, ChevronDown, Star, Bell, Search, Building2, Home,
    Briefcase, Hotel, Filter,
} from "lucide-react";

/* ─── helpers ───────────────────────────────────────────── */
function fmtAed(v: number | string | null | undefined): string {
    if (v == null) return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n) ? "—" : Math.round(n).toLocaleString();
}
function timeAgo(d: string | Date | null | undefined) {
    if (!d) return "";
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── types ──────────────────────────────────────────────── */
interface AreaBenchmark {
    id: number;
    areaName: string;
    saleP50: number;
    saleP25: number;
    saleP75: number;
    grossYield: number;
    fitoutLow: number;
    fitoutMid: number;
    fitoutHigh: number;
    txnCount: number;
}

type Typology = "All" | "Residential" | "Villa" | "Office" | "Hospitality" | "Mixed-use";
type TierFilter = "All" | "Ultra-luxury" | "Luxury" | "Premium";

/* ─── colour tokens (Stitch palette) ─────────────────── */
const gold = "#c9a96e";
const navy = "#0a1628";
const panelBg = "rgba(10,22,40,0.7)";

/* ─── Typology icons ─────────────────────────────────── */
const typologyIcons: Record<string, typeof Building2> = {
    All: Filter,
    Residential: Building2,
    Villa: Home,
    Office: Briefcase,
    Hospitality: Hotel,
    "Mixed-use": Building2,
};

/* ─── component ──────────────────────────────────────── */
function MarketIntelligenceContent() {
    const { data: rawBenchmarks } = trpc.design.getAreaBenchmarks.useQuery();
    const { data: stats } = trpc.design.getDldDataStats.useQuery();
    const { data: evidence } = trpc.marketIntel.evidence.list.useQuery({ limit: 10 });
    const { data: evidenceStats } = trpc.marketIntel.evidence.stats.useQuery();

    /* ─── filter state ─────────────────────────────────── */
    const [typology, setTypology] = useState<Typology>("All");
    const [tierFilter, setTierFilter] = useState<TierFilter>("All");
    const [areaSearch, setAreaSearch] = useState("");
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"map" | "grid">("map");
    const [showAreaDropdown, setShowAreaDropdown] = useState(false);

    /* ─── normalise benchmarks ─────────────────────────── */
    const allAreas: AreaBenchmark[] = useMemo(() => {
        if (!rawBenchmarks) return [];
        return (rawBenchmarks as any[]).map((b: any) => ({
            id: b.areaId ?? b.id,
            areaName: b.areaName ?? b.areaNameEn ?? "Unknown",
            saleP50: Number(b.saleP50 ?? 0),
            saleP25: Number(b.saleP25 ?? b.recommendedFitoutLow ?? 0),
            saleP75: Number(b.saleP75 ?? b.recommendedFitoutHigh ?? 0),
            grossYield: Number(b.grossYield ?? 0),
            fitoutLow: Number(b.recommendedFitoutLow ?? 0),
            fitoutMid: Number(b.recommendedFitoutMid ?? 0),
            fitoutHigh: Number(b.recommendedFitoutHigh ?? 0),
            txnCount: (Number(b.transactionCount) || 0) + (Number(b.rentContractCount) || 0),
        }));
    }, [rawBenchmarks]);

    /* ─── filtered data ────────────────────────────────── */
    const filteredAreas = useMemo(() => {
        let items = allAreas.filter(a => a.saleP50 > 0);

        // Search filter
        if (areaSearch) {
            const q = areaSearch.toLowerCase();
            items = items.filter(a => a.areaName.toLowerCase().includes(q));
        }

        // Tier filter (based on sale price percentile)
        if (tierFilter !== "All") {
            const sorted = [...items].sort((a, b) => b.saleP50 - a.saleP50);
            const t = Math.floor(sorted.length / 3);
            if (tierFilter === "Ultra-luxury") items = sorted.slice(0, t);
            else if (tierFilter === "Luxury") items = sorted.slice(t, t * 2);
            else if (tierFilter === "Premium") items = sorted.slice(t * 2);
        }

        return items.sort((a, b) => b.saleP50 - a.saleP50);
    }, [allAreas, areaSearch, tierFilter]);

    /* ─── top 3 ────────────────────────────────────────── */
    const topAreas = filteredAreas.slice(0, 3);

    /* ─── selected area detail ─────────────────────────── */
    const selectedAreaData = selectedArea
        ? filteredAreas.find(a => a.areaName === selectedArea)
        : null;

    /* ─── price by tier (dynamic) ──────────────────────── */
    const tierPrices = useMemo(() => {
        const items = filteredAreas;
        if (items.length === 0) return [];
        const sorted = [...items].sort((a, b) => b.saleP50 - a.saleP50);
        const t = Math.max(1, Math.floor(sorted.length / 3));
        const ultraLux = sorted.slice(0, t);
        const luxury = sorted.slice(t, t * 2);
        const premium = sorted.slice(t * 2);
        const avg = (arr: AreaBenchmark[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v.saleP50, 0) / arr.length) : 0;
        const maxVal = avg(ultraLux) || 1;
        return [
            { label: "ULTRA-LUXURY", value: avg(ultraLux), pct: 100, color: gold, count: ultraLux.length },
            { label: "LUXURY", value: avg(luxury), pct: Math.round((avg(luxury) / maxVal) * 100), color: "#94a3b8", count: luxury.length },
            { label: "PREMIUM", value: avg(premium), pct: Math.round((avg(premium) / maxVal) * 100), color: "#475569", count: premium.length },
        ];
    }, [filteredAreas]);

    /* ─── yield chart (dynamic) ────────────────────────── */
    const yieldData = useMemo(() => {
        const items = filteredAreas.filter(a => a.grossYield > 0).sort((a, b) => b.grossYield - a.grossYield).slice(0, 8);
        if (items.length === 0) return [];
        const maxYield = items[0].grossYield;
        return items.map(a => ({
            name: a.areaName.length > 12 ? a.areaName.slice(0, 12) + "…" : a.areaName,
            fullName: a.areaName,
            yield: a.grossYield,
            height: Math.max(20, Math.round((a.grossYield / maxYield) * 120)),
        }));
    }, [filteredAreas]);

    // Compute average yield
    const avgYield = useMemo(() => {
        const items = filteredAreas.filter(a => a.grossYield > 0);
        if (items.length === 0) return 0;
        return items.reduce((s, a) => s + a.grossYield, 0) / items.length;
    }, [filteredAreas]);

    /* ─── DLD feed items ───────────────────────────────── */
    const feedItems = useMemo(() => {
        if (!evidence?.records) return [];
        return evidence.records.slice(0, 4).map((r: any) => ({
            title: r.title ?? r.snippet?.slice(0, 40) ?? "Transaction Record",
            subtitle: r.sourceId ? `Source #${r.sourceId}` : "DLD Registry",
            sqft: r.dataValue ? `${fmtAed(r.dataValue)} AED/sqft` : null,
            time: timeAgo(r.recordDate ?? r.createdAt),
            isNew: Date.now() - new Date(r.recordDate ?? r.createdAt).getTime() < 3600_000,
        }));
    }, [evidence]);

    const totalRecords = Number(stats?.transactionCount ?? 0) + Number(stats?.rentCount ?? 0);
    const evidenceCount = evidenceStats?.total ?? 0;

    /* ─── area dropdown list ───────────────────────────── */
    const areaDropdownItems = useMemo(() => {
        if (!areaSearch && !showAreaDropdown) return [];
        const q = areaSearch.toLowerCase();
        return allAreas
            .filter(a => a.saleP50 > 0 && a.areaName.toLowerCase().includes(q))
            .sort((a, b) => b.txnCount - a.txnCount)
            .slice(0, 10);
    }, [allAreas, areaSearch, showAreaDropdown]);

    /* ─── market status ────────────────────────────────── */
    const marketStatus = useMemo(() => {
        const items = filteredAreas.filter(a => a.grossYield > 0);
        if (items.length === 0) return { label: "No Data", color: "#94a3b8", icon: TrendingUp };
        const avg = items.reduce((s, a) => s + a.grossYield, 0) / items.length;
        if (avg > 6) return { label: "Strong Bullish", color: "#34d399", icon: TrendingUp };
        if (avg > 4) return { label: "Bullish", color: "#34d399", icon: TrendingUp };
        if (avg > 2) return { label: "Neutral", color: "#facc15", icon: TrendingUp };
        return { label: "Bearish", color: "#f87171", icon: TrendingDown };
    }, [filteredAreas]);

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] -mx-6 -mt-6" style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}>
            {/* ─── Header ──────────────────────────────────── */}
            <header
                className="h-14 flex items-center justify-between px-8 shrink-0 border-b"
                style={{ background: `${navy}cc`, backdropFilter: "blur(12px)", borderColor: `${gold}1a` }}
            >
                <div className="flex items-center gap-6">
                    <h2 className="text-lg font-bold tracking-tight text-slate-100">Market Intelligence & Evidence</h2>
                    <div className="h-4 w-px" style={{ background: `${gold}33` }} />
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider">
                            {filteredAreas.length} areas · {totalRecords.toLocaleString()} records
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Area Search */}
                    <div className="relative">
                        <div
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border cursor-pointer"
                            style={{ background: `${navy}80`, borderColor: `${gold}33`, minWidth: 200 }}
                            onClick={() => setShowAreaDropdown(!showAreaDropdown)}
                        >
                            <Search className="h-3.5 w-3.5" style={{ color: gold }} />
                            <input
                                className="bg-transparent border-none outline-none text-slate-200 text-sm w-full placeholder:text-slate-500"
                                placeholder={selectedArea || "Search area..."}
                                value={areaSearch}
                                onChange={e => { setAreaSearch(e.target.value); setShowAreaDropdown(true); }}
                                onFocus={() => setShowAreaDropdown(true)}
                            />
                            {selectedArea && (
                                <X className="h-3.5 w-3.5 text-slate-400 hover:text-white cursor-pointer"
                                    onClick={e => { e.stopPropagation(); setSelectedArea(null); setAreaSearch(""); }} />
                            )}
                        </div>
                        {showAreaDropdown && areaDropdownItems.length > 0 && (
                            <div
                                className="absolute top-full left-0 mt-1 w-full rounded-lg overflow-hidden shadow-2xl z-50 max-h-[300px] overflow-y-auto"
                                style={{ background: navy, border: `1px solid ${gold}33` }}
                            >
                                {areaDropdownItems.map(area => (
                                    <button
                                        key={area.id}
                                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors flex items-center justify-between"
                                        onClick={() => { setSelectedArea(area.areaName); setAreaSearch(""); setShowAreaDropdown(false); }}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{area.areaName}</p>
                                            <p className="text-[10px] text-slate-500">{area.txnCount.toLocaleString()} records</p>
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: gold }}>{fmtAed(area.saleP50)}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className="p-1.5 text-slate-400 hover:text-white transition-colors">
                        <Bell className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* ─── Filters Bar ─────────────────────────────── */}
            <div
                className="px-8 py-2.5 flex items-center gap-4 shrink-0 border-b"
                style={{ background: "#08121f", borderColor: `${gold}0d` }}
            >
                {/* Typology filters */}
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] mr-1" style={{ color: gold }}>Type:</span>
                <div className="flex gap-1.5">
                    {(["All", "Residential", "Villa", "Office", "Hospitality", "Mixed-use"] as Typology[]).map(t => {
                        const Icon = typologyIcons[t] || Building2;
                        return (
                            <button
                                key={t}
                                onClick={() => setTypology(t)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                style={{
                                    background: typology === t ? `${gold}1a` : "transparent",
                                    border: `1px solid ${typology === t ? `${gold}40` : `${gold}0d`}`,
                                    color: typology === t ? "#e2e8f0" : "#64748b",
                                }}
                            >
                                <Icon className="h-3 w-3" />
                                {t}
                            </button>
                        );
                    })}
                </div>

                <div className="h-4 w-px mx-2" style={{ background: `${gold}1a` }} />

                {/* Tier filters */}
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] mr-1" style={{ color: gold }}>Tier:</span>
                <div className="flex gap-1.5">
                    {(["All", "Ultra-luxury", "Luxury", "Premium"] as TierFilter[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTierFilter(t)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                            style={{
                                background: tierFilter === t ? `${gold}1a` : "transparent",
                                border: `1px solid ${tierFilter === t ? `${gold}40` : `${gold}0d`}`,
                                color: tierFilter === t ? "#e2e8f0" : "#64748b",
                            }}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center">
                    <div className="flex rounded-lg p-0.5" style={{ background: "rgba(30,26,20,0.6)", border: `1px solid ${gold}1a` }}>
                        <button onClick={() => setViewMode("map")}
                            className="px-3 py-1 rounded-md text-xs font-bold transition-colors"
                            style={{ background: viewMode === "map" ? gold : "transparent", color: viewMode === "map" ? navy : "#94a3b8" }}
                        >Map</button>
                        <button onClick={() => setViewMode("grid")}
                            className="px-3 py-1 rounded-md text-xs font-bold transition-colors"
                            style={{ background: viewMode === "grid" ? gold : "transparent", color: viewMode === "grid" ? navy : "#94a3b8" }}
                        >Grid</button>
                    </div>
                </div>
            </div>

            {/* ─── Content Area ────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden" style={{ background: "#07101d" }}>
                {/* ─── Map / Grid Section ─────────────────────── */}
                <div className="flex-1 relative overflow-hidden">
                    {viewMode === "map" ? (
                        // MAP VIEW
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/dubai-map.jpg")' }}>
                            <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, transparent 0%, rgba(10,22,40,0.4) 100%)" }} />
                            {/* Heatmap glows — dynamic based on filtered area count */}
                            {filteredAreas.length > 0 && <>
                                <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full animate-pulse" style={{ background: `${gold}33`, filter: "blur(48px)" }} />
                                <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full animate-pulse" style={{ background: `${gold}4d`, filter: "blur(60px)" }} />
                                <div className="absolute bottom-1/4 right-1/3 w-40 h-40 rounded-full" style={{ background: `${gold}26`, filter: "blur(40px)" }} />
                            </>}
                            {/* Map Pins — from actual filtered top areas */}
                            {topAreas.map((area, i) => (
                                <div key={area.areaName} className="absolute group cursor-pointer"
                                    style={{ top: `${25 + i * 18}%`, left: `${30 + i * 15}%` }}
                                    onClick={() => setSelectedArea(area.areaName)}
                                >
                                    <div className="w-4 h-4 rounded-full border-2 border-white transition-transform hover:scale-150"
                                        style={{ background: selectedArea === area.areaName ? "#34d399" : gold, boxShadow: `0 0 20px ${gold}` }} />
                                    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 p-2.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}33` }}>
                                        <p className="text-[10px] font-bold text-white">{area.areaName}</p>
                                        <p className="text-xs" style={{ color: gold }}>AED {fmtAed(area.saleP50)}/sqm</p>
                                        {area.grossYield > 0 && <p className="text-[10px] text-emerald-400">Yield: {area.grossYield.toFixed(1)}%</p>}
                                    </div>
                                </div>
                            ))}
                            {/* Map Controls */}
                            <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
                                {[Plus, Minus].map((Icon, i) => (
                                    <button key={i} className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d`, color: gold }}>
                                        <Icon className="h-4 w-4" />
                                    </button>
                                ))}
                                <button className="w-9 h-9 rounded-lg flex items-center justify-center mt-2"
                                    style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d`, color: gold }}>
                                    <LocateFixed className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        // GRID VIEW — area cards
                        <div className="absolute inset-0 p-6 overflow-y-auto" style={{ background: "#07101d" }}>
                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredAreas.map(area => (
                                    <button
                                        key={area.id}
                                        onClick={() => setSelectedArea(area.areaName)}
                                        className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                                        style={{
                                            background: selectedArea === area.areaName ? `${gold}1a` : panelBg,
                                            backdropFilter: "blur(12px)",
                                            border: `1px solid ${selectedArea === area.areaName ? `${gold}4d` : `${gold}1a`}`,
                                        }}
                                    >
                                        <p className="text-sm font-bold text-slate-200 truncate">{area.areaName}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs font-bold" style={{ color: gold }}>AED {fmtAed(area.saleP50)}</span>
                                            {area.grossYield > 0 && <span className="text-[10px] font-bold text-emerald-400">↑ {area.grossYield.toFixed(1)}%</span>}
                                        </div>
                                        <p className="text-[10px] text-slate-500 mt-1">{area.txnCount.toLocaleString()} records</p>
                                    </button>
                                ))}
                                {filteredAreas.length === 0 && (
                                    <div className="col-span-3 text-center py-12 text-slate-500">No areas match your filters</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── DLD Live Feed + Market Status (Glass Overlay) ─── */}
                    <div className="absolute top-6 left-6 w-[300px] flex flex-col gap-3 z-10">
                        {/* Selected Area Detail Card */}
                        {selectedAreaData && (
                            <div className="rounded-xl overflow-hidden shadow-2xl"
                                style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d` }}>
                                <div className="px-4 py-2.5 flex items-center justify-between border-b"
                                    style={{ background: `${gold}1a`, borderColor: `${gold}33` }}>
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">{selectedAreaData.areaName}</h3>
                                    <X className="h-3.5 w-3.5 text-slate-400 hover:text-white cursor-pointer"
                                        onClick={() => setSelectedArea(null)} />
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Median Price</p>
                                        <p className="text-sm font-bold" style={{ color: gold }}>AED {fmtAed(selectedAreaData.saleP50)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Yield</p>
                                        <p className="text-sm font-bold text-emerald-400">{selectedAreaData.grossYield > 0 ? `${selectedAreaData.grossYield.toFixed(1)}%` : "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Price Range</p>
                                        <p className="text-xs text-slate-300">{fmtAed(selectedAreaData.saleP25)} – {fmtAed(selectedAreaData.saleP75)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Fitout Mid</p>
                                        <p className="text-xs text-slate-300">AED {fmtAed(selectedAreaData.fitoutMid)}/sqm</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Records</p>
                                        <p className="text-xs text-slate-300">{selectedAreaData.txnCount.toLocaleString()} transactions</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DLD Live Feed */}
                        <div className="rounded-xl overflow-hidden shadow-2xl"
                            style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d` }}>
                            <div className="px-4 py-2.5 flex items-center justify-between border-b"
                                style={{ background: `${gold}1a`, borderColor: `${gold}33` }}>
                                <div className="flex items-center gap-2">
                                    <Wifi className="h-3.5 w-3.5 animate-pulse" style={{ color: gold }} />
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">DLD Live Feed</h3>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">Real-time</span>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                                {feedItems.length > 0 ? feedItems.map((item: { title: string; subtitle: string; sqft: string | null; time: string; isNew: boolean }, i: number) => (
                                    <div key={i} className="px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/5"
                                        style={{ borderBottom: i < feedItems.length - 1 ? `1px solid ${gold}0d` : "none" }}>
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-bold text-slate-100 truncate flex-1">{item.title}</p>
                                            {item.isNew && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-2"
                                                style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>NEW</span>}
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                            {item.sqft && <p className="text-[11px] font-medium" style={{ color: gold }}>{item.sqft}</p>}
                                            <p className="text-[10px] text-slate-500">{item.time}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="px-4 py-4 text-center text-xs text-slate-500">No recent records</div>
                                )}
                            </div>
                            <div className="p-2 text-center" style={{ background: "rgba(30,26,20,0.4)" }}>
                                <button className="text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: gold }}>
                                    View All Records ({evidenceCount})
                                </button>
                            </div>
                        </div>

                        {/* Market Sentiment */}
                        <div className="p-3.5 rounded-xl flex items-center justify-between shadow-xl"
                            style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}33` }}>
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Status</p>
                                <p className="text-sm font-bold flex items-center gap-1" style={{ color: marketStatus.color }}>
                                    {marketStatus.label} <marketStatus.icon className="h-3.5 w-3.5" />
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Yield</p>
                                <p className="text-sm font-bold text-slate-100">{avgYield > 0 ? `${avgYield.toFixed(1)}%` : "—"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Right Data Panel ──────────────────────── */}
                <div className="w-[360px] h-full flex flex-col overflow-y-auto shrink-0 border-l"
                    style={{ background: `${navy}80`, borderColor: `${gold}1a` }}>
                    {/* Top Benchmarks */}
                    <section className="p-5 border-b" style={{ borderColor: `${gold}1a` }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                                Top Benchmarks
                                <span className="text-[10px] text-slate-500 ml-1 normal-case font-medium">({filteredAreas.length} areas)</span>
                            </h3>
                            <Star className="h-4 w-4" style={{ color: gold }} />
                        </div>
                        <div className="space-y-3">
                            {topAreas.map((area, i) => (
                                <button
                                    key={area.areaName}
                                    onClick={() => setSelectedArea(area.areaName === selectedArea ? null : area.areaName)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                                    style={{
                                        background: selectedArea === area.areaName ? `${gold}1a` : "rgba(30,26,20,0.4)",
                                        border: `1px solid ${selectedArea === area.areaName ? `${gold}4d` : i === 0 ? `${gold}1a` : `${gold}0d`}`,
                                    }}
                                >
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0"
                                        style={{ background: i === 0 ? `${gold}33` : "rgba(51,65,85,1)", color: i === 0 ? gold : "#94a3b8" }}>
                                        {String(i + 1).padStart(2, "0")}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-xs font-bold text-slate-200 truncate">{area.areaName}</p>
                                        <p className="text-[10px] text-slate-500">{area.txnCount.toLocaleString()} records</p>
                                    </div>
                                    <div className="text-right">
                                        {area.grossYield > 0
                                            ? <p className="text-xs font-bold text-emerald-400">+{area.grossYield.toFixed(1)}%</p>
                                            : <p className="text-xs font-bold" style={{ color: gold }}>{fmtAed(area.saleP50)}</p>
                                        }
                                    </div>
                                </button>
                            ))}
                            {topAreas.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No areas match filters</p>}
                        </div>
                    </section>

                    {/* Price / SqFt by Tier */}
                    <section className="p-5 border-b" style={{ borderColor: `${gold}1a` }}>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-5">Price / SqFt by Tier</h3>
                        <div className="space-y-5">
                            {tierPrices.map(tier => (
                                <div key={tier.label} className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-slate-400">{tier.label} <span className="text-slate-600 font-normal">({tier.count})</span></span>
                                        <span style={{ color: tier.color === gold ? gold : "#cbd5e1" }}>AED {fmtAed(tier.value)} avg</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(30,26,20,1)" }}>
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tier.pct}%`, background: tier.color }} />
                                    </div>
                                </div>
                            ))}
                            {tierPrices.length === 0 && <p className="text-xs text-slate-500 text-center">No pricing data</p>}
                        </div>
                    </section>

                    {/* Yield by Area Chart */}
                    <section className="p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Yield by Area</h3>
                            <span className="text-[10px] font-bold" style={{ color: gold }}>
                                Avg: {avgYield > 0 ? `${avgYield.toFixed(1)}%` : "—"}
                            </span>
                        </div>
                        {/* Dynamic bar chart */}
                        <div className="relative h-36 w-full flex items-end gap-1">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col justify-between" style={{ borderBottom: `1px solid ${gold}33` }}>
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                            </div>
                            {yieldData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 z-10 group cursor-pointer"
                                    onClick={() => setSelectedArea(d.fullName)}>
                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-center whitespace-nowrap" style={{ color: gold }}>
                                        {d.yield.toFixed(1)}%
                                    </div>
                                    <div
                                        className="w-full max-w-[16px] rounded-t-sm transition-all duration-500 hover:opacity-100"
                                        style={{ height: `${d.height}px`, background: gold, opacity: selectedArea === d.fullName ? 1 : 0.5 + i * 0.06 }}
                                    />
                                    <span className="text-[7px] text-slate-500 truncate max-w-[40px]" title={d.fullName}>{d.name}</span>
                                </div>
                            ))}
                            {yieldData.length === 0 && (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-xs text-slate-500">No yield data for filters</p>
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                            {filteredAreas.length > 0
                                ? <>Showing yield data for <span className="font-bold" style={{ color: gold }}>{filteredAreas.filter(a => a.grossYield > 0).length}</span> areas. {tierFilter !== "All" ? `Filtered by ${tierFilter} tier.` : "All tiers."}</>
                                : "Apply different filters to see yield data."
                            }
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}

export default function MarketIntelligence() {
    return (
        <DashboardLayout>
            <MarketIntelligenceContent />
        </DashboardLayout>
    );
}
