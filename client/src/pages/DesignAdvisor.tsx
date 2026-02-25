import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useParams } from "wouter";
import {
    Wand2, Loader2, ChefHat, Bath, Home, Palette, DollarSign,
    FileText, Download, Sparkles, ArrowRight, Info, Package, Camera, Image,
} from "lucide-react";
import { useState } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

const ROOM_ICONS: Record<string, any> = {
    KIT: ChefHat,
    MEN: Bath,
    BTH: Bath,
    LVG: Home,
    MBR: Home,
};

function formatAed(amount: number) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M AED`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K AED`;
    return `${amount.toLocaleString()} AED`;
}

// ─── Space Card Component ───────────────────────────────────────────────────

function SpaceCard({ rec }: { rec: any }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = ROOM_ICONS[rec.roomId] || Home;

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-sm">{rec.roomName}</CardTitle>
                            <p className="text-xs text-muted-foreground">{rec.sqm || "?"} sqft</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                        {formatAed(Number(rec.budgetAllocation || 0))}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Style Direction */}
                <div>
                    <p className="text-xs font-medium text-foreground flex items-center gap-1">
                        <Palette className="h-3 w-3 text-primary" /> Style Direction
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.styleDirection}</p>
                </div>

                {/* Color Scheme */}
                {rec.colorScheme && (
                    <div>
                        <p className="text-xs font-medium text-foreground">Color Scheme</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.colorScheme}</p>
                    </div>
                )}

                {/* Materials Preview */}
                {rec.materialPackage && (rec.materialPackage as any[]).length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-foreground mb-1">Key Materials</p>
                        <div className="space-y-1">
                            {(rec.materialPackage as any[]).slice(0, expanded ? 20 : 3).map((m: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-secondary/30">
                                    <div>
                                        <span className="text-foreground">{m.productName}</span>
                                        <span className="text-muted-foreground ml-1">({m.brand})</span>
                                    </div>
                                    <span className="text-muted-foreground text-[10px]">{m.priceRangeAed}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Kitchen Spec */}
                {rec.kitchenSpec && (
                    <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-1">
                            <ChefHat className="h-3 w-3" /> Kitchen Design
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <span className="text-muted-foreground">Layout:</span>
                            <span className="text-foreground">{rec.kitchenSpec.layoutType}</span>
                            <span className="text-muted-foreground">Cabinets:</span>
                            <span className="text-foreground">{rec.kitchenSpec.cabinetStyle}</span>
                            <span className="text-muted-foreground">Countertop:</span>
                            <span className="text-foreground">{rec.kitchenSpec.countertopMaterial}</span>
                            <span className="text-muted-foreground">Backsplash:</span>
                            <span className="text-foreground">{rec.kitchenSpec.backsplash}</span>
                            <span className="text-muted-foreground">Appliances:</span>
                            <span className="text-foreground">
                                {rec.kitchenSpec.applianceLevel} ({(rec.kitchenSpec.applianceBrands || []).join(", ")})
                            </span>
                        </div>
                    </div>
                )}

                {/* Bathroom Spec */}
                {rec.bathroomSpec && (
                    <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-xs font-semibold text-blue-400 flex items-center gap-1 mb-1">
                            <Bath className="h-3 w-3" /> Bathroom Design
                        </p>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <span className="text-muted-foreground">Shower:</span>
                            <span className="text-foreground">{rec.bathroomSpec.showerType}</span>
                            <span className="text-muted-foreground">Vanity:</span>
                            <span className="text-foreground">{rec.bathroomSpec.vanityStyle}</span>
                            <span className="text-muted-foreground">Tiles:</span>
                            <span className="text-foreground">{rec.bathroomSpec.tilePattern}</span>
                            <span className="text-muted-foreground">Fixtures:</span>
                            <span className="text-foreground">{rec.bathroomSpec.fixtureFinish} ({rec.bathroomSpec.fixtureBrand})</span>
                            {(rec.bathroomSpec.luxuryFeatures || []).length > 0 && (
                                <>
                                    <span className="text-muted-foreground">Features:</span>
                                    <span className="text-foreground">{rec.bathroomSpec.luxuryFeatures.join(", ")}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Expand Toggle */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs text-muted-foreground"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? "Show less" : "Show all details"}
                    <ArrowRight className={`h-3 w-3 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
                </Button>

                {/* Expanded: AI Rationale + Budget Breakdown */}
                {expanded && (
                    <div className="space-y-3 border-t border-border/50 pt-3">
                        {rec.aiRationale && (
                            <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI Rationale</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{rec.aiRationale}</p>
                            </div>
                        )}
                        {rec.budgetBreakdown && (rec.budgetBreakdown as any[]).length > 0 && (
                            <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Budget Allocation</p>
                                <div className="space-y-1">
                                    {(rec.budgetBreakdown as any[]).map((b: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="w-24 text-muted-foreground">{b.element}</span>
                                            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary/60"
                                                    style={{ width: `${b.percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-foreground w-8 text-right">{b.percentage}%</span>
                                            <span className="text-muted-foreground w-16 text-right">{formatAed(b.amount || 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {rec.specialNotes && (rec.specialNotes as string[]).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {(rec.specialNotes as string[]).map((note: string, i: number) => (
                                    <Badge key={i} variant="outline" className="text-[10px]">{note}</Badge>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function DesignAdvisorContent() {
    const params = useParams<{ id: string }>();
    const projectId = Number(params.id);
    const utils = trpc.useUtils();

    const { data: project } = trpc.project.get.useQuery({ id: projectId });
    const { data: recommendations, isLoading: recsLoading } = trpc.designAdvisor.getRecommendations.useQuery(
        { projectId },
        { enabled: !!projectId }
    );
    const { data: brief } = trpc.designAdvisor.getDesignBrief.useQuery(
        { projectId },
        { enabled: !!projectId }
    );
    const { data: spaceProgram } = trpc.designAdvisor.getSpaceProgram.useQuery(
        { projectId },
        { enabled: !!projectId }
    );

    const generateMutation = trpc.designAdvisor.generateRecommendations.useMutation({
        onSuccess: (data) => {
            toast.success(`Generated ${data.count} space recommendations`);
            utils.designAdvisor.getRecommendations.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    const briefMutation = trpc.designAdvisor.generateDesignBrief.useMutation({
        onSuccess: () => {
            toast.success("Design brief generated");
            utils.designAdvisor.getDesignBrief.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    // Phase 2: Visual generation
    const { data: visuals } = trpc.designAdvisor.getVisuals.useQuery(
        { projectId },
        { enabled: !!projectId }
    );

    const [generatingVisual, setGeneratingVisual] = useState<string | null>(null);

    const visualMutation = trpc.designAdvisor.generateVisual.useMutation({
        onSuccess: (data) => {
            toast.success(`Generated ${data.type.replace("_", " ")} for ${data.roomId}`);
            utils.designAdvisor.getVisuals.invalidate({ projectId });
            setGeneratingVisual(null);
        },
        onError: (err) => {
            toast.error(err.message);
            setGeneratingVisual(null);
        },
    });

    const heroMutation = trpc.designAdvisor.generateHero.useMutation({
        onSuccess: () => {
            toast.success("Hero image generated!");
            utils.designAdvisor.getVisuals.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    function handleGenerateVisual(roomId: string, type: string) {
        setGeneratingVisual(`${roomId}-${type}`);
        visualMutation.mutate({ projectId, roomId, type: type as any });
    }

    const hasRecs = recommendations && recommendations.length > 0;
    const totalBudget = hasRecs
        ? recommendations.reduce((sum: number, r: any) => sum + Number(r.budgetAllocation || 0), 0)
        : spaceProgram?.totalFitoutBudgetAed || 0;

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Design Advisor
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {project?.name || "Project"} — Smart material & style recommendations per space
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => generateMutation.mutate({ projectId })}
                        disabled={generateMutation.isPending}
                        className="gap-1.5"
                    >
                        {generateMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Wand2 className="h-3.5 w-3.5" />
                        )}
                        {hasRecs ? "Regenerate" : "Generate Recommendations"}
                    </Button>
                    {hasRecs && (
                        <Button
                            variant="outline"
                            onClick={() => briefMutation.mutate({ projectId })}
                            disabled={briefMutation.isPending}
                            className="gap-1.5"
                        >
                            {briefMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <FileText className="h-3.5 w-3.5" />
                            )}
                            Generate Brief
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                        <p className="text-2xl font-bold text-primary">{formatAed(totalBudget)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Spaces</p>
                        <p className="text-2xl font-bold text-foreground">
                            {hasRecs ? recommendations.length : spaceProgram?.rooms?.length || 0}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">GFA</p>
                        <p className="text-2xl font-bold text-foreground">{project?.ctx03Gfa || 0} sqft</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Cost/sqft</p>
                        <p className="text-2xl font-bold text-foreground">
                            {project?.ctx03Gfa ? formatAed(Math.round(totalBudget / Number(project.ctx03Gfa))) : "—"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            {!hasRecs && !recsLoading ? (
                <Card>
                    <CardContent className="py-16 text-center space-y-4">
                        <Wand2 className="h-12 w-12 text-primary/30 mx-auto" />
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">No Recommendations Yet</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Click "Generate Recommendations" to get AI-powered design direction for every space.
                            </p>
                        </div>
                        <Button
                            onClick={() => generateMutation.mutate({ projectId })}
                            disabled={generateMutation.isPending}
                            className="gap-1.5"
                        >
                            {generateMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                            )}
                            Generate Now
                        </Button>
                    </CardContent>
                </Card>
            ) : recsLoading ? (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <Tabs defaultValue="spaces" className="space-y-4">
                    <TabsList className="bg-secondary/50">
                        <TabsTrigger value="spaces">Spaces ({recommendations?.length})</TabsTrigger>
                        <TabsTrigger value="visuals">🎨 Visuals</TabsTrigger>
                        <TabsTrigger value="brief">Design Brief</TabsTrigger>
                        <TabsTrigger value="budget">Budget</TabsTrigger>
                    </TabsList>

                    {/* Spaces Tab */}
                    <TabsContent value="spaces">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(recommendations || []).map((rec: any) => (
                                <SpaceCard key={rec.id || rec.roomId} rec={rec} />
                            ))}
                        </div>
                    </TabsContent>

                    {/* Visuals Tab */}
                    <TabsContent value="visuals" className="space-y-6">
                        {/* Hero Image */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Image className="h-4 w-4 text-primary" />
                                        Hero Image
                                    </CardTitle>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => heroMutation.mutate({ projectId })}
                                        disabled={heroMutation.isPending}
                                        className="gap-1.5"
                                    >
                                        {heroMutation.isPending ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Camera className="h-3.5 w-3.5" />
                                        )}
                                        Generate Hero
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(visuals || []).filter((v: any) => v.type === "hero").length > 0 ? (
                                    <div className="grid gap-3">
                                        {(visuals || []).filter((v: any) => v.type === "hero").map((v: any) => (
                                            <img
                                                key={v.id}
                                                src={(v.promptJson as any)?.imageUrl || v.imageUrl}
                                                alt="Hero"
                                                className="w-full rounded-lg border border-border/50"
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4">No hero images yet — click Generate Hero above</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Per-Space Visual Generation */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Camera className="h-4 w-4 text-primary" />
                                    Per-Space Visuals
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(recommendations || []).map((rec: any) => {
                                    const roomVisuals = (visuals || []).filter((v: any) => (v.promptJson as any)?.roomId === rec.roomId);
                                    const hasKitchen = !!rec.kitchenSpec;
                                    const hasBathroom = !!rec.bathroomSpec;

                                    return (
                                        <div key={rec.roomId} className="border border-border/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-medium text-foreground">{rec.roomName}</h4>
                                                <span className="text-[10px] text-muted-foreground">{roomVisuals.length} visuals</span>
                                            </div>

                                            {/* Generate Buttons */}
                                            <div className="flex flex-wrap gap-1.5 mb-3">
                                                {["mood_board", "material_board", "room_render", "color_palette",
                                                    ...(hasKitchen ? ["kitchen_render"] : []),
                                                    ...(hasBathroom ? ["bathroom_render"] : []),
                                                ].map((type) => (
                                                    <Button
                                                        key={type}
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 text-[10px] gap-1"
                                                        disabled={generatingVisual === `${rec.roomId}-${type}`}
                                                        onClick={() => handleGenerateVisual(rec.roomId, type)}
                                                    >
                                                        {generatingVisual === `${rec.roomId}-${type}` ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <Camera className="h-3 w-3" />
                                                        )}
                                                        {type.replace(/_/g, " ")}
                                                    </Button>
                                                ))}
                                            </div>

                                            {/* Existing Visuals Grid */}
                                            {roomVisuals.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    {roomVisuals.map((v: any) => (
                                                        <div key={v.id} className="relative group">
                                                            <img
                                                                src={(v.promptJson as any)?.imageUrl}
                                                                alt={`${rec.roomName} ${v.type}`}
                                                                className="w-full aspect-[4/3] object-cover rounded-md border border-border/50"
                                                            />
                                                            <Badge
                                                                variant="secondary"
                                                                className="absolute bottom-1 left-1 text-[8px]"
                                                            >
                                                                {((v.promptJson as any)?.visualType || v.type).replace(/_/g, " ")}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Brief Tab */}
                    <TabsContent value="brief" className="space-y-4">
                        {brief?.briefData ? (
                            <div className="space-y-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Executive Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {(brief.briefData as any).executiveSummary}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Design Direction</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {Object.entries((brief.briefData as any).designDirection || {}).map(([key, val]) => (
                                            <div key={key} className="flex gap-2 text-xs">
                                                <span className="w-32 text-muted-foreground font-medium capitalize">
                                                    {key.replace(/([A-Z])/g, " $1")}:
                                                </span>
                                                <span className="text-foreground flex-1">
                                                    {Array.isArray(val) ? (val as string[]).join(", ") : String(val)}
                                                </span>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                {(brief.briefData as any).spaceBySpaceGuide?.map((s: any, i: number) => (
                                    <Card key={i}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">{s.roomName}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <p className="text-xs text-muted-foreground">{s.designIntent}</p>
                                            {s.doList?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-semibold text-emerald-400 mb-0.5">DO</p>
                                                    {s.doList.map((item: string, j: number) => (
                                                        <p key={j} className="text-xs text-muted-foreground">✓ {item}</p>
                                                    ))}
                                                </div>
                                            )}
                                            {s.dontList?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-semibold text-red-400 mb-0.5">DON'T</p>
                                                    {s.dontList.map((item: string, j: number) => (
                                                        <p key={j} className="text-xs text-muted-foreground">✗ {item}</p>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Generate recommendations first, then create a design brief.</p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Budget Tab */}
                    <TabsContent value="budget" className="space-y-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-primary" />
                                    Budget Allocation by Space
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {(recommendations || []).map((rec: any) => {
                                        const pct = totalBudget > 0 ? (Number(rec.budgetAllocation || 0) / totalBudget) * 100 : 0;
                                        return (
                                            <div key={rec.roomId} className="flex items-center gap-3">
                                                <span className="w-32 text-xs text-muted-foreground truncate">{rec.roomName}</span>
                                                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-foreground w-12 text-right">{pct.toFixed(0)}%</span>
                                                <span className="text-xs text-muted-foreground w-20 text-right">
                                                    {formatAed(Number(rec.budgetAllocation || 0))}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <Separator className="my-3" />
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="text-foreground">Total Fitout Budget</span>
                                    <span className="text-primary">{formatAed(totalBudget)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

export default function DesignAdvisor() {
    return (
        <DashboardLayout>
            <DesignAdvisorContent />
        </DashboardLayout>
    );
}
