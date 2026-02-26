import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Shield, Loader2, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────

const RISK_DOMAINS = [
    "Model", "Operational", "Commercial", "Technology",
    "Data", "Behavioural", "Strategic", "Regulatory",
] as const;

const RISK_FACTORS = ["Probability", "Impact", "Vulnerability", "Control"] as const;

function heatColor(score: number): string {
    if (score >= 75) return "bg-red-500/80 text-white";
    if (score >= 55) return "bg-orange-500/70 text-white";
    if (score >= 35) return "bg-yellow-500/60 text-black";
    return "bg-emerald-500/60 text-white";
}

function bandColor(band: string): string {
    switch (band) {
        case "Systemic": return "bg-red-500/20 text-red-400 border-red-500/30";
        case "Critical": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
        case "Elevated": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
        case "Controlled": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
        case "Minimal": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        default: return "bg-muted text-muted-foreground";
    }
}

function overallBand(score: number): { label: string; class: string } {
    if (score >= 80) return { label: "Systemic", class: "text-red-400" };
    if (score >= 60) return { label: "Critical", class: "text-orange-400" };
    if (score >= 40) return { label: "Elevated", class: "text-yellow-400" };
    if (score >= 20) return { label: "Controlled", class: "text-blue-400" };
    return { label: "Minimal", class: "text-emerald-400" };
}

// ─── Main Content ───────────────────────────────────────────────────────────

