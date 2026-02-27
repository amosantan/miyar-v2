/**
 * EvidenceChainDrawer — Phase A.3: Evidence Provenance Click-Through
 *
 * A slide-out drawer that shows the full provenance chain for a cost number:
 *   Cost (AED/sqm) → Evidence Record → Source Registry
 *
 * Usage:
 *   <EvidenceChainDrawer
 *     category="floors"
 *     projectId={123}  // optional
 *     trigger={<Button>📎 Source</Button>}
 *   />
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    ExternalLink,
    ShieldCheck,
    ShieldAlert,
    Shield,
    Calendar,
    FileText,
    Globe,
    Loader2,
    Database,
    TrendingUp,
    Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Props {
    category?: string;
    projectId?: number;
    trigger: React.ReactNode;
    title?: string;
}

type GradeKey = "A" | "B" | "C";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const GRADE_CONFIG: Record<GradeKey, { label: string; color: string; icon: typeof ShieldCheck }> = {
    A: { label: "High Confidence", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: ShieldCheck },
    B: { label: "Moderate", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Shield },
    C: { label: "Low Confidence", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: ShieldAlert },
};

const CATEGORY_LABELS: Record<string, string> = {
    floors: "Flooring",
    walls: "Wall Finishes",
    ceilings: "Ceiling Systems",
    joinery: "Joinery & Carpentry",
    lighting: "Lighting",
    sanitary: "Sanitary Ware",
    kitchen: "Kitchen Fixtures",
    hardware: "Hardware & Ironmongery",
    ffe: "FF&E",
    other: "Other",
};

function formatAed(val: string | number | null | undefined): string {
    if (val == null) return "—";
    const n = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(n)) return "—";
    return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function freshnessIndicator(dateStr: string | Date | null | undefined): {
    label: string;
    color: string;
} {
    if (!dateStr) return { label: "Unknown", color: "text-muted-foreground" };
    const d = new Date(dateStr);
    const daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) return { label: `${daysSince}d ago`, color: "text-emerald-400" };
    if (daysSince <= 30) return { label: `${daysSince}d ago`, color: "text-amber-400" };
    return { label: `${daysSince}d ago`, color: "text-red-400" };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function EvidenceChainDrawer({ category, projectId, trigger, title }: Props) {
    const [open, setOpen] = useState(false);

    const { data, isLoading } = trpc.design.getEvidenceChain.useQuery(
        { category, projectId, limit: 20 },
        { enabled: open }
    );

    const evidence = data?.evidence ?? [];
    const categoryLabel = category ? CATEGORY_LABELS[category] ?? category : "All Categories";

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{trigger}</SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        {title ?? `Evidence Chain — ${categoryLabel}`}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Click-through provenance: every number traced to its source
                    </p>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Loading evidence chain…</span>
                        </div>
                    ) : evidence.length === 0 ? (
                        <div className="text-center py-16">
                            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                                No evidence records found for {categoryLabel.toLowerCase()}.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Summary strip */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{evidence.length} evidence record{evidence.length !== 1 ? "s" : ""}</span>
                                <span>·</span>
                                <span>
                                    {new Set(evidence.map((e: any) => e.sourceName).filter(Boolean)).size} unique source
                                    {new Set(evidence.map((e: any) => e.sourceName).filter(Boolean)).size !== 1 ? "s" : ""}
                                </span>
                            </div>

                            {/* Evidence Cards */}
                            {evidence.map((e: any) => {
                                const grade = (e.reliabilityGrade ?? e.sourceReliability ?? "B") as GradeKey;
                                const gradeConf = GRADE_CONFIG[grade] ?? GRADE_CONFIG.B;
                                const GradeIcon = gradeConf.icon;
                                const freshness = freshnessIndicator(e.captureDate);

                                return (
                                    <Card key={e.id} className="border-border/60">
                                        <CardContent className="pt-4 pb-3 px-4 space-y-3">
                                            {/* Row 1: Item + Grade */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {e.itemName}
                                                    </p>
                                                    {e.specClass && (
                                                        <p className="text-xs text-muted-foreground mt-0.5">{e.specClass}</p>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`shrink-0 text-[10px] px-1.5 py-0.5 gap-1 ${gradeConf.color}`}
                                                >
                                                    <GradeIcon className="h-3 w-3" />
                                                    Grade {grade}
                                                </Badge>
                                            </div>

                                            {/* Row 2: Price Range */}
                                            <div className="grid grid-cols-3 gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                                                <div className="text-center">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Low</p>
                                                    <p className="text-xs font-mono font-medium text-foreground">
                                                        {formatAed(e.priceMin)}
                                                    </p>
                                                </div>
                                                <div className="text-center border-x border-border/30">
                                                    <p className="text-[10px] uppercase tracking-wider text-primary">Typical</p>
                                                    <p className="text-sm font-mono font-bold text-primary">
                                                        {formatAed(e.priceTypical)}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">High</p>
                                                    <p className="text-xs font-mono font-medium text-foreground">
                                                        {formatAed(e.priceMax)}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground text-right">
                                                per {e.unit ?? "sqm"}
                                            </p>

                                            {/* Row 3: Extracted Snippet */}
                                            {e.extractedSnippet && (
                                                <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-primary/60 mb-1 flex items-center gap-1">
                                                        <FileText className="h-3 w-3" /> Extracted Evidence
                                                    </p>
                                                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
                                                        "{e.extractedSnippet}"
                                                    </p>
                                                </div>
                                            )}

                                            {/* Row 4: Source Provenance */}
                                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate">
                                                            {e.sourceName ?? "Unknown Source"}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {e.sourceType?.replace(/_/g, " ") ?? "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Freshness */}
                                                    <span className={`text-[10px] flex items-center gap-0.5 ${freshness.color}`}>
                                                        <Clock className="h-3 w-3" />
                                                        {freshness.label}
                                                    </span>
                                                    {/* Link */}
                                                    {(e.sourceUrl || e.sourcePageUrl) && (
                                                        <a
                                                            href={e.sourceUrl || e.sourcePageUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:text-primary/80 transition-colors"
                                                            onClick={(ev) => ev.stopPropagation()}
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Row 5: Record ID + Capture Date */}
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                                                <span className="font-mono">{e.recordId}</span>
                                                {e.captureDate && (
                                                    <span className="flex items-center gap-0.5">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        {new Date(e.captureDate).toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {/* Footer */}
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 pt-2 border-t border-border/20">
                                <TrendingUp className="h-3 w-3" />
                                <span>
                                    Data provenance powered by MIYAR Evidence Engine · {evidence.length} records shown
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
