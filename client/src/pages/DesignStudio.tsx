/**
 * Design Studio — Unified Visual & Material Intelligence Hub (V4)
 * Merges VisualStudio + BoardComposer into a premium 4-tab experience:
 *   Studio · Visuals · Materials · Cost Overlay
 */
import { useState, useMemo, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    Wand2, Image, Loader2, AlertCircle, Sparkles, Palette, Camera, Eye, Clock, Hash,
    Plus, Package, Trash2, FileSpreadsheet, Lightbulb, DollarSign,
    AlertTriangle, ChevronUp, ChevronDown, FileText, Pencil, Save, X, Download,
    Pin, PinOff, TrendingUp, Layers, BarChart3, Home,
} from "lucide-react";
import { toast } from "sonner";

const COST_BANDS = ["Economy", "Mid-Range", "Premium", "Luxury", "Ultra-Luxury", "Custom"];

export default function DesignStudio() {
    const [, params] = useRoute("/projects/:id/design-studio");
    const projectId = Number(params?.id);
    const [activeTab, setActiveTab] = useState("studio");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="design-studio-header rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                            <Layers className="h-6 w-6" />
                            Design Studio
                        </h2>
                        <p className="text-muted-foreground mt-1">
                            Visual intelligence, material curation, and live market pricing — unified
                        </p>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="design-studio-tabs">
                    <TabsTrigger value="studio" className="gap-2"><Sparkles className="h-4 w-4" /> Studio</TabsTrigger>
                    <TabsTrigger value="visuals" className="gap-2"><Camera className="h-4 w-4" /> Visuals</TabsTrigger>
                    <TabsTrigger value="materials" className="gap-2"><Package className="h-4 w-4" /> Materials</TabsTrigger>
                    <TabsTrigger value="costs" className="gap-2"><TrendingUp className="h-4 w-4" /> Cost Overlay</TabsTrigger>
                </TabsList>

                <TabsContent value="studio">
                    <StudioOverviewTab projectId={projectId} onNavigate={setActiveTab} />
                </TabsContent>
                <TabsContent value="visuals">
                    <VisualsTab projectId={projectId} />
                </TabsContent>
                <TabsContent value="materials">
                    <MaterialsTab projectId={projectId} />
                </TabsContent>
                <TabsContent value="costs">
                    <CostOverlayTab projectId={projectId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── STUDIO OVERVIEW TAB ─────────────────────────────────────────────────────

function StudioOverviewTab({ projectId, onNavigate }: { projectId: number; onNavigate: (tab: string) => void }) {
    const visuals = trpc.design.listVisuals.useQuery({ projectId }, { enabled: !!projectId });
    const boards = trpc.design.listBoards.useQuery({ projectId }, { enabled: !!projectId });

    const generateMutation = trpc.design.generateVisual.useMutation({
        onSuccess: (result) => {
            if (result.status === "completed") {
                toast.success("Visual generated", { description: "Image created and saved" });
            } else {
                toast.error("Generation failed", { description: result.error || "Unknown error" });
            }
            visuals.refetch();
        },
        onError: (err) => toast.error("Generation failed", { description: err.message }),
    });

    const quickGenerate = (type: "mood" | "material_board" | "hero") => {
        generateMutation.mutate({ projectId, type });
    };

    const completedVisuals = visuals.data?.filter((v: any) => v.status === "completed") || [];
    const latestMood = completedVisuals.find((v: any) => v.type === "mood");
    const latestHero = completedVisuals.find((v: any) => v.type === "hero");

    return (
        <div className="space-y-6">
            {/* Quick Generate */}
            <div className="grid gap-4 md:grid-cols-3">
                {[
                    { type: "mood" as const, icon: <Palette className="h-5 w-5" />, label: "Mood Board", desc: "Interior aesthetic direction" },
                    { type: "material_board" as const, icon: <Sparkles className="h-5 w-5" />, label: "Material Board", desc: "Curated finish palette" },
                    { type: "hero" as const, icon: <Camera className="h-5 w-5" />, label: "Hero Image", desc: "Marketing render" },
                    { type: "hero" as const, icon: <Home className="h-5 w-5" />, label: "Room Render", desc: "Board-aware room visual" },
                ].map(({ type, icon, label, desc }) => (
                    <Card key={type} className="design-studio-glass cursor-pointer group hover:border-primary/40 transition-all duration-300"
                        onClick={() => !generateMutation.isPending && quickGenerate(type)}>
                        <CardContent className="py-6 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                                {icon}
                            </div>
                            <h3 className="font-semibold">{label}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                            {generateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto mt-3 text-primary" />
                            ) : (
                                <div className="text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">Click to generate →</div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Latest Visuals Preview */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="design-studio-glass overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Palette className="h-4 w-4" /> Latest Mood Board
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {latestMood?.imageUrl ? (
                            <div className="design-studio-image-container rounded-lg overflow-hidden cursor-pointer" onClick={() => onNavigate("visuals")}>
                                <img src={latestMood.imageUrl} alt="Latest mood board" className="design-studio-image w-full h-48 object-cover" />
                                <div className="design-studio-image-overlay">
                                    <Eye className="h-5 w-5 text-white" />
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center">
                                <p className="text-sm text-muted-foreground">No mood board yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="design-studio-glass overflow-hidden">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Camera className="h-4 w-4" /> Latest Hero Image
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {latestHero?.imageUrl ? (
                            <div className="design-studio-image-container rounded-lg overflow-hidden cursor-pointer" onClick={() => onNavigate("visuals")}>
                                <img src={latestHero.imageUrl} alt="Latest hero" className="design-studio-image w-full h-48 object-cover" />
                                <div className="design-studio-image-overlay">
                                    <Eye className="h-5 w-5 text-white" />
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 bg-muted/30 rounded-lg flex items-center justify-center">
                                <p className="text-sm text-muted-foreground">No hero image yet</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Stats */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Card className="design-studio-glass">
                    <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold">{completedVisuals.length}</p>
                        <p className="text-xs text-muted-foreground">Visuals Generated</p>
                    </CardContent>
                </Card>
                <Card className="design-studio-glass">
                    <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold">{boards.data?.length || 0}</p>
                        <p className="text-xs text-muted-foreground">Material Boards</p>
                    </CardContent>
                </Card>
                <Card className="design-studio-glass">
                    <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold">{visuals.data?.filter((v: any) => v.type === "mood").length || 0}</p>
                        <p className="text-xs text-muted-foreground">Mood Boards</p>
                    </CardContent>
                </Card>
                <Card className="design-studio-glass">
                    <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold">{visuals.data?.filter((v: any) => v.type === "hero").length || 0}</p>
                        <p className="text-xs text-muted-foreground">Hero Images</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── VISUALS TAB ─────────────────────────────────────────────────────────────

function VisualsTab({ projectId }: { projectId: number }) {
    const [genType, setGenType] = useState<"mood" | "material_board" | "hero" | "room_render">("mood");
    const [customPrompt, setCustomPrompt] = useState("");
    const [useCustom, setUseCustom] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
    const [previewVisual, setPreviewVisual] = useState<any>(null);
    const [pinDialogVisual, setPinDialogVisual] = useState<any>(null);
    const [roomName, setRoomName] = useState("Master Bedroom");
    const [roomSqm, setRoomSqm] = useState("35");

    const visuals = trpc.design.listVisuals.useQuery({ projectId }, { enabled: !!projectId });
    const templates = trpc.design.listPromptTemplates.useQuery({ type: genType });
    const boards = trpc.design.listBoards.useQuery({ projectId }, { enabled: !!projectId });

    const generateMutation = trpc.design.generateVisual.useMutation({
        onSuccess: (result) => {
            if (result.status === "completed") {
                toast.success("Visual generated", { description: "Image created and saved" });
            } else {
                toast.error("Generation failed", { description: result.error || "Unknown error" });
            }
            visuals.refetch();
        },
        onError: (err) => toast.error("Generation failed", { description: err.message }),
    });

    const pinMutation = trpc.design.pinVisualToBoard.useMutation({
        onSuccess: () => {
            toast.success("Visual pinned to board");
            setPinDialogVisual(null);
        },
        onError: (err) => toast.error("Pin failed", { description: err.message }),
    });

    // Phase 9: Room render mutation (uses board-aware prompts)
    const roomRenderMutation = trpc.design.generateRoomRender.useMutation({
        onSuccess: (result: any) => {
            if (result.status === "completed") {
                toast.success("Room render generated", { description: `${roomName} visualization created` });
            } else {
                toast.error("Render failed", { description: result.error || "Unknown error" });
            }
            visuals.refetch();
        },
        onError: (err: any) => toast.error("Render failed", { description: err.message }),
    });

    const handleGenerate = () => {
        if (genType === "room_render") {
            roomRenderMutation.mutate({
                projectId,
                roomName,
                roomType: "bedroom",
                roomSqm: Number(roomSqm) || 30,
                finishGrade: "A",
            });
            return;
        }
        generateMutation.mutate({
            projectId,
            type: genType,
            customPrompt: useCustom ? customPrompt : undefined,
            templateId: !useCustom ? selectedTemplateId : undefined,
        });
    };

    const typeIcons: Record<string, React.ReactNode> = {
        mood: <Palette className="h-4 w-4" />,
        material_board: <Sparkles className="h-4 w-4" />,
        hero: <Camera className="h-4 w-4" />,
    };

    const typeLabels: Record<string, string> = {
        mood: "Mood Board",
        material_board: "Material Board",
        hero: "Marketing Hero",
        room_render: "Room Render",
    };

    const statusColors: Record<string, string> = {
        completed: "bg-green-500/10 text-green-600",
        generating: "bg-yellow-500/10 text-yellow-600",
        pending: "bg-blue-500/10 text-blue-600",
        failed: "bg-red-500/10 text-red-600",
    };

    const moodVisuals = useMemo(() => visuals.data?.filter((v: any) => v.type === "mood") || [], [visuals.data]);
    const boardVisuals = useMemo(() => visuals.data?.filter((v: any) => v.type === "material_board") || [], [visuals.data]);
    const heroVisuals = useMemo(() => visuals.data?.filter((v: any) => v.type === "hero") || [], [visuals.data]);

    return (
        <div className="space-y-6">
            {/* Generation Controls */}
            <Card className="design-studio-glass">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Generate Visual</CardTitle>
                    <CardDescription>Select a type and template, or write a custom prompt</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Visual Type</label>
                            <Select value={genType} onValueChange={(v) => setGenType(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mood">Mood Board</SelectItem>
                                    <SelectItem value="material_board">Material Board</SelectItem>
                                    <SelectItem value="hero">Marketing Hero</SelectItem>
                                    <SelectItem value="room_render">Room Render (Board-Aware)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Prompt Source</label>
                            <Select value={useCustom ? "custom" : "template"} onValueChange={(v) => setUseCustom(v === "custom")}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="template">Use Template (from project context)</SelectItem>
                                    <SelectItem value="custom">Custom Prompt</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {!useCustom && (
                            <div>
                                <label className="text-sm font-medium mb-1 block">Template</label>
                                <Select value={selectedTemplateId?.toString() || "auto"} onValueChange={(v) => setSelectedTemplateId(v === "auto" ? undefined : Number(v))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto (active template)</SelectItem>
                                        {templates.data?.map((t: any) => (
                                            <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {useCustom && genType !== "room_render" && (
                        <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Describe the visual you want to generate..." rows={3} />
                    )}
                    {genType === "room_render" && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Room Name</label>
                                <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. Master Bedroom" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Room Area (sqm)</label>
                                <Input type="number" value={roomSqm} onChange={e => setRoomSqm(e.target.value)} placeholder="35" />
                            </div>
                            <p className="text-xs text-muted-foreground md:col-span-2">
                                <Home className="inline h-3 w-3 mr-1" />
                                Materials from your active board will be injected into the render prompt automatically.
                            </p>
                        </div>
                    )}
                    <Button onClick={handleGenerate} disabled={generateMutation.isPending || roomRenderMutation.isPending} className="w-full md:w-auto">
                        {(generateMutation.isPending || roomRenderMutation.isPending) ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                        ) : (
                            <><Wand2 className="mr-2 h-4 w-4" /> Generate {typeLabels[genType]}</>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {/* Gallery */}
            <Tabs defaultValue="all" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="all">All ({visuals.data?.length || 0})</TabsTrigger>
                    <TabsTrigger value="mood">Mood ({moodVisuals.length})</TabsTrigger>
                    <TabsTrigger value="material_board">Material ({boardVisuals.length})</TabsTrigger>
                    <TabsTrigger value="hero">Hero ({heroVisuals.length})</TabsTrigger>
                </TabsList>

                {["all", "mood", "material_board", "hero"].map(tab => (
                    <TabsContent key={tab} value={tab}>
                        {(() => {
                            const items = tab === "all" ? visuals.data : tab === "mood" ? moodVisuals : tab === "material_board" ? boardVisuals : heroVisuals;
                            if (!items?.length) return (
                                <Card className="design-studio-glass">
                                    <CardContent className="py-12 text-center">
                                        <Image className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                        <p className="text-muted-foreground">No visuals generated yet</p>
                                    </CardContent>
                                </Card>
                            );
                            return (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {items.map((visual: any) => {
                                        const promptData = visual.promptJson as any;
                                        const imgUrl = visual.imageUrl || promptData?.url || null;
                                        return (
                                            <Card key={visual.id} className="design-studio-glass overflow-hidden group cursor-pointer hover:border-primary/30 transition-all duration-300">
                                                {visual.status === "completed" && imgUrl && (
                                                    <div className="design-studio-image-container aspect-video relative overflow-hidden"
                                                        onClick={() => setPreviewVisual(visual)}>
                                                        <img src={imgUrl} alt={`${visual.type} visual`}
                                                            className="design-studio-image w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                        <div className="design-studio-image-overlay">
                                                            <Eye className="h-6 w-6 text-white" />
                                                        </div>
                                                    </div>
                                                )}
                                                {visual.status === "completed" && !imgUrl && (
                                                    <div className="aspect-video bg-muted flex items-center justify-center">
                                                        <Image className="h-8 w-8 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {visual.status === "generating" && (
                                                    <div className="aspect-video bg-muted flex items-center justify-center">
                                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                    </div>
                                                )}
                                                {visual.status === "failed" && (
                                                    <div className="aspect-video bg-destructive/5 flex flex-col items-center justify-center gap-2">
                                                        <AlertCircle className="h-8 w-8 text-destructive" />
                                                        <span className="text-xs text-destructive">{visual.errorMessage || "Generation failed"}</span>
                                                    </div>
                                                )}
                                                <CardContent className="pt-3 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {typeIcons[visual.type]}
                                                            <span className="text-sm font-medium">{typeLabels[visual.type]}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {visual.status === "completed" && visual.imageAssetId && boards.data && boards.data.length > 0 && (
                                                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                                                    onClick={(e) => { e.stopPropagation(); setPinDialogVisual(visual); }}>
                                                                    <Pin className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Badge className={statusColors[visual.status]}>{visual.status}</Badge>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {promptData?.prompt ? promptData.prompt.slice(0, 80) + "..." : "—"}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(visual.createdAt).toLocaleDateString()}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Hash className="h-3 w-3" />
                                                            {visual.modelVersion || "gemini-v1"}
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </TabsContent>
                ))}
            </Tabs>

            {/* Visual Detail Dialog */}
            <Dialog open={!!previewVisual} onOpenChange={(open) => !open && setPreviewVisual(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {previewVisual && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {typeIcons[previewVisual.type]}
                                    {typeLabels[previewVisual.type]} — #{previewVisual.id}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                {(() => {
                                    const imgUrl = previewVisual.imageUrl || (previewVisual.promptJson as any)?.url;
                                    return imgUrl ? (
                                        <div className="rounded-lg overflow-hidden bg-muted">
                                            <img src={imgUrl} alt="Visual preview" className="w-full h-auto" />
                                        </div>
                                    ) : null;
                                })()}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <div className="text-xs text-muted-foreground">Status</div>
                                        <Badge className={statusColors[previewVisual.status]}>{previewVisual.status}</Badge>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Model</div>
                                        <div className="font-mono text-xs">{previewVisual.modelVersion || "gemini-v1"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">Created</div>
                                        <div>{new Date(previewVisual.createdAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                {previewVisual.promptJson && (
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Prompt Used</div>
                                        <div className="bg-muted/30 rounded p-3 text-sm border-l-2 border-primary/30 whitespace-pre-wrap">
                                            {(previewVisual.promptJson as any).prompt || "—"}
                                        </div>
                                    </div>
                                )}
                                {(previewVisual.promptJson as any)?.context && (
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1 font-medium">Project Context</div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                            {Object.entries((previewVisual.promptJson as any).context).map(([key, val]) => (
                                                <div key={key} className="bg-muted/20 rounded p-2">
                                                    <span className="text-muted-foreground">{key}:</span>{" "}
                                                    <span className="font-medium">{String(val)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Pin to Board Dialog */}
            <Dialog open={!!pinDialogVisual} onOpenChange={(open) => !open && setPinDialogVisual(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pin className="h-5 w-5" /> Pin to Material Board
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Select a board to pin this visual to:</p>
                        {boards.data?.map((board: any) => (
                            <Button key={board.id} variant="outline" className="w-full justify-start"
                                disabled={pinMutation.isPending}
                                onClick={() => pinMutation.mutate({ visualId: pinDialogVisual.id, boardId: board.id })}>
                                <Package className="mr-2 h-4 w-4" />
                                {board.boardName}
                            </Button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── MATERIALS TAB ───────────────────────────────────────────────────────────

function MaterialsTab({ projectId }: { projectId: number }) {
    const [newBoardName, setNewBoardName] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
    const [addMaterialOpen, setAddMaterialOpen] = useState(false);
    const [materialFilter, setMaterialFilter] = useState("");
    const [editingTileId, setEditingTileId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ specNotes: string; costBandOverride: string; quantity: string; unitOfMeasure: string; notes: string }>({
        specNotes: "", costBandOverride: "", quantity: "", unitOfMeasure: "", notes: "",
    });

    const boards = trpc.design.listBoards.useQuery({ projectId }, { enabled: !!projectId });
    const materials = trpc.design.listMaterials.useQuery({});
    const recommended = trpc.design.recommendMaterials.useQuery({ projectId }, { enabled: !!projectId });
    const selectedBoard = trpc.design.getBoard.useQuery({ boardId: selectedBoardId! }, { enabled: !!selectedBoardId });
    const boardSummary = trpc.design.boardSummary.useQuery({ boardId: selectedBoardId! }, { enabled: !!selectedBoardId });
    const pinnedVisuals = trpc.design.listPinnedVisuals.useQuery({ boardId: selectedBoardId! }, { enabled: !!selectedBoardId });

    const createBoardMutation = trpc.design.createBoard.useMutation({
        onSuccess: (result) => { toast.success("Board created"); boards.refetch(); setSelectedBoardId(result.id); setCreateOpen(false); setNewBoardName(""); },
    });
    const addMaterialMutation = trpc.design.addMaterialToBoard.useMutation({
        onSuccess: () => { toast.success("Material added"); selectedBoard.refetch(); boardSummary.refetch(); },
    });
    const removeMaterialMutation = trpc.design.removeMaterialFromBoard.useMutation({
        onSuccess: () => { toast.success("Material removed"); selectedBoard.refetch(); boardSummary.refetch(); },
    });
    const deleteBoardMutation = trpc.design.deleteBoard.useMutation({
        onSuccess: () => { toast.success("Board deleted"); boards.refetch(); setSelectedBoardId(null); },
    });
    const updateTileMutation = trpc.design.updateBoardTile.useMutation({
        onSuccess: () => { toast.success("Tile updated"); setEditingTileId(null); selectedBoard.refetch(); boardSummary.refetch(); },
    });
    const reorderMutation = trpc.design.reorderBoardTiles.useMutation({
        onSuccess: () => { selectedBoard.refetch(); },
    });
    const exportPdfMutation = trpc.design.exportBoardPdf.useMutation({
        onSuccess: (result) => {
            if (result.fileUrl) { window.open(result.fileUrl, "_blank"); toast.success("Board PDF exported"); }
            else if (result.html) {
                const blob = new Blob([result.html], { type: "text/html" });
                window.open(URL.createObjectURL(blob), "_blank");
                toast.success("Board PDF generated (local preview)");
            }
        },
        onError: () => toast.error("Failed to export board PDF"),
    });
    const unpinMutation = trpc.design.unpinVisual.useMutation({
        onSuccess: () => { toast.success("Visual unpinned"); pinnedVisuals.refetch(); },
    });

    const filteredMaterials = useMemo(() => {
        if (!materials.data) return [];
        if (!materialFilter) return materials.data;
        const lower = materialFilter.toLowerCase();
        return materials.data.filter((m: any) => m.name.toLowerCase().includes(lower) || m.category.toLowerCase().includes(lower));
    }, [materials.data, materialFilter]);

    const startEditing = useCallback((mat: any) => {
        setEditingTileId(mat.boardJoinId);
        setEditForm({
            specNotes: mat.specNotes || "", costBandOverride: mat.costBandOverride || "",
            quantity: mat.quantity ? String(mat.quantity) : "", unitOfMeasure: mat.unitOfMeasure || "",
            notes: mat.boardNotes || "",
        });
    }, []);

    const saveEdit = useCallback(() => {
        if (!editingTileId) return;
        updateTileMutation.mutate({
            joinId: editingTileId,
            specNotes: editForm.specNotes || null,
            costBandOverride: editForm.costBandOverride || null,
            quantity: editForm.quantity ? Number(editForm.quantity) : null,
            unitOfMeasure: editForm.unitOfMeasure || null,
            notes: editForm.notes || null,
        });
    }, [editingTileId, editForm, updateTileMutation]);

    const moveTile = useCallback((direction: "up" | "down", mat: any) => {
        if (!selectedBoard.data?.materials) return;
        const mats = [...selectedBoard.data.materials];
        const idx = mats.findIndex((m: any) => m.boardJoinId === mat.boardJoinId);
        if (idx < 0 || (direction === "up" && idx === 0) || (direction === "down" && idx === mats.length - 1)) return;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        [mats[idx], mats[swapIdx]] = [mats[swapIdx], mats[idx]];
        reorderMutation.mutate({ boardId: selectedBoardId!, orderedJoinIds: mats.map((m: any) => m.boardJoinId) });
    }, [selectedBoard.data, selectedBoardId, reorderMutation]);

    const tierColors: Record<string, string> = {
        economy: "bg-gray-100 text-gray-700", mid: "bg-blue-100 text-blue-700",
        premium: "bg-purple-100 text-purple-700", luxury: "bg-amber-100 text-amber-700",
        ultra_luxury: "bg-rose-100 text-rose-700",
    };
    const leadColors: Record<string, string> = {
        short: "text-green-600", medium: "text-yellow-600", long: "text-orange-600", critical: "text-red-600",
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Material Boards</h3>
                    <p className="text-sm text-muted-foreground">Create boards with cost estimates, spec notes, and RFQ-ready lists</p>
                </div>
                <div className="flex gap-2">
                    {selectedBoardId && (
                        <Button variant="outline" onClick={() => exportPdfMutation.mutate({ boardId: selectedBoardId })} disabled={exportPdfMutation.isPending}>
                            <Download className="mr-2 h-4 w-4" />{exportPdfMutation.isPending ? "Exporting..." : "Export PDF"}
                        </Button>
                    )}
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button><Plus className="mr-2 h-4 w-4" /> New Board</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Create Material Board</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <Input placeholder="Board name (e.g., Master Suite Materials)" value={newBoardName} onChange={e => setNewBoardName(e.target.value)} />
                                <p className="text-sm font-medium">Quick Start: Add Recommended Materials</p>
                                <p className="text-xs text-muted-foreground">{recommended.data?.length || 0} materials recommended based on project tier</p>
                                <Button onClick={() => createBoardMutation.mutate({ projectId, boardName: newBoardName || "Untitled Board", materialIds: recommended.data?.map((m: any) => m.materialId) })} disabled={createBoardMutation.isPending} className="w-full">
                                    Create with Recommendations
                                </Button>
                                <Button variant="outline" onClick={() => createBoardMutation.mutate({ projectId, boardName: newBoardName || "Untitled Board" })} disabled={createBoardMutation.isPending} className="w-full">
                                    Create Empty Board
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Board List */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Boards</h4>
                    {boards.data?.length === 0 && (
                        <Card className="design-studio-glass"><CardContent className="py-8 text-center">
                            <Package className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No boards yet</p>
                        </CardContent></Card>
                    )}
                    {boards.data?.map((board: any) => (
                        <Card key={board.id}
                            className={`design-studio-glass cursor-pointer transition-colors ${selectedBoardId === board.id ? "border-primary" : "hover:border-muted-foreground/30"}`}
                            onClick={() => setSelectedBoardId(board.id)}>
                            <CardContent className="py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-sm">{board.boardName}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(board.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                        onClick={(e) => { e.stopPropagation(); deleteBoardMutation.mutate({ boardId: board.id }); }}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Board Detail */}
                <div className="lg:col-span-2 space-y-4">
                    {!selectedBoardId ? (
                        <Card className="design-studio-glass">
                            <CardContent className="py-16 text-center">
                                <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground">Select a board or create a new one</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Pinned Visuals */}
                            {pinnedVisuals.data && pinnedVisuals.data.length > 0 && (
                                <Card className="design-studio-glass">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm flex items-center gap-2"><Pin className="h-4 w-4" /> Pinned Visuals</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-3 overflow-x-auto pb-2">
                                            {pinnedVisuals.data.map((pv: any) => (
                                                <div key={pv.linkId} className="relative shrink-0 w-32 h-24 rounded-lg overflow-hidden group">
                                                    {pv.imageUrl ? (
                                                        <img src={pv.imageUrl} alt="Pinned visual" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-muted flex items-center justify-center">
                                                            <Image className="h-6 w-6 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                    <Button variant="ghost" size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => unpinMutation.mutate({ linkId: pv.linkId })}>
                                                        <PinOff className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Summary Cards */}
                            {boardSummary.data && (
                                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                                    <Card className="design-studio-glass"><CardContent className="py-3">
                                        <p className="text-xs text-muted-foreground">Items</p>
                                        <p className="text-xl font-bold">{boardSummary.data.summary.totalItems}</p>
                                    </CardContent></Card>
                                    <Card className="design-studio-glass"><CardContent className="py-3">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Est. Cost</p>
                                        <p className="text-sm font-bold">{boardSummary.data.summary.estimatedCostLow.toLocaleString()} — {boardSummary.data.summary.estimatedCostHigh.toLocaleString()} AED</p>
                                    </CardContent></Card>
                                    <Card className="design-studio-glass"><CardContent className="py-3">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Longest Lead</p>
                                        <p className="text-xl font-bold">{boardSummary.data.summary.longestLeadTimeDays}d</p>
                                    </CardContent></Card>
                                    <Card className="design-studio-glass"><CardContent className="py-3">
                                        <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Critical</p>
                                        <p className="text-xl font-bold">{boardSummary.data.summary.criticalPathItems.length}</p>
                                    </CardContent></Card>
                                </div>
                            )}

                            {/* Materials List */}
                            <Card className="design-studio-glass">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">Materials</CardTitle>
                                        <Dialog open={addMaterialOpen} onOpenChange={setAddMaterialOpen}>
                                            <DialogTrigger asChild>
                                                <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Material</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                                                <DialogHeader><DialogTitle>Add Material to Board</DialogTitle></DialogHeader>
                                                <Input placeholder="Search materials..." value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="mb-3" />
                                                <div className="space-y-2">
                                                    {filteredMaterials.slice(0, 20).map((mat: any) => (
                                                        <div key={mat.id} className="flex items-center justify-between p-2 rounded border hover:bg-accent/50">
                                                            <div>
                                                                <p className="text-sm font-medium">{mat.name}</p>
                                                                <div className="flex gap-2 text-xs text-muted-foreground">
                                                                    <Badge variant="outline" className="text-xs">{mat.category}</Badge>
                                                                    <Badge className={`text-xs ${tierColors[mat.tier] || ""}`}>{mat.tier}</Badge>
                                                                    <span>{mat.typicalCostLow}–{mat.typicalCostHigh} {mat.costUnit}</span>
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="outline" onClick={() => addMaterialMutation.mutate({ boardId: selectedBoardId!, materialId: mat.id })}>Add</Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {!selectedBoard.data?.materials?.length ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">No materials added yet</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedBoard.data.materials.map((mat: any, idx: number) => (
                                                <div key={mat.boardJoinId} className="rounded-lg border">
                                                    <div className="flex items-center justify-between p-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full w-5 h-5 flex items-center justify-center shrink-0">{idx + 1}</span>
                                                                <p className="text-sm font-medium">{mat.name}</p>
                                                            </div>
                                                            <div className="flex gap-2 items-center flex-wrap mt-1 ml-7">
                                                                <Badge variant="outline" className="text-xs">{mat.category}</Badge>
                                                                <Badge className={`text-xs ${tierColors[mat.tier] || ""}`}>{mat.tier}</Badge>
                                                                <span className="text-xs text-muted-foreground">{mat.typicalCostLow}–{mat.typicalCostHigh} {mat.costUnit}</span>
                                                                <span className={`text-xs ${leadColors[mat.leadTimeBand] || ""}`}>{mat.leadTimeDays}d lead</span>
                                                                {mat.supplierName && <span className="text-xs text-muted-foreground">• {mat.supplierName}</span>}
                                                                {mat.costBandOverride && <Badge variant="secondary" className="text-xs">{mat.costBandOverride}</Badge>}
                                                            </div>
                                                            {mat.specNotes && (
                                                                <p className="text-xs text-blue-600 mt-1 ml-7 italic">
                                                                    <FileText className="inline h-3 w-3 mr-1" />{mat.specNotes}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTile("up", mat)} disabled={idx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveTile("down", mat)} disabled={idx === (selectedBoard.data?.materials?.length ?? 0) - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(mat)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMaterialMutation.mutate({ joinId: mat.boardJoinId })}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                        </div>
                                                    </div>
                                                    {editingTileId === mat.boardJoinId && (
                                                        <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="text-xs font-medium text-muted-foreground">Spec Notes</label>
                                                                    <Textarea placeholder="e.g., Calacatta Gold, honed finish" value={editForm.specNotes} onChange={e => setEditForm(f => ({ ...f, specNotes: e.target.value }))} className="mt-1 text-xs" rows={2} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-medium text-muted-foreground">Cost Band Override</label>
                                                                    <Select value={editForm.costBandOverride || "none"} onValueChange={v => setEditForm(f => ({ ...f, costBandOverride: v === "none" ? "" : v }))}>
                                                                        <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select cost band" /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">No override</SelectItem>
                                                                            {COST_BANDS.map(band => <SelectItem key={band} value={band}>{band}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div><label className="text-xs font-medium text-muted-foreground">Quantity</label><Input type="number" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} className="mt-1 text-xs" /></div>
                                                                <div><label className="text-xs font-medium text-muted-foreground">Unit</label><Input value={editForm.unitOfMeasure} onChange={e => setEditForm(f => ({ ...f, unitOfMeasure: e.target.value }))} className="mt-1 text-xs" /></div>
                                                                <div><label className="text-xs font-medium text-muted-foreground">Notes</label><Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="mt-1 text-xs" /></div>
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <Button size="sm" variant="ghost" onClick={() => setEditingTileId(null)}><X className="mr-1 h-3 w-3" /> Cancel</Button>
                                                                <Button size="sm" onClick={saveEdit} disabled={updateTileMutation.isPending}><Save className="mr-1 h-3 w-3" /> Save</Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* RFQ Lines */}
                            {boardSummary.data && boardSummary.data.rfqLines.length > 0 && (
                                <Card className="design-studio-glass">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> RFQ-Ready Line Items</CardTitle>
                                        <CardDescription>Export-ready procurement schedule</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead><tr className="border-b text-left">
                                                    <th className="py-2 pr-4">#</th><th className="py-2 pr-4">Material</th><th className="py-2 pr-4">Category</th>
                                                    <th className="py-2 pr-4">Est. Cost (AED)</th><th className="py-2 pr-4">Lead Time</th><th className="py-2">Supplier</th>
                                                </tr></thead>
                                                <tbody>
                                                    {boardSummary.data.rfqLines.map((line: any) => (
                                                        <tr key={line.lineNo} className="border-b last:border-0">
                                                            <td className="py-2 pr-4 text-muted-foreground">{line.lineNo}</td>
                                                            <td className="py-2 pr-4 font-medium">{line.materialName}</td>
                                                            <td className="py-2 pr-4">{line.category}</td>
                                                            <td className="py-2 pr-4">{line.estimatedUnitCostLow}–{line.estimatedUnitCostHigh}</td>
                                                            <td className="py-2 pr-4">{line.leadTimeDays}d</td>
                                                            <td className="py-2">{line.supplierSuggestion}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Recommendations */}
                            {recommended.data && recommended.data.length > 0 && (
                                <Card className="design-studio-glass">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Recommended Materials</CardTitle>
                                        <CardDescription>Based on project tier and evaluation</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {recommended.data.map((rec: any) => (
                                                <div key={rec.materialId} className="flex items-center justify-between p-2 rounded border">
                                                    <div>
                                                        <p className="text-sm font-medium">{rec.name}</p>
                                                        <p className="text-xs text-muted-foreground">{rec.category} • {rec.tier}</p>
                                                    </div>
                                                    <Button size="sm" variant="outline"
                                                        onClick={() => addMaterialMutation.mutate({ boardId: selectedBoardId!, materialId: rec.materialId })}>Add</Button>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── COST OVERLAY TAB ────────────────────────────────────────────────────────

function CostOverlayTab({ projectId }: { projectId: number }) {
    const [finishLevel, setFinishLevel] = useState("standard");
    const livePricing = trpc.admin.pricing.previewLive.useQuery({ finishLevel: finishLevel as any });
    const boards = trpc.design.listBoards.useQuery({ projectId }, { enabled: !!projectId });

    const categories = livePricing.data ? Object.entries(livePricing.data) : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Live Market Pricing</h3>
                    <p className="text-sm text-muted-foreground">Real-time benchmark data from approved market proposals</p>
                </div>
                <div className="w-48">
                    <Select value={finishLevel} onValueChange={setFinishLevel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                            <SelectItem value="luxury">Luxury</SelectItem>
                            <SelectItem value="ultra_luxury">Ultra Luxury</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {livePricing.isLoading && (
                <Card className="design-studio-glass"><CardContent className="py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-muted-foreground">Loading live market data...</p>
                </CardContent></Card>
            )}

            {categories.length === 0 && !livePricing.isLoading && (
                <Card className="design-studio-glass"><CardContent className="py-12 text-center">
                    <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No approved benchmark data available for this finish level.</p>
                    <p className="text-xs text-muted-foreground mt-2">Run the market ingestion pipeline and approve benchmark proposals to see live pricing here.</p>
                </CardContent></Card>
            )}

            {categories.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categories.map(([category, pricing]: [string, any]) => (
                        <Card key={category} className="design-studio-glass hover:border-primary/30 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm capitalize flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                    {category.replace(/_/g, " ")}
                                </CardTitle>
                                <Badge variant="outline" className="text-xs w-fit">
                                    {pricing.sampleSize} data points • {(pricing.confidence * 100).toFixed(0)}% confidence
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-muted/30 rounded p-2">
                                        <p className="text-xs text-muted-foreground">P25 (Low)</p>
                                        <p className="text-sm font-bold text-green-600">AED {Math.round(pricing.p25).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-primary/5 rounded p-2 ring-1 ring-primary/20">
                                        <p className="text-xs text-muted-foreground">Weighted Mean</p>
                                        <p className="text-sm font-bold text-primary">AED {Math.round(pricing.weightedMean).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-muted/30 rounded p-2">
                                        <p className="text-xs text-muted-foreground">P75 (High)</p>
                                        <p className="text-sm font-bold text-orange-600">AED {Math.round(pricing.p75).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Unit: {pricing.unit}</span>
                                    <Badge className="text-xs bg-green-500/10 text-green-600">Market-Verified ✓</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Total Market Estimate */}
            {categories.length > 0 && (
                <Card className="design-studio-glass border-primary/20">
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold">Total Market Composite (all categories)</p>
                                <p className="text-xs text-muted-foreground">Sum of weighted means across all available categories</p>
                            </div>
                            <p className="text-2xl font-bold text-primary">
                                AED {Math.round(categories.reduce((sum, [, p]: [string, any]) => sum + p.weightedMean, 0)).toLocaleString()}/sqm
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
