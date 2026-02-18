import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wand2, Image, Loader2, AlertCircle, Sparkles, Palette, Camera } from "lucide-react";
import { toast } from "sonner";

export default function VisualStudio() {
  const [, params] = useRoute("/projects/:id/visuals");
  const projectId = Number(params?.id);

  const [genType, setGenType] = useState<"mood" | "material_board" | "hero">("mood");
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();

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
      </div>

      {/* Generation Controls */}
      <Card>
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
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Prompt Source</label>
              <Select value={useCustom ? "custom" : "template"} onValueChange={(v) => setUseCustom(v === "custom")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Use Template</SelectItem>
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
                  {items.map(visual => {
                    const promptData = visual.promptJson as any;
                    return (
                      <Card key={visual.id} className="overflow-hidden">
                        {visual.status === "completed" && visual.imageAssetId && (
                          <div className="aspect-video bg-muted relative">
                            <img
                              src={(promptData as any)?.url || ""}
                              alt={`${visual.type} visual`}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                        )}
                        {visual.status === "generating" && (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        {visual.status === "failed" && (
                          <div className="aspect-video bg-destructive/5 flex items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                          </div>
                        )}
                        <CardContent className="pt-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {typeIcons[visual.type as keyof typeof typeIcons]}
                              <span className="text-sm font-medium">{typeLabels[visual.type as keyof typeof typeLabels]}</span>
                            </div>
                            <Badge className={statusColors[visual.status]}>{visual.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {promptData?.prompt ? promptData.prompt.slice(0, 80) + "..." : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(visual.createdAt).toLocaleDateString()}
                          </p>
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
    </div>
  );
}
