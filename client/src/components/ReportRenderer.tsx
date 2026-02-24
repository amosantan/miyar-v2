import { Badge } from "@/components/ui/badge";

// Types matching the server report structure
interface ReportSection {
    title: string;
    type: string;
    data: any;
}

interface ReportContent {
    reportType: string;
    generatedAt: string;
    projectName: string;
    projectId: number;
    sections: ReportSection[];
    content?: string; // For autonomous_design_brief (markdown)
    html?: string; // HTML content if stored
}

const DIMENSION_LABELS: Record<string, string> = {
    sa: "Strategic Alignment",
    ff: "Financial Feasibility",
    mp: "Market Positioning",
    ds: "Differentiation Strength",
    er: "Execution Risk",
};

const STATUS_COLORS: Record<string, string> = {
    validated: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    conditional: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    not_validated: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
    validated: "Direction Validated",
    conditional: "Conditionally Validated",
    not_validated: "Not Validated",
};

function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-400";
    if (score >= 70) return "text-teal-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
}

function scoreBarColor(score: number): string {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 70) return "bg-teal-500";
    if (score >= 60) return "bg-amber-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-red-500";
}

function ScoreBar({ label, score, weight }: { label: string; score: number; weight?: number }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                    {weight !== undefined && (
                        <span className="text-muted-foreground/60">w: {(weight * 100).toFixed(0)}%</span>
                    )}
                    <span className={`font-mono font-semibold ${scoreColor(score)}`}>
                        {score.toFixed(1)}
                    </span>
                </div>
            </div>
            <div className="h-2 bg-secondary/40 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                />
            </div>
        </div>
    );
}