function RiskHeatmapContent() {
    const { data: projects } = trpc.project.list.useQuery();
    const evaluatedProjects = useMemo(
        () => projects?.filter((p: any) => p.status === "evaluated") ?? [],
        [projects]
    );
    const [selectedId, setSelectedId] = useState<string>("");
    const projectId = selectedId ? Number(selectedId) : evaluatedProjects[0]?.id;

    const generateMut = trpc.scenario.generateRiskSurface.useMutation();
    const { data: existingMap, refetch } = trpc.scenario.getRiskSurface.useQuery(
        { projectId: projectId! },
        { enabled: !!projectId }
    );

    const [generated, setGenerated] = useState<any>(null);

    // Use generated data or existing DB data
    const riskData = generated?.domains || (existingMap && existingMap.length > 0
        ? (() => {
            // Group by domain, take latest per domain
            const byDomain: Record<string, any> = {};
            for (const row of existingMap) {
                if (!byDomain[row.domain]) byDomain[row.domain] = row;
            }
            return Object.values(byDomain);
        })()
        : null
    );

    const overallRisk = riskData
        ? Math.round(riskData.reduce((s: number, r: any) => s + (r.compositeRiskScore ?? r.composite_risk_score ?? 0), 0) / riskData.length)
        : null;

    const selectedProject = evaluatedProjects.find((p: any) => p.id === projectId);

    async function generateRisk() {
        if (!projectId || !selectedProject) return;
        try {
            const result = await generateMut.mutateAsync({
                projectId,
                tier: (selectedProject as any).mkt01Tier ?? "Luxury",
                horizon: (selectedProject as any).ctx05Horizon ?? "12-24m",
                location: (selectedProject as any).ctx04Location ?? "Secondary",
                complexityScore: 60,
            });
            setGenerated(result);
            refetch();
            toast.success("Risk surface generated across 8 domains");
        } catch (e: any) {
            toast.error(e.message || "Failed to generate risk surface");
        }
    }

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Risk Heatmap
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Multi-domain risk surface analysis using R = (P × I × V) / C
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {evaluatedProjects.length > 0 && (
                        <Select
                            value={selectedId || String(evaluatedProjects[0]?.id ?? "")}
                            onValueChange={(v) => { setSelectedId(v); setGenerated(null); }}
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                                {evaluatedProjects.map((p: any) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button
                        className="gap-2"
                        disabled={!projectId || generateMut.isPending}
                        onClick={generateRisk}
                    >
                        {generateMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Activity className="h-4 w-4" />
                        )}
                        Generate Risk Surface
                    </Button>
                </div>
            </div>

            {!projectId ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground">
                            Evaluate a project first to generate its risk surface analysis.
                        </p>
                    </CardContent>
                </Card>
            ) : !riskData ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">No risk surface generated yet.</p>
                        <p className="text-xs text-muted-foreground mb-4">
                            Click "Generate Risk Surface" to evaluate risk across 8 domains.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {/* Overall Risk Summary */}
                    {overallRisk !== null && (
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Overall Risk Score</p>
                                            <p className={`text-3xl font-bold ${overallBand(overallRisk).class}`}>
                                                {overallRisk}
                                            </p>
                                        </div>
                                        <Badge className={bandColor(overallBand(overallRisk).label)}>
                                            {overallBand(overallRisk).label}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-6 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded bg-emerald-500/60" />
                                            0-34 Minimal
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded bg-yellow-500/60" />
                                            35-54 Elevated
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded bg-orange-500/70" />
                                            55-74 Critical
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded bg-red-500/80" />
                                            75+ Systemic
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Heatmap Grid */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-primary" />
                                Risk Factor Matrix
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-2 pr-4 text-muted-foreground font-medium w-36">Domain</th>
                                        {RISK_FACTORS.map((f) => (
                                            <th key={f} className="text-center py-2 px-3 text-muted-foreground font-medium">{f}</th>
                                        ))}
                                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">Composite</th>
                                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">Band</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {riskData.map((r: any) => (
                                        <tr key={r.domain} className="border-b border-border/50">
                                            <td className="py-3 pr-4 font-medium text-foreground">{r.domain}</td>
                                            <td className="text-center py-3 px-3">
                                                <span className={`inline-block w-12 py-1 rounded text-xs font-bold ${heatColor(r.probability)}`}>
                                                    {r.probability}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-3">
                                                <span className={`inline-block w-12 py-1 rounded text-xs font-bold ${heatColor(r.impact)}`}>
                                                    {r.impact}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-3">
                                                <span className={`inline-block w-12 py-1 rounded text-xs font-bold ${heatColor(r.vulnerability)}`}>
                                                    {r.vulnerability}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-3">
                                                <span className={`inline-block w-12 py-1 rounded text-xs font-bold ${heatColor(100 - r.controlStrength)}`}>
                                                    {r.controlStrength}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-3">
                                                <span className={`text-lg font-bold ${r.compositeRiskScore >= 60 ? "text-red-400" :
                                                        r.compositeRiskScore >= 40 ? "text-yellow-400" :
                                                            "text-emerald-400"
                                                    }`}>
                                                    {r.compositeRiskScore}
                                                </span>
                                            </td>
                                            <td className="text-center py-3 px-3">
                                                <Badge className={bandColor(r.riskBand)}>{r.riskBand}</Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Domain Cards */}
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {riskData.map((r: any) => (
                            <Card key={r.domain} className={`${r.compositeRiskScore >= 60 ? "border-red-500/30" :
                                    r.compositeRiskScore >= 40 ? "border-yellow-500/30" :
                                        "border-emerald-500/30"
                                }`}>
                                <CardContent className="pt-4 pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium">{r.domain}</p>
                                        <Badge className={`text-[10px] ${bandColor(r.riskBand)}`}>{r.riskBand}</Badge>
                                    </div>
                                    <p className={`text-2xl font-bold mb-2 ${r.compositeRiskScore >= 60 ? "text-red-400" :
                                            r.compositeRiskScore >= 40 ? "text-yellow-400" :
                                                "text-emerald-400"
                                        }`}>
                                        {r.compositeRiskScore}
                                    </p>
                                    <div className="space-y-1 text-[10px] text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Probability</span>
                                            <span className="font-medium text-foreground">{r.probability}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Impact</span>
                                            <span className="font-medium text-foreground">{r.impact}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Vulnerability</span>
                                            <span className="font-medium text-foreground">{r.vulnerability}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Control</span>
                                            <span className="font-medium text-foreground">{r.controlStrength}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RiskHeatmap() {
    return (
        <DashboardLayout>
            <RiskHeatmapContent />
        </DashboardLayout>
    );
}
