import { useState, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
    Upload, Brain, BarChart3, AlertTriangle, CheckCircle2, Info,
    ArrowUpRight, ArrowDownRight, Minus, FileImage, Loader2, Sparkles, MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ComponentType<any> }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: AlertTriangle },
    advisory: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", icon: Info },
    optimal: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", icon: CheckCircle2 },
};

export default function SpacePlanner() {
    const [, params] = useRoute("/projects/:id/space-planner");
    const projectId = Number(params?.id);

    const [uploadingFile, setUploadingFile] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const projectQuery = trpc.project.get.useQuery({ id: projectId }, { enabled: !!projectId });
    const project = projectQuery.data;

    const uploadFloorPlan = trpc.design.uploadFloorPlan.useMutation();
    const analyzeFloorPlan = trpc.design.analyzeFloorPlan.useMutation();

    const benchmarkQuery = trpc.design.getSpaceBenchmark.useQuery(
        { projectId },
        {
            enabled: !!project?.floorPlanAnalysis,
            retry: false,
        }
    );

    // Handle file upload
    const handleFile = useCallback(async (file: File) => {
        if (!file) return;

        const validTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
        if (!validTypes.includes(file.type)) {
            toast.error("Invalid file type. Upload PNG, JPG, WebP, or PDF.");
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            toast.error("File too large. Maximum 20MB.");
            return;
        }

        setUploadingFile(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(",")[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            await uploadFloorPlan.mutateAsync({
                projectId,
                filename: file.name,
                mimeType: file.type,
                base64Data: base64,
            });

            toast.success("Floor plan uploaded successfully");
            projectQuery.refetch();
        } catch (error: any) {
            toast.error(error.message || "Upload failed");
        } finally {
            setUploadingFile(false);
        }
    }, [projectId, uploadFloorPlan, projectQuery]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            await analyzeFloorPlan.mutateAsync({ projectId });
            toast.success("Floor plan analysis complete!");
            projectQuery.refetch();
            benchmarkQuery.refetch();
        } catch (error: any) {
            toast.error(error.message || "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    };

    const analysis = project?.floorPlanAnalysis as any;
    const benchmark = benchmarkQuery.data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" />
                        Space Planner
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload floor plans for AI-powered room extraction and DLD-backed space advice
                    </p>
                </div>
                {project?.dldAreaName && (
                    <Badge variant="outline" className="gap-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        {project.dldAreaName}
                    </Badge>
                )}
            </div>

            {/* Upload Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Upload className="h-4 w-4 text-primary" />
                        Floor Plan
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!project?.floorPlanAssetId ? (
                        <div
                            onDrop={handleDrop}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${dragOver
                                ? "border-primary bg-primary/5 scale-[1.01]"
                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                                }`}
                            onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*,.pdf";
                                input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) handleFile(file);
                                };
                                input.click();
                            }}
                        >
                            {uploadingFile ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                                    <p className="text-sm font-medium text-foreground">Uploading floor plan...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="p-4 rounded-2xl bg-primary/10">
                                        <FileImage className="h-8 w-8 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            Drop your floor plan here or click to browse
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Supports PNG, JPG, WebP, or PDF — max 20MB
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Floor plan uploaded</p>
                                    <p className="text-xs text-muted-foreground">
                                        {analysis ? `${analysis.rooms?.length || 0} rooms extracted` : "Ready for AI analysis"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const input = document.createElement("input");
                                        input.type = "file";
                                        input.accept = "image/*,.pdf";
                                        input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file) handleFile(file);
                                        };
                                        input.click();
                                    }}
                                    disabled={uploadingFile}
                                >
                                    Replace
                                </Button>
                                {!analysis && (
                                    <Button
                                        size="sm"
                                        onClick={handleAnalyze}
                                        disabled={analyzing}
                                        className="gap-1"
                                    >
                                        {analyzing ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Brain className="h-3.5 w-3.5" />
                                        )}
                                        Analyze with AI
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Analysis Results */}
            {analysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="pt-6">
                            <p className="text-xs text-muted-foreground">Total Area</p>
                            <p className="text-2xl font-bold text-foreground">{analysis.totalEstimatedSqm?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">sqm</span></p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Unit Type: <span className="text-foreground font-medium">{analysis.unitType}</span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent">
                        <CardContent className="pt-6">
                            <p className="text-xs text-muted-foreground">Rooms Detected</p>
                            <p className="text-2xl font-bold text-foreground">{analysis.rooms?.length || 0}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {analysis.bedroomCount} bed, {analysis.bathroomCount} bath
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500/5 to-transparent">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Analysis Confidence</p>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">Based on image clarity and Gemini Vision extraction accuracy</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                {Math.round((analysis.analysisConfidence || 0) * 100)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Circulation: {analysis.circulationPercentage?.toFixed(1)}%
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Room Breakdown Table */}
            {analysis?.rooms && analysis.rooms.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Brain className="h-4 w-4 text-primary" />
                            Room Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border border-border rounded-lg overflow-hidden">
                            <div className="grid grid-cols-[200px_80px_80px_80px_60px] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                                <span>Room</span>
                                <span>Type</span>
                                <span className="text-right">Area (sqm)</span>
                                <span className="text-right">% of Total</span>
                                <span className="text-center">Grade</span>
                            </div>
                            {analysis.rooms.map((room: any, i: number) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-[200px_80px_80px_80px_60px] gap-2 px-4 py-2.5 border-t border-border text-sm items-center hover:bg-muted/20 transition-colors"
                                >
                                    <span className="font-medium text-foreground">{room.name}</span>
                                    <span className="text-muted-foreground text-xs">{room.type}</span>
                                    <span className="text-right text-foreground">{room.estimatedSqm?.toFixed(1)}</span>
                                    <span className="text-right text-muted-foreground">{room.percentOfTotal?.toFixed(1)}%</span>
                                    <span className="text-center">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 ${room.finishGrade === "A"
                                                ? "border-emerald-500/30 text-emerald-400"
                                                : room.finishGrade === "B"
                                                    ? "border-amber-500/30 text-amber-400"
                                                    : "border-muted-foreground/30 text-muted-foreground"
                                                }`}
                                        >
                                            {room.finishGrade}
                                        </Badge>
                                    </span>
                                </div>
                            ))}
                        </div>
                        {!benchmark && (
                            <div className="mt-4 flex justify-end">
                                <Button onClick={() => benchmarkQuery.refetch()} className="gap-1" size="sm">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Run DLD Benchmark
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* DLD-Backed Space Recommendations */}
            {benchmark && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Space Optimization — DLD-Backed Recommendations
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            {benchmark.areaName} • DLD-backed benchmark analysis
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Efficiency Score</p>
                                <p className="text-xl font-bold text-foreground">{benchmark.overallEfficiencyScore}<span className="text-xs font-normal text-muted-foreground">/100</span></p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Critical Issues</p>
                                <p className={`text-xl font-bold ${benchmark.totalCritical > 0 ? "text-red-400" : "text-emerald-400"}`}>{benchmark.totalCritical}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Advisory Notes</p>
                                <p className="text-xl font-bold text-amber-400">{benchmark.totalAdvisory}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground">Optimal Areas</p>
                                <p className="text-xl font-bold text-emerald-400">{benchmark.totalOptimal}</p>
                            </div>
                        </div>

                        {/* Detailed Recommendations */}
                        <div className="space-y-3">
                            {benchmark.recommendations?.map((rec: any, i: number) => {
                                const style = SEVERITY_STYLES[rec.severity] || SEVERITY_STYLES.advisory;
                                const Icon = style.icon;
                                const deviationDirection = rec.delta > 0 ? "above" : rec.delta < 0 ? "below" : "at";
                                const DeviationIcon = rec.delta > 0 ? ArrowUpRight : rec.delta < 0 ? ArrowDownRight : Minus;

                                return (
                                    <div
                                        key={i}
                                        className={`rounded-lg border p-4 ${style.bg} ${style.border} transition-all hover:shadow-sm`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${style.text}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <h4 className="text-sm font-semibold text-foreground">{rec.roomType}</h4>
                                                    <div className="flex items-center gap-2 text-xs shrink-0">
                                                        <span className="text-muted-foreground">
                                                            {rec.currentPercent?.toFixed(1)}% → {rec.benchmarkPercent?.toFixed(1)}% optimal
                                                        </span>
                                                        <Badge variant="outline" className={`text-[10px] gap-0.5 ${style.text} ${style.border}`}>
                                                            <DeviationIcon className="h-3 w-3" />
                                                            {Math.abs(rec.delta)?.toFixed(1)}% {deviationDirection}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{rec.action}</p>
                                                {rec.financialImpact && (
                                                    <p className="text-xs font-medium mt-1.5 text-foreground/80">
                                                        💰 {rec.financialImpact}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Empty state when no analysis */}
            {!analysis && project?.floorPlanAssetId && (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <Brain className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground">Ready for Analysis</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            Your floor plan is uploaded. Click "Analyze with AI" to extract rooms, detect spatial ratios,
                            and compare against DLD transaction data for your area.
                        </p>
                        <Button onClick={handleAnalyze} disabled={analyzing} className="mt-4 gap-2">
                            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                            {analyzing ? "Analyzing..." : "Analyze Floor Plan"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Empty state when no floor plan */}
            {!project?.floorPlanAssetId && (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center">
                        <FileImage className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground">No Floor Plan Yet</h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                            Upload a floor plan above to get started. MIYAR will extract room dimensions,
                            compare them to DLD benchmark data, and give you actionable advice.
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