function SummarySection({ data }: { data: any }) {
    const status = data.decisionStatus || "conditional";
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`text-sm px-3 py-1 ${STATUS_COLORS[status] || STATUS_COLORS.conditional}`}>
                    {STATUS_LABELS[status] || data.statusLabel || status}
                </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg bg-secondary/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Composite Score</p>
                    <p className={`text-2xl font-bold ${scoreColor(data.compositeScore || 0)}`}>
                        {(data.compositeScore || 0).toFixed(1)}
                    </p>
                </div>
                <div className="rounded-lg bg-secondary/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">RAS Score</p>
                    <p className={`text-2xl font-bold ${scoreColor(data.rasScore || 0)}`}>
                        {(data.rasScore || 0).toFixed(1)}
                    </p>
                </div>
                <div className="rounded-lg bg-secondary/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                    <p className={`text-2xl font-bold ${scoreColor(data.confidenceScore || 0)}`}>
                        {(data.confidenceScore || 0).toFixed(1)}%
                    </p>
                </div>
                <div className="rounded-lg bg-secondary/20 p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Risk Flags</p>
                    <p className="text-2xl font-bold text-muted-foreground">
                        {(data.riskFlags || []).length}
                    </p>
                </div>
            </div>
            {data.riskFlags && data.riskFlags.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk Flags</p>
                    <div className="flex flex-wrap gap-2">
                        {data.riskFlags.map((flag: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-red-400 border-red-500/30 text-xs">
                                {typeof flag === "string" ? flag : flag.label || flag.flag || JSON.stringify(flag)}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ScoresSection({ data }: { data: any }) {
    const dimensions = data.dimensions || data;
    const weights = data.weights || {};
    if (!dimensions || typeof dimensions !== "object") return null;

    // Check if this is variable contributions (nested object with arrays/objects)
    const isVariableContributions = Object.values(dimensions).some(
        (v: any) => typeof v === "object" && v !== null
    );

    if (isVariableContributions) {
        return (
            <div className="space-y-4">
                {Object.entries(dimensions).map(([dimKey, vars]: [string, any]) => {
                    if (!vars || typeof vars !== "object") return null;
                    return (
                        <div key={dimKey} className="space-y-2">
                            <p className="text-sm font-semibold text-foreground">
                                {DIMENSION_LABELS[dimKey] || dimKey.toUpperCase()}
                            </p>
                            <div className="grid gap-2 pl-2">
                                {Object.entries(vars).map(([varKey, value]: [string, any]) => (
                                    <div key={varKey} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">{varKey}</span>
                                        <span className="font-mono text-foreground">
                                            {typeof value === "number" ? value.toFixed(2) : String(value)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {Object.entries(dimensions).map(([key, value]: [string, any]) => (
                <ScoreBar
                    key={key}
                    label={DIMENSION_LABELS[key] || key}
                    score={typeof value === "number" ? value : 0}
                    weight={weights[key]}
                />
            ))}
        </div>
    );
}

function RiskSection({ data }: { data: any }) {
    return (
        <div className="space-y-4">
            <div className="rounded-lg bg-secondary/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                <p className={`text-2xl font-bold ${scoreColor(100 - (data.riskScore || 0))}`}>
                    {(data.riskScore || 0).toFixed(1)}
                </p>
            </div>
            {data.penalties && data.penalties.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Penalties</p>
                    <div className="space-y-1">
                        {data.penalties.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-red-500/5">
                                <span className="text-muted-foreground">{p.variable || p.label || `Penalty ${i + 1}`}</span>
                                <span className="text-red-400 font-mono">-{(p.amount || p.penalty || 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SensitivitySection({ data }: { data: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <p className="text-xs text-muted-foreground">No sensitivity data</p>;
    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left p-2 text-muted-foreground font-medium">Variable</th>
                            <th className="text-right p-2 text-muted-foreground font-medium">Original</th>
                            <th className="text-right p-2 text-muted-foreground font-medium">+10%</th>
                            <th className="text-right p-2 text-muted-foreground font-medium">-10%</th>
                            <th className="text-right p-2 text-muted-foreground font-medium">Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row: any, i: number) => (
                            <tr key={i} className="border-b border-border/50">
                                <td className="p-2 text-foreground">{row.variable || row.name || `Var ${i}`}</td>
                                <td className="p-2 text-right font-mono text-muted-foreground">{(row.original ?? row.baseline ?? 0).toFixed?.(1) || row.original}</td>
                                <td className="p-2 text-right font-mono text-emerald-400">{(row.up ?? row.increased ?? 0).toFixed?.(1) || row.up}</td>
                                <td className="p-2 text-right font-mono text-red-400">{(row.down ?? row.decreased ?? 0).toFixed?.(1) || row.down}</td>
                                <td className="p-2 text-right font-mono text-foreground">{(row.impact ?? row.swing ?? 0).toFixed?.(2) || row.impact}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RecommendationsSection({ data }: { data: any[] }) {
    if (!Array.isArray(data) || data.length === 0) return <p className="text-xs text-muted-foreground">No recommendations</p>;
    return (
        <div className="space-y-2">
            {data.map((action: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-secondary/10 border border-border/50">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                        {i + 1}
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm text-foreground">
                            {typeof action === "string" ? action : action.action || action.label || action.description || JSON.stringify(action)}
                        </p>
                        {action.priority && (
                            <Badge variant="outline" className="text-[10px]">{action.priority}</Badge>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function DesignParamsSection({ data }: { data: any }) {
    if (!data || typeof data !== "object") return null;
    const entries = Object.entries(data).filter(([, v]) => v != null);
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {entries.map(([key, value]: [string, any]) => (
                <div key={key} className="rounded-lg bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                    </p>
                    <p className="text-sm font-medium text-foreground">{String(value)}</p>
                </div>
            ))}
        </div>
    );
}

function SectionRenderer({ section }: { section: ReportSection }) {
    switch (section.type) {
        case "summary":
            // Check if it's executive summary (has compositeScore) or design params
            if (section.data?.compositeScore !== undefined) {
                return <SummarySection data={section.data} />;
            }
            return <DesignParamsSection data={section.data} />;
        case "scores":
            return <ScoresSection data={section.data} />;
        case "radar":
            return <ScoresSection data={section.data} />;
        case "risk":
            return <RiskSection data={section.data} />;
        case "sensitivity":
            return <SensitivitySection data={section.data} />;
        case "recommendations":
            return <RecommendationsSection data={section.data} />;
        default:
            return (
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-secondary/10 p-3 rounded-lg overflow-auto max-h-64">
                    {JSON.stringify(section.data, null, 2)}
                </pre>
            );
    }
}

// ─── Main Printable Report ──────────────────────────────────────────────────

function PrintableReport({ content }: { content: ReportContent }) {
    const reportTypeLabel = content.reportType
        ?.replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "Report";

    return (
        <div className="space-y-6 p-6" id="printable-report">
            {/* Header */}
            <div className="border-b border-border pb-4">
                <h2 className="text-xl font-bold text-foreground">{content.projectName}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    {reportTypeLabel} • Generated {new Date(content.generatedAt).toLocaleString()}
                </p>
            </div>

            {/* Autonomous content (markdown) */}
            {content.content && typeof content.content === "string" && (
                <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground">
                    {content.content}
                </div>
            )}

            {/* Sections */}
            {content.sections?.map((section, i) => (
                <div key={i} className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-4 rounded-full bg-primary inline-block" />
                        {section.title}
                    </h3>
                    <SectionRenderer section={section} />
                </div>
            ))}
        </div>
    );
}

// ─── Exported Component ─────────────────────────────────────────────────────

interface ReportRendererProps {
    content: any;
    reportType?: string;
}

export default function ReportRenderer({ content, reportType }: ReportRendererProps) {
    if (!content) {
        return <p className="text-sm text-muted-foreground p-4">No content available.</p>;
    }

    // If content is just a string, display it
    if (typeof content === "string") {
        return (
            <div className="p-4 prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground">
                {content}
            </div>
        );
    }

    // If content has sections, render properly
    if (content.sections && Array.isArray(content.sections)) {
        return <PrintableReport content={content as ReportContent} />;
    }

    // Fallback: render as formatted key-value pairs
    return (
        <div className="p-4 space-y-4">
            {Object.entries(content)
                .filter(([key]) => !["html", "reportType", "generatedAt"].includes(key))
                .map(([key, value]) => (
                    <div key={key}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                        </p>
                        {typeof value === "object" ? (
                            <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-secondary/10 p-3 rounded-lg">
                                {JSON.stringify(value, null, 2)}
                            </pre>
                        ) : (
                            <p className="text-sm text-foreground">{String(value)}</p>
                        )}
                    </div>
                ))}
        </div>
    );
}
