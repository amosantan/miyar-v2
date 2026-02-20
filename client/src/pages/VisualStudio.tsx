import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wand2, Image, Loader2, AlertCircle, Sparkles, Palette, Camera, Eye, Clock, Hash } from "lucide-react";
import { toast } from "sonner";

export default function VisualStudio() {
  const [, params] = useRoute("/projects/:id/visuals");
  const projectId = Number(params?.id);

  const [genType, setGenType] = useState<"mood" | "material_board" | "hero">("mood");
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [previewVisual, setPreviewVisual] = useState<any>(null);

  const visuals = trpc.design.listVisuals.useQuery({ projectId }, { enabled: !!projectId });
  const templates = trpc.design.listPromptTemplates.useQuery({ type: genType });

  const generateMutation = trpc.design.generateVisual.useMutation({
    onSuccess: (result) => {
      if (result.status === "completed") {
        toast.success("Visual generated", { description: "Image created and saved to Evidence Vault" });
      } else {
        toast.error("Generation failed", { description: result.error || "Unknown error" });
      }
      visuals.refetch();
    },
    onError: (err) => toast.error("Generation failed", { description: err.message }),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      projectId,
      type: genType,
      customPrompt: useCustom ? customPrompt : undefined,
      templateId: !useCustom ? selectedTemplateId : undefined,
    });
  };

  const typeIcons = {
    mood: <Palette className="h-4 w-4" />,
    material_board: <Sparkles className="h-4 w-4" />,
    hero: <Camera className="h-4 w-4" />,
  };

  const typeLabels = {
    mood: "Mood Board",
    material_board: "Material Board",
    hero: "Marketing Hero",
  };

  const statusColors: Record<string, string> = {
    completed: "bg-green-500/10 text-green-600",
    generating: "bg-yellow-500/10 text-yellow-600",
    pending: "bg-blue-500/10 text-blue-600",
    failed: "bg-red-500/10 text-red-600",
  };

  const moodVisuals = useMemo(() => visuals.data?.filter(v => v.type === "mood") || [], [visuals.data]);
  const boardVisuals = useMemo(() => visuals.data?.filter(v => v.type === "material_board") || [], [visuals.data]);
  const heroVisuals = useMemo(() => visuals.data?.filter(v => v.type === "hero") || [], [visuals.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visual Studio</h2>
          <p className="text-muted-foreground">AI-generated mood boards, material boards, and marketing visuals</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {visuals.data?.length || 0} visuals generated
        </Badge>
      </div>

      {/* Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> Generate Visual</CardTitle>
          <CardDescription>Select a type and template, or write a custom prompt. Templates are resolved from your project context (style, tier, materials, budget).</CardDescription>
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
                    {templates.data?.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {useCustom && (
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe the visual you want to generate..."
              rows={3}
            />
          )}
          <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full md:w-auto">
            {generateMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" /> Generate {typeLabels[genType]}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Visuals Gallery */}
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
                <Card>
                  <CardContent className="py-12 text-center">
                    <Image className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">No visuals generated yet. Use the controls above to create one.</p>
                  </CardContent>
                </Card>
              );
              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((visual: any) => {
                    const promptData = visual.promptJson as any;
                    // V2.3: Use imageUrl from enriched response (joined with project_assets)
                    const imgUrl = visual.imageUrl || promptData?.url || null;
                    return (
                      <Card key={visual.id} className="overflow-hidden group cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                        onClick={() => setPreviewVisual(visual)}>
                        {visual.status === "completed" && imgUrl && (
                          <div className="aspect-video bg-muted relative overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={`${visual.type} visual`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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
                              {typeIcons[visual.type as keyof typeof typeIcons]}
                              <span className="text-sm font-medium">{typeLabels[visual.type as keyof typeof typeLabels]}</span>
                            </div>
                            <Badge className={statusColors[visual.status]}>{visual.status}</Badge>
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
                              {visual.modelVersion || "nano-banana-v1"}
                            </span>
                            {visual.scenarioId && (
                              <Badge variant="outline" className="text-xs">Scenario #{visual.scenarioId}</Badge>
                            )}
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
                  {typeIcons[previewVisual.type as keyof typeof typeIcons]}
                  {typeLabels[previewVisual.type as keyof typeof typeLabels]} — #{previewVisual.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Image Preview */}
                {(() => {
                  const imgUrl = previewVisual.imageUrl || (previewVisual.promptJson as any)?.url;
                  return imgUrl ? (
                    <div className="rounded-lg overflow-hidden bg-muted">
                      <img src={imgUrl} alt="Visual preview" className="w-full h-auto" />
                    </div>
                  ) : null;
                })()}

                {/* Metadata */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <Badge className={statusColors[previewVisual.status]}>{previewVisual.status}</Badge>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Model Version</div>
                    <div className="font-mono text-xs">{previewVisual.modelVersion || "nano-banana-v1"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Created</div>
                    <div>{new Date(previewVisual.createdAt).toLocaleString()}</div>
                  </div>
                  {previewVisual.scenarioId && (
                    <div>
                      <div className="text-xs text-muted-foreground">Scenario</div>
                      <div>#{previewVisual.scenarioId}</div>
                    </div>
                  )}
                </div>

                {/* Prompt Details */}
                {previewVisual.promptJson && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Prompt Used</div>
                    <div className="bg-muted/30 rounded p-3 text-sm border-l-2 border-primary/30 whitespace-pre-wrap">
                      {(previewVisual.promptJson as any).prompt || "—"}
                    </div>
                  </div>
                )}

                {/* Context Variables */}
                {(previewVisual.promptJson as any)?.context && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-medium">Project Context Used</div>
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

                {/* V4-05: Attach to Pack */}
                {previewVisual.status === "completed" && previewVisual.imageAssetId && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast.info("Attach to Pack", { description: "Select a report or brief from the project to attach this visual. Feature coming soon." });
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Attach to Pack
                    </Button>
                    <span className="text-xs text-muted-foreground">Link this visual as an annex to an Executive Decision Pack or Design Brief</span>
                  </div>
                )}

                {/* Error Message */}
                {previewVisual.errorMessage && (
                  <div className="bg-destructive/10 rounded p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {previewVisual.errorMessage}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
