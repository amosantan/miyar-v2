
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Building2, Search, Trash2, Edit, ExternalLink, Eye, GitCompare } from "lucide-react";

export default function Competitors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [viewProject, setViewProject] = useState<any>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const { data: entities, isLoading: loadingEntities, refetch: refetchEntities } = trpc.marketIntel.competitors.listEntities.useQuery();
  const { data: projects, isLoading: loadingProjects, refetch: refetchProjects } = trpc.marketIntel.competitors.listProjects.useQuery({
    competitorId: selectedEntity ?? undefined,
  });

  const { data: comparison } = trpc.marketIntel.competitors.compare.useQuery(
    { projectIds: compareIds },
    { enabled: compareIds.length >= 2 }
  );

  const createEntityMutation = trpc.marketIntel.competitors.createEntity.useMutation({
    onSuccess: () => { toast.success("Competitor added"); setShowAddEntity(false); refetchEntities(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteEntityMutation = trpc.marketIntel.competitors.deleteEntity.useMutation({
    onSuccess: () => { toast.success("Competitor deleted"); refetchEntities(); },
    onError: (e) => toast.error(e.message),
  });

  const createProjectMutation = trpc.marketIntel.competitors.createProject.useMutation({
    onSuccess: () => { toast.success("Project added"); setShowAddProject(false); refetchProjects(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteProjectMutation = trpc.marketIntel.competitors.deleteProject.useMutation({
    onSuccess: () => { toast.success("Project deleted"); refetchProjects(); },
    onError: (e) => toast.error(e.message),
  });

  const filteredEntities = (entities ?? []).filter((e: any) =>
    !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCompare = (id: number) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Competitor Intelligence</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track competitor developers and their projects for market positioning context
            </p>
          </div>
          <div className="flex gap-2">
            {compareIds.length >= 2 && (
              <Button variant="outline" onClick={() => setShowCompare(true)}>
                <GitCompare className="h-4 w-4 mr-2" />Compare ({compareIds.length})
              </Button>
            )}
            <Dialog open={showAddEntity} onOpenChange={setShowAddEntity}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Competitor</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add Competitor</DialogTitle></DialogHeader>
                <EntityForm onSubmit={(data) => createEntityMutation.mutate(data)} isLoading={createEntityMutation.isPending} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="entities" className="space-y-4">
          <TabsList>
            <TabsTrigger value="entities">Competitors</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>

          {/* Entities Tab */}
          <TabsContent value="entities" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search competitors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>

            {loadingEntities ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredEntities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No competitors tracked yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredEntities.map((entity: any) => (
                  <Card key={entity.id} className="bg-card/50 hover:bg-card/80 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{entity.name}</h3>
                            {entity.segmentFocus && (
                              <Badge variant="outline" className="text-xs">{entity.segmentFocus}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {entity.headquarters && <span>{entity.headquarters}</span>}
                            {entity.website && (
                              <>
                                <span>·</span>
                                <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                  Website <ExternalLink className="h-3 w-3" />
                                </a>
                              </>
                            )}
                          </div>
                          {entity.notes && <p className="text-xs text-muted-foreground mt-1">{entity.notes}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedEntity(entity.id); }}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Delete "${entity.name}"?`)) deleteEntityMutation.mutate({ id: entity.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedEntity && (
                  <Badge variant="outline" className="text-xs">
                    Filtered: {(entities ?? []).find((e: any) => e.id === selectedEntity)?.name}
                    <button className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => setSelectedEntity(null)}>×</button>
                  </Badge>
                )}
              </div>
              <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Project</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add Competitor Project</DialogTitle></DialogHeader>
                  <ProjectForm
                    entities={entities ?? []}
                    onSubmit={(data) => createProjectMutation.mutate(data)}
                    isLoading={createProjectMutation.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {loadingProjects ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : (projects ?? []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No projects found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {(projects ?? []).map((proj: any) => (
                  <Card key={proj.id} className={`bg-card/50 hover:bg-card/80 transition-colors ${compareIds.includes(proj.id) ? "ring-1 ring-primary" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{proj.projectName}</h3>
                            {proj.segment && <Badge variant="outline" className="text-xs">{proj.segment}</Badge>}
                            {proj.completionStatus && <Badge variant="outline" className="text-xs">{proj.completionStatus}</Badge>}
                            {proj.completenessScore !== null && (
                              <Badge className={`text-xs ${proj.completenessScore >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                {proj.completenessScore}% complete
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {proj.location && <span>{proj.location}</span>}
                            {proj.assetType && <><span>·</span><span>{proj.assetType}</span></>}
                            {proj.totalUnits && <><span>·</span><span>{proj.totalUnits} units</span></>}
                            {proj.architect && <><span>·</span><span>Arch: {proj.architect}</span></>}
                            {proj.interiorDesigner && <><span>·</span><span>ID: {proj.interiorDesigner}</span></>}
                          </div>
                          {proj.positioningKeywords && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(typeof proj.positioningKeywords === "string" ? JSON.parse(proj.positioningKeywords) : proj.positioningKeywords).map((kw: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant={compareIds.includes(proj.id) ? "default" : "ghost"} size="icon" className="h-7 w-7"
                            onClick={() => toggleCompare(proj.id)}>
                            <GitCompare className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewProject(proj)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Delete project "${proj.projectName}"?`)) deleteProjectMutation.mutate({ id: proj.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Project Detail Dialog */}
        <Dialog open={viewProject !== null} onOpenChange={(open) => { if (!open) setViewProject(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewProject?.projectName}</DialogTitle>
            </DialogHeader>
            {viewProject && <ProjectDetail project={viewProject} />}
          </DialogContent>
        </Dialog>

        {/* Comparison Dialog */}
        <Dialog open={showCompare} onOpenChange={setShowCompare}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Competitor Comparison</DialogTitle>
            </DialogHeader>
            {comparison && <ComparisonView data={comparison} />}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function EntityForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({ name: "", headquarters: "", segmentFocus: "", website: "", notes: "" });
  return (
    <div className="space-y-4">
      <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Emaar Properties" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Headquarters</Label><Input value={form.headquarters} onChange={(e) => setForm({ ...form, headquarters: e.target.value })} placeholder="Dubai, UAE" /></div>
        <div><Label>Segment Focus</Label><Input value={form.segmentFocus} onChange={(e) => setForm({ ...form, segmentFocus: e.target.value })} placeholder="Luxury, Mid-market" /></div>
      </div>
      <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <Button onClick={() => { if (!form.name) { toast.error("Name required"); return; } onSubmit(form); }} disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Add Competitor"}
      </Button>
    </div>
  );
}

function ProjectForm({ entities, onSubmit, isLoading }: { entities: any[]; onSubmit: (data: any) => void; isLoading: boolean }) {
  const [form, setForm] = useState({
    competitorId: entities[0]?.id ?? 0,
    projectName: "", location: "", segment: "", assetType: "",
    positioningKeywords: "", interiorStyleSignals: "", materialCues: "",
    amenityList: "", unitMix: "", priceIndicators: "", salesMessaging: "",
    differentiationClaims: "", completionStatus: "under_construction",
    launchDate: "", totalUnits: "", architect: "", interiorDesigner: "",
    sourceUrl: "", evidenceCitations: "",
  });

  const handleSubmit = () => {
    if (!form.projectName || !form.competitorId) { toast.error("Project name and competitor required"); return; }
    const parseArr = (s: string) => s ? s.split(",").map(x => x.trim()).filter(Boolean) : undefined;
    onSubmit({
      ...form,
      competitorId: Number(form.competitorId),
      positioningKeywords: parseArr(form.positioningKeywords),
      interiorStyleSignals: parseArr(form.interiorStyleSignals),
      materialCues: parseArr(form.materialCues),
      amenityList: parseArr(form.amenityList),
      unitMix: form.unitMix || undefined,
      priceIndicators: form.priceIndicators || undefined,
      salesMessaging: form.salesMessaging || undefined,
      differentiationClaims: form.differentiationClaims || undefined,
      totalUnits: form.totalUnits ? Number(form.totalUnits) : undefined,
      launchDate: form.launchDate || undefined,
      evidenceCitations: parseArr(form.evidenceCitations),
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Competitor *</Label>
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.competitorId} onChange={(e) => setForm({ ...form, competitorId: Number(e.target.value) as any })}>
            {entities.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div><Label>Project Name *</Label><Input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Dubai Marina" /></div>
        <div><Label>Segment</Label><Input value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Luxury" /></div>
        <div><Label>Asset Type</Label><Input value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })} placeholder="Residential Tower" /></div>
      </div>
      <div><Label>Positioning Keywords (comma-separated)</Label><Input value={form.positioningKeywords} onChange={(e) => setForm({ ...form, positioningKeywords: e.target.value })} placeholder="waterfront, branded residences, smart home" /></div>
      <div><Label>Interior Style Signals (comma-separated)</Label><Input value={form.interiorStyleSignals} onChange={(e) => setForm({ ...form, interiorStyleSignals: e.target.value })} placeholder="minimalist, contemporary, warm neutral" /></div>
      <div><Label>Material Cues (comma-separated)</Label><Input value={form.materialCues} onChange={(e) => setForm({ ...form, materialCues: e.target.value })} placeholder="marble, engineered wood, matte finishes" /></div>
      <div><Label>Amenity List (comma-separated)</Label><Input value={form.amenityList} onChange={(e) => setForm({ ...form, amenityList: e.target.value })} placeholder="infinity pool, gym, concierge, spa" /></div>
      <div className="grid grid-cols-3 gap-4">
        <div><Label>Total Units</Label><Input type="number" value={form.totalUnits} onChange={(e) => setForm({ ...form, totalUnits: e.target.value })} /></div>
        <div><Label>Architect</Label><Input value={form.architect} onChange={(e) => setForm({ ...form, architect: e.target.value })} /></div>
        <div><Label>Interior Designer</Label><Input value={form.interiorDesigner} onChange={(e) => setForm({ ...form, interiorDesigner: e.target.value })} /></div>
      </div>
      <div><Label>Source URL</Label><Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://..." /></div>
      <div><Label>Price Indicators</Label><Textarea value={form.priceIndicators} onChange={(e) => setForm({ ...form, priceIndicators: e.target.value })} rows={2} placeholder="Starting from AED 1.2M, AED 2,500/sqft" /></div>
      <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
        {isLoading ? "Creating..." : "Add Project"}
      </Button>
    </div>
  );
}

function ProjectDetail({ project }: { project: any }) {
  const parseJson = (v: any) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return [v]; }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div><span className="text-muted-foreground">Location:</span> {project.location || "—"}</div>
        <div><span className="text-muted-foreground">Segment:</span> {project.segment || "—"}</div>
        <div><span className="text-muted-foreground">Asset Type:</span> {project.assetType || "—"}</div>
        <div><span className="text-muted-foreground">Status:</span> {project.completionStatus || "—"}</div>
        <div><span className="text-muted-foreground">Total Units:</span> {project.totalUnits || "—"}</div>
        <div><span className="text-muted-foreground">Launch Date:</span> {project.launchDate || "—"}</div>
        <div><span className="text-muted-foreground">Architect:</span> {project.architect || "—"}</div>
        <div><span className="text-muted-foreground">Interior Designer:</span> {project.interiorDesigner || "—"}</div>
      </div>
      {project.positioningKeywords && (
        <div>
          <h4 className="font-medium mb-1">Positioning Keywords</h4>
          <div className="flex flex-wrap gap-1">{parseJson(project.positioningKeywords).map((k: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{k}</Badge>)}</div>
        </div>
      )}
      {project.interiorStyleSignals && (
        <div>
          <h4 className="font-medium mb-1">Interior Style Signals</h4>
          <div className="flex flex-wrap gap-1">{parseJson(project.interiorStyleSignals).map((k: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{k}</Badge>)}</div>
        </div>
      )}
      {project.materialCues && (
        <div>
          <h4 className="font-medium mb-1">Material Cues</h4>
          <div className="flex flex-wrap gap-1">{parseJson(project.materialCues).map((k: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{k}</Badge>)}</div>
        </div>
      )}
      {project.amenityList && (
        <div>
          <h4 className="font-medium mb-1">Amenities</h4>
          <div className="flex flex-wrap gap-1">{parseJson(project.amenityList).map((k: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{k}</Badge>)}</div>
        </div>
      )}
      {project.salesMessaging && <div><h4 className="font-medium mb-1">Sales Messaging</h4><p className="text-muted-foreground">{project.salesMessaging}</p></div>}
      {project.differentiationClaims && <div><h4 className="font-medium mb-1">Differentiation Claims</h4><p className="text-muted-foreground">{project.differentiationClaims}</p></div>}
      {project.priceIndicators && <div><h4 className="font-medium mb-1">Price Indicators</h4><p className="text-muted-foreground">{project.priceIndicators}</p></div>}
      {project.sourceUrl && (
        <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
          View Source <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ComparisonView({ data }: { data: any }) {
  if (!data || !data.projects || data.projects.length === 0) return <p className="text-muted-foreground">Select at least 2 projects to compare.</p>;

  const parseJson = (v: any) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    try { return JSON.parse(v); } catch { return [v]; }
  };

  const fields = [
    { key: "location", label: "Location" },
    { key: "segment", label: "Segment" },
    { key: "assetType", label: "Asset Type" },
    { key: "completionStatus", label: "Status" },
    { key: "totalUnits", label: "Total Units" },
    { key: "architect", label: "Architect" },
    { key: "interiorDesigner", label: "Interior Designer" },
    { key: "priceIndicators", label: "Price Indicators" },
  ];

  const arrayFields = [
    { key: "positioningKeywords", label: "Positioning" },
    { key: "interiorStyleSignals", label: "Style Signals" },
    { key: "materialCues", label: "Material Cues" },
    { key: "amenityList", label: "Amenities" },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium w-[140px]">Attribute</th>
              {data.projects.map((p: any) => (
                <th key={p.id} className="text-left p-2 font-medium">{p.projectName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map(f => (
              <tr key={f.key} className="border-b border-border/30">
                <td className="p-2 text-muted-foreground">{f.label}</td>
                {data.projects.map((p: any) => (
                  <td key={p.id} className="p-2">{p[f.key] || "—"}</td>
                ))}
              </tr>
            ))}
            {arrayFields.map(f => (
              <tr key={f.key} className="border-b border-border/30">
                <td className="p-2 text-muted-foreground">{f.label}</td>
                {data.projects.map((p: any) => (
                  <td key={p.id} className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {parseJson(p[f.key]).map((v: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Overlap Analysis */}
      {data.overlap && (
        <div className="space-y-2">
          <h4 className="font-medium">Overlap Analysis</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(data.overlap).map(([key, values]: [string, any]) => (
              <div key={key} className="bg-muted/20 rounded-lg p-3">
                <div className="text-muted-foreground mb-1 capitalize">{key.replace(/([A-Z])/g, " $1")}</div>
                <div className="flex flex-wrap gap-1">
                  {(values as string[]).map((v: string, i: number) => (
                    <Badge key={i} className="bg-primary/20 text-primary text-xs">{v}</Badge>
                  ))}
                  {(values as string[]).length === 0 && <span className="text-muted-foreground">No overlap</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
