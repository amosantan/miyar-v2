/**
 * MarketIntelligence.tsx
 * Premium Market Intelligence & Evidence page — Stitch design.
 * Dark-themed Dubai map, DLD live feed, benchmarks, price bars, yield chart.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
    MapPin, TrendingUp, Plus, Minus, LocateFixed,
    Wifi, X, ChevronDown, Calendar, Star, Bell,
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
    if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── colour tokens (Stitch palette) ─────────────────── */
const gold = "#c9a96e";
const navy = "#0a1628";
const deepNavy = "#050b14";
const panelBg = "rgba(10,22,40,0.7)";

/* ─── component ──────────────────────────────────────── */
function MarketIntelligenceContent() {
    const { data: benchmarks } = trpc.design.getAreaBenchmarks.useQuery();
    const { data: stats } = trpc.design.getDldDataStats.useQuery();
    const { data: evidence } = trpc.marketIntel.evidence.list.useQuery({
        limit: 10,
    });
    const { data: evidenceStats } = trpc.marketIntel.evidence.stats.useQuery();

    const [viewMode, setViewMode] = useState<"map" | "grid">("map");
    const [activeFilter, setActiveFilter] = useState("Penthouse");

    /* ─── derived data ─────────────────────────────────── */
    const topAreas = useMemo(() => {
        if (!benchmarks) return [];
        return [...benchmarks]
            .map((b: any) => ({
                name: b.areaName ?? b.areaNameEn ?? "Unknown",
                segment: b.typology ?? "Premium Residential",
                saleP50: Number(b.saleP50 ?? 0),
                yield: Number(b.grossYield ?? 0),
            }))
            .filter(a => a.saleP50 > 0)
            .sort((a, b) => b.saleP50 - a.saleP50)
            .slice(0, 3);
    }, [benchmarks]);

    // Price by tier
    const tierPrices = useMemo(() => {
        if (!benchmarks) return [];
        const all = (benchmarks as any[]).map(b => Number(b.saleP50 ?? 0)).filter(n => n > 0).sort((a, b) => b - a);
        if (all.length === 0) return [];
        const t = Math.floor(all.length / 3);
        const ultraLux = all.slice(0, t);
        const luxury = all.slice(t, t * 2);
        const premium = all.slice(t * 2);
        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
        const maxVal = avg(ultraLux) || 1;
        return [
            { label: "ULTRA-LUXURY", value: avg(ultraLux), pct: 100, color: gold },
            { label: "LUXURY", value: avg(luxury), pct: Math.round((avg(luxury) / maxVal) * 100), color: "#94a3b8" },
            { label: "PREMIUM", value: avg(premium), pct: Math.round((avg(premium) / maxVal) * 100), color: "#475569" },
        ];
    }, [benchmarks]);

    // Yield bars (simplified quarterly from top areas)
    const yieldBars = useMemo(() => {
        if (!benchmarks) return [];
        const sorted = [...(benchmarks as any[])]
            .filter((b: any) => Number(b.grossYield ?? 0) > 0)
            .sort((a: any, b: any) => Number(b.grossYield) - Number(a.grossYield))
            .slice(0, 5);
        return sorted.map((b: any, i: number) => ({
            label: i < 4 ? `Q${i + 1}` : "PROJ",
            height: Math.min(128, 60 + Number(b.grossYield ?? 0) * 8),
            opacity: 0.5 + (i * 0.12),
        }));
    }, [benchmarks]);

    // DLD feed items (from evidence records)
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
                            Last Sync: {totalRecords.toLocaleString()} records
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold border"
                        style={{ background: `${navy}80`, borderColor: `${gold}33` }}
                    >
                        <MapPin className="h-4 w-4" style={{ color: gold }} />
                        <span className="text-slate-200">Region: Dubai</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
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
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] mr-2" style={{ color: gold }}>
                    Filters:
                </span>
                <div className="flex gap-2">
                    {["Penthouse", "Villa", "Apartment"].map(f => (
                        <button
                            key={f}
                            onClick={() => setActiveFilter(f)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            style={{
                                background: activeFilter === f ? `${gold}1a` : "rgba(30,26,20,0.4)",
                                border: `1px solid ${activeFilter === f ? `${gold}33` : `${gold}1a`}`,
                                color: activeFilter === f ? "#e2e8f0" : "#94a3b8",
                            }}
                        >
                            Asset: {f}
                            {activeFilter === f && <X className="h-3 w-3" />}
                        </button>
                    ))}
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "rgba(30,26,20,0.4)", border: `1px solid ${gold}1a`, color: "#94a3b8" }}
                    >
                        Timeframe: 1 Year <Calendar className="h-3 w-3" />
                    </button>
                </div>
                <div className="ml-auto flex items-center">
                    <div className="flex rounded-lg p-0.5" style={{ background: "rgba(30,26,20,0.6)", border: `1px solid ${gold}1a` }}>
                        <button
                            onClick={() => setViewMode("map")}
                            className="px-3 py-1 rounded-md text-xs font-bold transition-colors"
                            style={{
                                background: viewMode === "map" ? gold : "transparent",
                                color: viewMode === "map" ? navy : "#94a3b8",
                            }}
                        >Map</button>
                        <button
                            onClick={() => setViewMode("grid")}
                            className="px-3 py-1 rounded-md text-xs font-bold transition-colors"
                            style={{
                                background: viewMode === "grid" ? gold : "transparent",
                                color: viewMode === "grid" ? navy : "#94a3b8",
                            }}
                        >Grid</button>
                    </div>
                </div>
            </div>

            {/* ─── Content Area ────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden" style={{ background: "#07101d" }}>
                {/* ─── Map Section ────────────────────────────── */}
                <div className="flex-1 relative overflow-hidden">
                    {/* Dubai Map Background */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: 'url("/dubai-map.jpg")' }}
                    >
                        {/* Gradient Overlay */}
                        <div
                            className="absolute inset-0"
                            style={{ background: "radial-gradient(circle at center, transparent 0%, rgba(10,22,40,0.4) 100%)" }}
                        />

                        {/* Heatmap Glow Spots */}
                        <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full animate-pulse"
                            style={{ background: `${gold}33`, filter: "blur(48px)" }} />
                        <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full animate-pulse"
                            style={{ background: `${gold}4d`, filter: "blur(60px)" }} />
                        <div className="absolute bottom-1/4 right-1/3 w-40 h-40 rounded-full"
                            style={{ background: `${gold}26`, filter: "blur(40px)" }} />

                        {/* Map Pins */}
                        {topAreas.slice(0, 3).map((area, i) => (
                            <div
                                key={area.name}
                                className="absolute group cursor-pointer"
                                style={{
                                    top: `${30 + i * 15}%`,
                                    left: `${35 + i * 12}%`,
                                }}
                            >
                                <div
                                    className="w-3.5 h-3.5 rounded-full border-2 border-white"
                                    style={{ background: gold, boxShadow: `0 0 20px ${gold}` }}
                                />
                                <div
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 p-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                                    style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}33` }}
                                >
                                    <p className="text-[10px] font-bold text-white">{area.name}</p>
                                    <p className="text-xs" style={{ color: gold }}>AED {fmtAed(area.saleP50)}/sqm</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Map Controls */}
                    <div className="absolute bottom-8 right-8 flex flex-col gap-2 z-10">
                        {[Plus, Minus].map((Icon, i) => (
                            <button
                                key={i}
                                className="w-9 h-9 rounded-lg flex items-center justify-center"
                                style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d`, color: gold }}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        ))}
                        <button
                            className="w-9 h-9 rounded-lg flex items-center justify-center mt-2"
                            style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d`, color: gold }}
                        >
                            <LocateFixed className="h-4 w-4" />
                        </button>
                    </div>

                    {/* ─── DLD Live Feed (Glass Overlay) ────────── */}
                    <div className="absolute top-6 left-6 w-[300px] flex flex-col gap-3 z-10">
                        <div
                            className="rounded-xl overflow-hidden shadow-2xl"
                            style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}4d` }}
                        >
                            <div
                                className="px-4 py-2.5 flex items-center justify-between border-b"
                                style={{ background: `${gold}1a`, borderColor: `${gold}33` }}
                            >
                                <div className="flex items-center gap-2">
                                    <Wifi className="h-3.5 w-3.5 animate-pulse" style={{ color: gold }} />
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">DLD Live Feed</h3>
                                </div>
                                <span className="text-[10px] font-medium text-slate-400">Real-time</span>
                            </div>
                            <div className="max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                                {feedItems.length > 0 ? feedItems.map((item: { title: string; subtitle: string; sqft: string | null; time: string; isNew: boolean }, i: number) => (
                                    <div
                                        key={i}
                                        className="px-4 py-3 flex flex-col gap-0.5 cursor-pointer transition-colors hover:bg-white/5"
                                        style={{ borderBottom: i < feedItems.length - 1 ? `1px solid ${gold}0d` : "none" }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-slate-100 truncate">{item.title}</p>
                                            {item.isNew && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                    style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400">{item.subtitle}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            {item.sqft && <p className="text-xs font-medium" style={{ color: gold }}>{item.sqft}</p>}
                                            <p className="text-[10px] text-slate-500 font-medium">{item.time}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="px-4 py-6 text-center text-xs text-slate-500">
                                        No recent records
                                    </div>
                                )}
                            </div>
                            <div className="p-2.5 text-center" style={{ background: "rgba(30,26,20,0.4)" }}>
                                <button className="text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: gold }}>
                                    View All Records ({evidenceCount})
                                </button>
                            </div>
                        </div>

                        {/* Market Sentiment Card */}
                        <div
                            className="p-3.5 rounded-xl flex items-center justify-between shadow-xl"
                            style={{ background: panelBg, backdropFilter: "blur(12px)", border: `1px solid ${gold}33` }}
                        >
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Status</p>
                                <p className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                                    Strong Bullish <TrendingUp className="h-3.5 w-3.5" />
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Records</p>
                                <p className="text-sm font-bold text-slate-100">{totalRecords.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Right Data Panel ──────────────────────── */}
                <div
                    className="w-[360px] h-full flex flex-col overflow-y-auto shrink-0 border-l"
                    style={{ background: `${navy}80`, borderColor: `${gold}1a` }}
                >
                    {/* Top Benchmarks */}
                    <section className="p-5 border-b" style={{ borderColor: `${gold}1a` }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Top Benchmarks</h3>
                            <Star className="h-4 w-4" style={{ color: gold }} />
                        </div>
                        <div className="space-y-3">
                            {topAreas.map((area, i) => (
                                <div
                                    key={area.name}
                                    className="flex items-center gap-3 p-3 rounded-lg"
                                    style={{
                                        background: "rgba(30,26,20,0.4)",
                                        border: `1px solid ${i === 0 ? `${gold}1a` : `${gold}0d`}`,
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
                                        style={{
                                            background: i === 0 ? `${gold}33` : "rgba(51,65,85,1)",
                                            color: i === 0 ? gold : "#94a3b8",
                                        }}
                                    >
                                        {String(i + 1).padStart(2, "0")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-200 truncate">{area.name}</p>
                                        <p className="text-[10px] text-slate-500">{area.segment}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-emerald-400">
                                            {area.yield > 0 ? `+${area.yield.toFixed(1)}%` : `${fmtAed(area.saleP50)}`}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {topAreas.length === 0 && (
                                <p className="text-xs text-slate-500 text-center py-4">Loading benchmarks...</p>
                            )}
                        </div>
                    </section>

                    {/* Price / SqFt by Tier */}
                    <section className="p-5 border-b" style={{ borderColor: `${gold}1a` }}>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-5">
                            Price / SqFt by Tier
                        </h3>
                        <div className="space-y-5">
                            {tierPrices.map(tier => (
                                <div key={tier.label} className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-slate-400">{tier.label}</span>
                                        <span style={{ color: tier.color === gold ? gold : "#cbd5e1" }}>
                                            AED {fmtAed(tier.value)} avg
                                        </span>
                                    </div>
                                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(30,26,20,1)" }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${tier.pct}%`, background: tier.color }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {tierPrices.length === 0 && (
                                <p className="text-xs text-slate-500 text-center">No pricing data</p>
                            )}
                        </div>
                    </section>

                    {/* Yield Forecast */}
                    <section className="p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Yield Forecast</h3>
                            <div className="flex gap-3">
                                <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: gold }}>
                                    <span className="w-2 h-2 rounded-full" style={{ background: gold }} /> Luxury
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-slate-200" /> Ivory
                                </span>
                            </div>
                        </div>
                        {/* Bar Chart */}
                        <div className="relative h-32 w-full flex items-end gap-1">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex flex-col justify-between" style={{ borderBottom: `1px solid ${gold}33` }}>
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                                <div className="w-full" style={{ borderTop: `1px solid ${gold}0d` }} />
                            </div>
                            {/* Bars */}
                            {yieldBars.map((bar, i) => (
                                <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 z-10">
                                    <div
                                        className="w-1.5 rounded-t-sm transition-all duration-500"
                                        style={{
                                            height: `${bar.height}px`,
                                            background: gold,
                                            opacity: bar.opacity,
                                        }}
                                    />
                                    <span className="text-[8px] text-slate-500">{bar.label}</span>
                                </div>
                            ))}
                            {yieldBars.length === 0 && (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-xs text-slate-500">No yield data</p>
                                </div>
                            )}
                            {/* SVG trend line overlay */}
                            {yieldBars.length > 0 && (
                                <svg className="absolute bottom-4 left-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <path d="M0,80 L20,70 L40,50 L60,30 L80,10 L100,5" fill="none" stroke={gold} strokeWidth="2" />
                                    <path d="M0,90 L20,85 L40,75 L60,65 L80,60 L100,58" fill="none" stroke="#f1f5f9" strokeDasharray="4" strokeWidth="1.5" />
                                </svg>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                            Projected yield for ultra-luxury units shows a potential <span className="font-bold" style={{ color: gold }}>5.8% CAGR</span> over the next 24 months based on current scarcity trends.
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
