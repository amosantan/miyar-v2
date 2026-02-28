import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
    FolderKanban,
    PlusCircle,
    Trash2,
    Eye,
    ArrowLeft,
    BarChart3,
    AlertTriangle,
    TrendingUp,
    Loader2,
    PlusIcon,
    MinusCircle,
    CheckCircle2,
    XCircle,
    Shield,
    Layers,
    FileDown,
    Bell,
    MapPin,
    Building,
    DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

// ─── Helper: Score color ─────────────────────────────────────────────────────
function scoreColor(score: number | null) {
    if (score === null) return "text-muted-foreground";
    if (score >= 75) return "text-green-400";
    if (score >= 55) return "text-amber-400";
    return "text-red-400";
}

function statusBadge(status: string | null) {
    if (!status) return <Badge variant="secondary">Unscored</Badge>;
    const map: Record<string, string> = {
        GO: "bg-green-500/20 text-green-400 border-green-500/30",
        CONDITIONAL_GO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
        NO_GO: "bg-red-500/20 text-red-400 border-red-500/30",
        REVIEW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return (
        <Badge className={map[status] || ""} variant="outline">
            {status.replace(/_/g, " ")}
        </Badge>
    );
}

// ─── Portfolio List View ─────────────────────────────────────────────────────
function PortfolioList({
    onSelect,
}: {
    onSelect: (id: number) => void;
}) {
    const utils = trpc.useUtils();
    const listQuery = trpc.portfolio.list.useQuery();
    const createMut = trpc.portfolio.create.useMutation({
        onSuccess: () => {
            utils.portfolio.list.invalidate();
            setNewName("");
            setShowCreate(false);
            toast.success("Portfolio created");
        },
    });
    const deleteMut = trpc.portfolio.delete.useMutation({
        onSuccess: () => {
            utils.portfolio.list.invalidate();
            toast.success("Portfolio deleted");
        },
    });

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");

    if (listQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const portfolioList = listQuery.data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <FolderKanban className="w-7 h-7 text-primary" />
                        Portfolios
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Organize and analyze your projects in named portfolios
                    </p>
                </div>
                <Dialog open={showCreate} onOpenChange={setShowCreate}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <PlusCircle className="w-4 h-4" />
                            New Portfolio
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Portfolio</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <Input
                                placeholder="Portfolio name"
                                value={newName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                                autoFocus
                            />
                            <Input
                                placeholder="Description (optional)"
                                value={newDesc}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDesc(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                disabled={!newName.trim() || createMut.isPending}
                                onClick={() =>
                                    createMut.mutate({
                                        name: newName.trim(),
                                        description: newDesc.trim() || undefined,
                                    })
                                }
                            >
                                {createMut.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                Create
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Empty state */}
            {portfolioList.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <FolderKanban className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-1">No portfolios yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Create your first portfolio to group and analyze projects together.
                        </p>
                        <Button onClick={() => setShowCreate(true)} className="gap-2">
                            <PlusCircle className="w-4 h-4" /> Create Portfolio
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Portfolio cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolioList.map((p: any) => (
                    <Card
                        key={p.id}
                        className="group hover:border-primary/40 transition-colors cursor-pointer"
                        onClick={() => onSelect(p.id)}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                                <CardTitle className="text-base font-semibold truncate">
                                    {p.name}
                                </CardTitle>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        if (confirm("Delete this portfolio?")) {
                                            deleteMut.mutate({ id: p.id });
                                        }
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                            {p.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {p.description}
                                </p>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="font-medium">{p.projectCount}</span>
                                    <span className="text-muted-foreground">projects</span>
                                </div>
                                {p.scoredCount > 0 && (
                                    <>
                                        <div className="flex items-center gap-1">
                                            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className={`font-medium ${scoreColor(p.avgComposite)}`}>
                                                {p.avgComposite}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="font-medium text-muted-foreground">
                                                {p.avgRisk}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

// ─── Portfolio Detail View ───────────────────────────────────────────────────
function PortfolioDetail({
    portfolioId,
    onBack,
}: {
    portfolioId: number;
    onBack: () => void;
}) {
    const utils = trpc.useUtils();
    const detailQuery = trpc.portfolio.getById.useQuery({ id: portfolioId });
    const availableQuery = trpc.portfolio.availableProjects.useQuery({
        portfolioId,
    });

    const addProjectMut = trpc.portfolio.addProject.useMutation({
        onSuccess: () => {
            utils.portfolio.getById.invalidate({ id: portfolioId });
            utils.portfolio.availableProjects.invalidate({ portfolioId });
            utils.portfolio.list.invalidate();
            toast.success("Project added to portfolio");
        },
    });

    const removeProjectMut = trpc.portfolio.removeProject.useMutation({
        onSuccess: () => {
            utils.portfolio.getById.invalidate({ id: portfolioId });
            utils.portfolio.availableProjects.invalidate({ portfolioId });
            utils.portfolio.list.invalidate();
            toast.success("Project removed from portfolio");
        },
    });

    const [showAddDialog, setShowAddDialog] = useState(false);

    const reportMut = trpc.portfolio.generateReport.useMutation({
        onSuccess: (data) => {
            // Trigger HTML download
            const blob = new Blob([data.html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${data.portfolioName.replace(/\s+/g, "_")}_Portfolio_Report.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Portfolio report downloaded");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to generate report");
        },
    });

    const alertMut = trpc.portfolio.checkAlerts.useMutation({
        onSuccess: (data) => {
            if (data.alerts.length > 0) {
                toast.warning(`${data.message}`, {
                    description: data.alerts.map((a: any) => a.title).join("\n"),
                    duration: 8000,
                });
            } else {
                toast.success(data.message);
            }
        },
        onError: (err) => {
            toast.error(err.message || "Failed to check alerts");
        },
    });

    if (detailQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const portfolio = detailQuery.data;
    if (!portfolio) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">Portfolio not found</p>
                <Button variant="ghost" onClick={onBack} className="mt-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
            </div>
        );
    }

    const analytics = portfolio.analytics;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onBack}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold">{portfolio.name}</h2>
                        {portfolio.description && (
                            <p className="text-sm text-muted-foreground">
                                {portfolio.description}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={alertMut.isPending || !portfolio.projects?.length}
                        onClick={() => alertMut.mutate({ id: portfolioId })}
                    >
                        {alertMut.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Bell className="w-4 h-4" />
                        )}
                        Check Alerts
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={reportMut.isPending || !portfolio.projects?.length}
                        onClick={() => reportMut.mutate({ id: portfolioId })}
                    >
                        {reportMut.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <FileDown className="w-4 h-4" />
                        )}
                        Export Report
                    </Button>

                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <PlusIcon className="w-4 h-4" /> Add Project
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[60vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add Project to Portfolio</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2 py-2">
                                {(availableQuery.data || []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        All projects are already in this portfolio.
                                    </p>
                                ) : (
                                    (availableQuery.data || []).map((p: any) => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                                        >
                                            <div>
                                                <p className="font-medium text-sm">{p.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {p.tier} · {p.style}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={addProjectMut.isPending}
                                                onClick={() =>
                                                    addProjectMut.mutate({
                                                        portfolioId,
                                                        projectId: p.id,
                                                    })
                                                }
                                            >
                                                <PlusIcon className="w-3 h-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Aggregate Stats — E.1 Benchmarking Strip */}
            {analytics && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Projects</p>
                            <p className="text-2xl font-bold mt-1">{analytics.totalProjects}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Score</p>
                            <p className={`text-2xl font-bold mt-1 ${scoreColor(analytics.avgComposite)}`}>
                                {analytics.avgComposite}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Best / Worst</p>
                            <p className="text-2xl font-bold mt-1">
                                <span className="text-green-400">{analytics.bestScore ?? "—"}</span>
                                <span className="text-muted-foreground text-sm mx-1">/</span>
                                <span className="text-red-400">{analytics.worstScore ?? "—"}</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total GFA</p>
                            <p className="text-2xl font-bold mt-1">
                                {(analytics.totalGfa ?? 0) > 0
                                    ? `${((analytics.totalGfa ?? 0) / 1000).toFixed(0)}K`
                                    : "—"}
                                <span className="text-xs text-muted-foreground ml-1">sqm</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Budget</p>
                            <p className="text-2xl font-bold mt-1">
                                {(analytics.totalBudget ?? 0) >= 1_000_000
                                    ? `${((analytics.totalBudget ?? 0) / 1_000_000).toFixed(1)}M`
                                    : (analytics.totalBudget ?? 0) > 0
                                        ? `${((analytics.totalBudget ?? 0) / 1_000).toFixed(0)}K`
                                        : "—"}
                                <span className="text-xs text-muted-foreground ml-1">AED</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Cost/sqm</p>
                            <p className="text-2xl font-bold mt-1">
                                {(analytics.avgCostPerSqm ?? 0) > 0
                                    ? (analytics.avgCostPerSqm ?? 0).toLocaleString()
                                    : "—"}
                                <span className="text-xs text-muted-foreground ml-1">AED</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Comparison Table — E.1 Benchmarking */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Project Comparison
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {portfolio.projects.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            No projects yet. Add projects using the button above.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border text-muted-foreground">
                                        <th className="text-left py-2 px-2 font-medium">Project</th>
                                        <th className="text-left py-2 px-2 font-medium">City</th>
                                        <th className="text-left py-2 px-2 font-medium">Typology</th>
                                        <th className="text-left py-2 px-2 font-medium">Tier</th>
                                        <th className="text-right py-2 px-2 font-medium">GFA (sqm)</th>
                                        <th className="text-right py-2 px-2 font-medium">Budget (AED)</th>
                                        <th className="text-right py-2 px-2 font-medium">Cost/sqm</th>
                                        <th className="text-left py-2 px-2 font-medium">Cert</th>
                                        <th className="text-right py-2 px-2 font-medium">Score</th>
                                        <th className="text-left py-2 px-2 font-medium">Status</th>
                                        <th className="py-2 px-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {portfolio.projects.map((p: any) => {
                                        const costPerSqm = p.gfa && p.budgetCap
                                            ? Math.round(p.budgetCap / p.gfa)
                                            : null;
                                        return (
                                            <tr key={p.id} className="hover:bg-accent/30 transition-colors">
                                                <td className="py-2 px-2 font-medium truncate max-w-[180px]">{p.name}</td>
                                                <td className="py-2 px-2">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin className="w-3 h-3 text-muted-foreground" />
                                                        {p.city || "Dubai"}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-2 text-muted-foreground">{p.typology || "—"}</td>
                                                <td className="py-2 px-2">
                                                    <Badge variant="outline" className="text-[10px]">{p.tier}</Badge>
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono">
                                                    {p.gfa ? p.gfa.toLocaleString() : "—"}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono">
                                                    {p.budgetCap
                                                        ? p.budgetCap >= 1_000_000
                                                            ? `${(p.budgetCap / 1_000_000).toFixed(1)}M`
                                                            : `${(p.budgetCap / 1_000).toFixed(0)}K`
                                                        : "—"}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono">
                                                    {costPerSqm ? costPerSqm.toLocaleString() : "—"}
                                                </td>
                                                <td className="py-2 px-2">
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {p.sustainCertTarget || "silver"}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 px-2 text-right">
                                                    {p.compositeScore !== null ? (
                                                        <span className={`font-mono font-semibold ${scoreColor(p.compositeScore)}`}>
                                                            {p.compositeScore}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-2">{statusBadge(p.decisionStatus)}</td>
                                                <td className="py-2 px-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() =>
                                                            removeProjectMut.mutate({
                                                                portfolioId,
                                                                projectId: p.id,
                                                            })
                                                        }
                                                    >
                                                        <MinusCircle className="w-3.5 h-3.5 text-destructive" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Analytics: Failure Patterns */}
            {analytics && analytics.failurePatterns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" /> Failure
                            Patterns
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {analytics.failurePatterns.map((fp: any, i: number) => (
                            <div
                                key={i}
                                className="border rounded-lg p-3 space-y-1"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-sm">{fp.pattern}</span>
                                    <Badge
                                        variant="outline"
                                        className={
                                            fp.severity === "high"
                                                ? "border-red-500/50 text-red-400"
                                                : fp.severity === "medium"
                                                    ? "border-amber-500/50 text-amber-400"
                                                    : ""
                                        }
                                    >
                                        {fp.severity}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {fp.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Affects {fp.frequency} project(s)
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Analytics: Improvement Levers */}
            {analytics && analytics.improvementLevers.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-400" /> Improvement
                            Levers
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {analytics.improvementLevers.slice(0, 5).map((lever: any) => (
                                <div
                                    key={lever.rank}
                                    className="flex items-center justify-between p-2 rounded-md hover:bg-accent/30 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-accent rounded-full w-6 h-6 flex items-center justify-center">
                                            {lever.rank}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium">{lever.lever}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {lever.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={
                                            lever.estimatedImpact === "High"
                                                ? "border-green-500/50 text-green-400"
                                                : lever.estimatedImpact === "Medium"
                                                    ? "border-amber-500/50 text-amber-400"
                                                    : ""
                                        }
                                    >
                                        {lever.estimatedImpact}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Analytics: Score Distributions */}
            {analytics && analytics.distributions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" /> Score Distributions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {analytics.distributions.map((dist: any) => (
                                <div key={dist.dimension} className="space-y-2">
                                    <p className="text-sm font-semibold">{dist.dimension}</p>
                                    {dist.buckets
                                        .filter((b: any) => b.count > 0)
                                        .map((bucket: any) => (
                                            <div
                                                key={bucket.label}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="text-muted-foreground min-w-[100px]">
                                                    {bucket.label}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 bg-primary/30 rounded-full w-24 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full"
                                                            style={{
                                                                width: `${Math.min(100, (bucket.avgScore / 100) * 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="font-mono w-8 text-right">
                                                        {bucket.avgScore}
                                                    </span>
                                                    <span className="text-muted-foreground w-6 text-right">
                                                        ({bucket.count})
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PortfolioPage() {
    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
        <>
            <div className="max-w-6xl mx-auto px-6 py-8">
                {selectedId === null ? (
                    <PortfolioList onSelect={setSelectedId} />
                ) : (
                    <PortfolioDetail
                        portfolioId={selectedId}
                        onBack={() => setSelectedId(null)}
                    />
                )}
            </div>
        </>
    );
}
