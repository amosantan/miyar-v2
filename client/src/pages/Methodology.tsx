/**
 * MIYAR — Methodology Disclosure Page (Phase D.3)
 *
 * Public page explaining how MIYAR works — scoring, data sources,
 * AI usage, and benchmark methodology. No auth required.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Shield, Database, Brain, BarChart3, Leaf, Scale,
    Target, TrendingDown, AlertTriangle, Zap, ChevronRight,
} from "lucide-react";

function Section({
    icon: Icon,
    title,
    children,
}: {
    icon: typeof Shield;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export default function Methodology() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Scale className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">MIYAR Methodology</h1>
                    </div>
                    <p className="text-muted-foreground text-lg max-w-2xl">
                        How MIYAR generates scores, benchmarks, and design intelligence.
                        This page explains our data sources, scoring framework, and AI usage.
                    </p>
                    <div className="flex items-center gap-3 mt-6">
                        <Badge variant="outline" className="text-xs">Version 3.0</Badge>
                        <Badge variant="outline" className="text-xs">Last updated: Feb 2026</Badge>
                        <Badge variant="outline" className="text-xs">UAE Market Focus</Badge>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

                {/* MIYAR Score */}
                <Section icon={Target} title="MIYAR Score — 5 Dimensions">
                    <p className="text-sm text-muted-foreground mb-4">
                        Every project receives a composite score (0–100) computed across five dimensions.
                        Each dimension is independently scored, weighted, and aggregated.
                    </p>
                    <div className="space-y-3">
                        {[
                            {
                                code: "SA", name: "Strategic Alignment", weight: "25%",
                                desc: "Measures how well the design matches market positioning and investor goals. Evaluates typology-market fit, tier positioning, and competitive differentiation.",
                                color: "bg-blue-500",
                            },
                            {
                                code: "FF", name: "Financial Feasibility", weight: "25%",
                                desc: "Cost/sqm vs UAE benchmarks, budget realism, contingency adequacy, and fitout cost reasonableness. Penalizes budgets >30% above/below market norms.",
                                color: "bg-emerald-500",
                            },
                            {
                                code: "MP", name: "Market Positioning", weight: "20%",
                                desc: "Competitor density in the same area/tier, differentiation index, absorption rate projections, and Dubai vs Abu Dhabi market dynamics.",
                                color: "bg-amber-500",
                            },
                            {
                                code: "DS", name: "Design Suitability", weight: "15%",
                                desc: "Style-to-tier alignment, material specification quality, spatial efficiency, and compliance with UAE design regulations.",
                                color: "bg-purple-500",
                            },
                            {
                                code: "ER", name: "Execution Risk", weight: "15%",
                                desc: "Lead time risk, authority approval complexity, procurement difficulty, and logistics risk for the UAE market.",
                                color: "bg-red-500",
                            },
                        ].map((dim) => (
                            <div key={dim.code} className="flex gap-3 p-3 rounded-lg border border-border/50">
                                <div className={`h-10 w-10 rounded-lg ${dim.color}/15 flex items-center justify-center shrink-0`}>
                                    <span className={`text-sm font-bold ${dim.color.replace("bg-", "text-")}`}>{dim.code}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{dim.name}</span>
                                        <Badge variant="outline" className="text-[10px]">{dim.weight}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{dim.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                            <strong>Risk Flags:</strong> Projects may receive risk flags (FIN_SEVERE, COMPLEXITY_MISMATCH, LOW_SA, LOW_MP)
                            that trigger additional review requirements regardless of composite score.
                        </p>
                    </div>
                </Section>

                {/* Data Sources */}
                <Section icon={Database} title="Data Sources & Reliability">
                    <p className="text-sm text-muted-foreground mb-4">
                        Every cost estimate and benchmark in MIYAR is traceable to a graded data source.
                        We never use unverified data for pricing decisions.
                    </p>
                    <div className="space-y-2">
                        {[
                            {
                                grade: "A", label: "Primary Government Sources",
                                sources: "Dubai Land Department (DLD), SCAD Abu Dhabi, Dubai Municipality, RERA",
                                desc: "Official transaction data, permits, and regulatory publications",
                            },
                            {
                                grade: "B", label: "Industry Data Providers",
                                sources: "Bayut/dubizzle, Property Finder, JLL, CBRE, Cushman & Wakefield",
                                desc: "Market reports, listing data, and commercial research",
                            },
                            {
                                grade: "C", label: "Supplementary Sources",
                                sources: "Trade publications, supplier catalogs, industry interviews",
                                desc: "Used only for trend signals, never for pricing",
                            },
                        ].map((src) => (
                            <div key={src.grade} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                                <Badge
                                    className={`shrink-0 ${src.grade === "A" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                            : src.grade === "B" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                        }`}
                                    variant="outline"
                                >
                                    Grade {src.grade}
                                </Badge>
                                <div>
                                    <p className="text-sm font-medium">{src.label}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{src.sources}</p>
                                    <p className="text-[11px] text-muted-foreground/70 mt-1">{src.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>

                {/* AI Usage */}
                <Section icon={Brain} title="AI Usage & Guardrails">
                    <p className="text-sm text-muted-foreground mb-4">
                        MIYAR uses Google Gemini AI as a co-pilot. AI generates narratives and recommendations —
                        it does <strong>not</strong> set prices. All cost data comes from verified benchmarks.
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                            <p className="text-xs font-semibold text-emerald-400 mb-2">✓ AI Generates</p>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Design brief narratives & style recommendations</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Material palette suggestions</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Sustainability optimization ideas</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Trend synthesis & market commentary</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Natural language query responses</li>
                            </ul>
                        </div>
                        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                            <p className="text-xs font-semibold text-red-400 mb-2">✗ AI Does NOT</p>
                            <ul className="space-y-1 text-xs text-muted-foreground">
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Set material prices or cost benchmarks</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Compute MIYAR Scores (deterministic engine)</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Override market data with generated content</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Make investment recommendations</li>
                                <li className="flex items-start gap-1.5"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />Access external systems or user data</li>
                            </ul>
                        </div>
                    </div>
                </Section>

                {/* Benchmark Methodology */}
                <Section icon={BarChart3} title="Benchmark Methodology">
                    <p className="text-sm text-muted-foreground mb-4">
                        Benchmarks (AED/sqm cost bands) are built from a multi-layer calibration process.
                    </p>
                    <div className="space-y-3">
                        {[
                            {
                                step: "1", title: "DLD Transaction Calibration",
                                desc: "Real transaction data from Dubai Land Department provides the calibration anchor. Median recommended fitout per sqm scales all base cost bands.",
                            },
                            {
                                step: "2", title: "Cross-Product Seeding",
                                desc: "Base costs are generated for 2,520 combinations (7 typologies × 3 locations × 4 tiers × 5 material levels × 6 room types) with validated multiplier stacks.",
                            },
                            {
                                step: "3", title: "Synthetic Gap-Filling",
                                desc: "Any remaining combinations are filled using nearest-neighbor interpolation. All synthetic rows are clearly labeled and never mixed with verified data.",
                            },
                        ].map((s) => (
                            <div key={s.step} className="flex gap-3 p-3 rounded-lg border border-border/50">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-bold text-primary">{s.step}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{s.title}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex gap-3">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Curated — real data</Badge>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">Synthetic — interpolated</Badge>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">Client — user-provided</Badge>
                    </div>
                </Section>

                {/* Sustainability */}
                <Section icon={Leaf} title="Sustainability Assessment">
                    <p className="text-sm text-muted-foreground mb-4">
                        The digital twin engine computes environmental metrics using ICE Database v3 carbon factors,
                        adapted for GCC climate conditions.
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border border-border/50">
                            <p className="text-xs font-medium text-foreground mb-1">🏛️ Estidama Pearl Rating</p>
                            <p className="text-[11px] text-muted-foreground">Abu Dhabi UPC green building standard. 20 checklist items across IDP, natural systems, livable buildings, water, energy, and materials.</p>
                        </div>
                        <div className="p-3 rounded-lg border border-border/50">
                            <p className="text-xs font-medium text-foreground mb-1">🏗️ Al Sa'fat</p>
                            <p className="text-[11px] text-muted-foreground">Dubai Municipality green building regulations. 18 checklist items covering energy efficiency, water, materials, indoor environment, and MEP systems.</p>
                        </div>
                    </div>
                </Section>

                {/* Disclaimers */}
                <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-foreground">Important Disclaimers</p>
                                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                                    <li>• MIYAR provides decision-support intelligence, not investment advice.</li>
                                    <li>• All cost estimates are indicative and based on market data available at time of computation.</li>
                                    <li>• Sustainability assessments identify compliance gaps but do not replace formal certification audits.</li>
                                    <li>• Users should conduct independent due diligence before making investment decisions.</li>
                                    <li>• Market conditions in the UAE can change rapidly; always verify with current data.</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center py-8 text-xs text-muted-foreground">
                    <p>© 2026 MIYAR — Design Intelligence Engine</p>
                    <p className="mt-1">
                        For questions about our methodology, contact{" "}
                        <a href="mailto:info@miyar.ae" className="text-primary hover:underline">info@miyar.ae</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
