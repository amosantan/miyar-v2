import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Wand2, Code } from "lucide-react";
import { toast } from "sonner";

export default function PromptTemplates() {
  const [filterType, setFilterType] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "mood" as "mood" | "material_board" | "hero",
    templateText: "",
    variables: "",
  });

  const templates = trpc.design.listPromptTemplates.useQuery({ type: filterType || undefined });

  const createMutation = trpc.design.createPromptTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template created");
      templates.refetch();
      setCreateOpen(false);
    },
    onError: (err) => toast.error("Failed", { description: err.message }),
  });

  const updateMutation = trpc.design.updatePromptTemplate.useMutation({
    onSuccess: () => {
      toast.success("Template updated");
      templates.refetch();
    },
  });

  const typeColors: Record<string, string> = {
    mood: "bg-purple-100 text-purple-700",
    material_board: "bg-blue-100 text-blue-700",
    hero: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prompt Templates</h2>
          <p className="text-muted-foreground">Manage AI image generation prompt templates</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Prompt Template</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Input placeholder="Template name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mood">Mood Board</SelectItem>
                  <SelectItem value="material_board">Material Board</SelectItem>
                  <SelectItem value="hero">Marketing Hero</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Template text with {{variables}}..."
                value={form.templateText}
                onChange={e => setForm(f => ({ ...f, templateText: e.target.value }))}
                rows={5}
              />
              <div>
                <label className="text-xs text-muted-foreground">Variables (comma-separated)</label>
                <Input
                  placeholder="typology, location, style, tier"
                  value={form.variables}
                  onChange={e => setForm(f => ({ ...f, variables: e.target.value }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate({
                  name: form.name,
                  type: form.type,
                  templateText: form.templateText,
                  variables: form.variables.split(",").map(v => v.trim()).filter(Boolean),
                })}
                disabled={!form.name || !form.templateText || createMutation.isPending}
              >
                Create Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Badge variant={!filterType ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterType("")}>All</Badge>
        <Badge variant={filterType === "mood" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterType("mood")}>Mood</Badge>
        <Badge variant={filterType === "material_board" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterType("material_board")}>Material Board</Badge>
        <Badge variant={filterType === "hero" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterType("hero")}>Hero</Badge>
      </div>

      <div className="space-y-3">
        {templates.data?.map(tmpl => {
          const vars = tmpl.variables as string[];
          return (
            <Card key={tmpl.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Wand2 className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{tmpl.name}</span>
                      <Badge className={`text-xs ${typeColors[tmpl.type] || ""}`}>{tmpl.type}</Badge>
                      {tmpl.isActive && <Badge variant="outline" className="text-xs text-green-600">Active</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{tmpl.templateText}</p>
                    <div className="flex gap-1 flex-wrap">
                      <Code className="h-3 w-3 text-muted-foreground mt-0.5" />
                      {vars?.map((v: string) => (
                        <Badge key={v} variant="secondary" className="text-xs font-mono">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={tmpl.isActive ?? false}
                      onCheckedChange={(checked) => updateMutation.mutate({ id: tmpl.id, isActive: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
