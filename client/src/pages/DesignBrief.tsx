import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileText, Palette, Package, DollarSign, Truck, CheckSquare, RefreshCw, History, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function DesignBrief() {
  const [, params] = useRoute("/projects/:id/brief");
  const projectId = Number(params?.id);

  const latestBrief = trpc.design.getLatestBrief.useQuery({ projectId }, { enabled: !!projectId });
  const allBriefs = trpc.design.listBriefs.useQuery({ projectId }, { enabled: !!projectId });

  const generateMutation = trpc.design.generateBrief.useMutation({
    onSuccess: () => {
      toast.success("Design brief generated", { description: "New version created" });
      latestBrief.refetch();
      allBriefs.refetch();
    },
    onError: (err) => toast.error("Generation failed", { description: err.message }),
  });

  const brief = latestBrief.data;
  const identity = brief?.projectIdentity as any;
  const styleMood = brief?.styleMood as any;
  const materialGuidance = brief?.materialGuidance as any;
  const budgetGuardrails = brief?.budgetGuardrails as any;
  const procurement = brief?.procurementConstraints as any;
  const deliverables = brief?.deliverablesChecklist as any;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Design Brief</h2>
          <p className="text-muted-foreground">
            {brief ? `Version ${brief.version} — Generated from MIYAR evaluation` : "Generate a structured design brief from project evaluation"}
          </p>
        </div>
        <div className="flex gap-2">
          {allBriefs.data && allBriefs.data.length > 1 && (
            <Badge variant="outline"><History className="mr-1 h-3 w-3" /> {allBriefs.data.length} versions</Badge>
          )}
          <Button onClick={() => generateMutation.mutate({ projectId })} disabled={generateMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {brief ? "Regenerate" : "Generate Brief"}
          </Button>
        </div>
      </div>

      {!brief ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Design Brief Yet</h3>
            <p className="text-muted-foreground mb-4">Generate a 7-section design brief from the project's MIYAR evaluation results.</p>
            <Button onClick={() => generateMutation.mutate({ projectId })} disabled={generateMutation.isPending}>
              Generate Design Brief
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="identity" className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="style">Style & Mood</TabsTrigger>
            <TabsTrigger value="materials">Materials</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="procurement">Procurement</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* Section 1: Project Identity */}
          <TabsContent value="identity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Project Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {identity && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Typology", value: identity.typology },
                      { label: "Scale", value: identity.scale },
                      { label: "GFA", value: identity.gfa ? `${Number(identity.gfa).toLocaleString()} sqft` : "—" },
                      { label: "Location", value: identity.location },
                      { label: "Horizon", value: identity.horizon },
                      { label: "Market Tier", value: identity.marketTier },
                      { label: "Style", value: identity.style },
                    ].map(item => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Positioning Statement</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{brief.positioningStatement}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 2: Style & Mood */}
          <TabsContent value="style" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Style & Mood Direction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {styleMood && (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-2">Primary Style: {styleMood.primaryStyle}</p>
                      <div className="flex gap-2 flex-wrap">
                        {styleMood.moodKeywords?.map((kw: string) => (
                          <Badge key={kw} variant="secondary">{kw}</Badge>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Color Palette</p>
                      <div className="flex gap-2 flex-wrap">
                        {styleMood.colorPalette?.map((c: string) => (
                          <Badge key={c} variant="outline">{c}</Badge>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Texture Direction</p>
                        <p className="text-xs text-muted-foreground">{styleMood.textureDirection}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Lighting Approach</p>
                        <p className="text-xs text-muted-foreground">{styleMood.lightingApproach}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Spatial Philosophy</p>
                        <p className="text-xs text-muted-foreground">{styleMood.spatialPhilosophy}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 3: Material Guidance */}
          <TabsContent value="materials" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Material Guidance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {materialGuidance && (
                  <>
                    <div>
                      <Badge className="mb-2">{materialGuidance.tierRecommendation} Tier</Badge>
                      <p className="text-sm text-muted-foreground">{materialGuidance.qualityBenchmark}</p>
                    </div>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm font-medium mb-2 text-green-600">Primary Materials</p>
                        {materialGuidance.primaryMaterials?.map((m: string) => (
                          <div key={m} className="flex items-center gap-1 text-sm"><ChevronRight className="h-3 w-3" />{m}</div>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2 text-blue-600">Accent Materials</p>
                        {materialGuidance.accentMaterials?.map((m: string) => (
                          <div key={m} className="flex items-center gap-1 text-sm"><ChevronRight className="h-3 w-3" />{m}</div>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2 text-red-600">Avoid</p>
                        {materialGuidance.avoidMaterials?.map((m: string) => (
                          <div key={m} className="flex items-center gap-1 text-sm"><ChevronRight className="h-3 w-3" />{m}</div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <p className="text-sm"><span className="font-medium">Sustainability:</span> {materialGuidance.sustainabilityNotes}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 4: Budget Guardrails */}
          <TabsContent value="budget" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Budget Guardrails</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {budgetGuardrails && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Cost Target</p>
                        <p className="font-medium">{budgetGuardrails.costPerSqftTarget}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cost Band</p>
                        <p className="font-medium">{budgetGuardrails.costBand}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Contingency</p>
                        <p className="font-medium">{budgetGuardrails.contingencyRecommendation}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Flexibility Level</p>
                      <p className="text-sm text-muted-foreground">{budgetGuardrails.flexibilityLevel}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Value Engineering Notes</p>
                      {budgetGuardrails.valueEngineeringNotes?.map((note: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                          <ChevronRight className="h-3 w-3 mt-1 shrink-0" />{note}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 5: Procurement Constraints */}
          <TabsContent value="procurement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Procurement Constraints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {procurement && (
                  <>
                    <div>
                      <p className="text-sm font-medium mb-1">Lead Time Window</p>
                      <p className="text-sm text-muted-foreground">{procurement.leadTimeWindow}</p>
                    </div>
                    <Separator />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium mb-2">Critical Path Items</p>
                        {procurement.criticalPathItems?.map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                            <ChevronRight className="h-3 w-3 mt-1 shrink-0" />{item}
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Import Dependencies</p>
                        {procurement.importDependencies?.map((dep: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                            <ChevronRight className="h-3 w-3 mt-1 shrink-0" />{dep}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-2">Risk Mitigations</p>
                      {procurement.riskMitigations?.map((m: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                          <ChevronRight className="h-3 w-3 mt-1 shrink-0" />{m}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 6: Deliverables Checklist */}
          <TabsContent value="deliverables" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Deliverables Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deliverables && (
                  <>
                    {[
                      { label: "Phase 1 — Concept", items: deliverables.phase1 },
                      { label: "Phase 2 — Development", items: deliverables.phase2 },
                      { label: "Phase 3 — Execution", items: deliverables.phase3 },
                    ].map(phase => (
                      <div key={phase.label}>
                        <p className="text-sm font-medium mb-2">{phase.label}</p>
                        {phase.items?.map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <div className="h-4 w-4 rounded border border-muted-foreground/30" />
                            {item}
                          </div>
                        ))}
                        <Separator className="my-3" />
                      </div>
                    ))}
                    <div>
                      <p className="text-sm font-medium mb-2">Quality Gates</p>
                      {deliverables.qualityGates?.map((gate: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Badge variant="outline" className="text-xs">Gate {i + 1}</Badge>
                          {gate}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 7: Full Summary */}
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Complete Design Brief — v{brief.version}</CardTitle>
                <CardDescription>Full summary of all sections for export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-sm">
                {identity && (
                  <div>
                    <h4 className="font-semibold mb-1">1. Project Identity</h4>
                    <p className="text-muted-foreground">{identity.projectName} — {identity.typology}, {identity.marketTier}, {identity.style} style, {identity.location}</p>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold mb-1">2. Positioning</h4>
                  <p className="text-muted-foreground">{brief.positioningStatement}</p>
                </div>
                {styleMood && (
                  <div>
                    <h4 className="font-semibold mb-1">3. Style & Mood</h4>
                    <p className="text-muted-foreground">{styleMood.primaryStyle} — {styleMood.moodKeywords?.join(", ")}</p>
                  </div>
                )}
                {materialGuidance && (
                  <div>
                    <h4 className="font-semibold mb-1">4. Material Guidance</h4>
                    <p className="text-muted-foreground">{materialGuidance.tierRecommendation}: {materialGuidance.primaryMaterials?.join(", ")}</p>
                  </div>
                )}
                {budgetGuardrails && (
                  <div>
                    <h4 className="font-semibold mb-1">5. Budget Guardrails</h4>
                    <p className="text-muted-foreground">{budgetGuardrails.costPerSqftTarget} ({budgetGuardrails.costBand}), {budgetGuardrails.contingencyRecommendation}</p>
                  </div>
                )}
                {procurement && (
                  <div>
                    <h4 className="font-semibold mb-1">6. Procurement</h4>
                    <p className="text-muted-foreground">{procurement.leadTimeWindow}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
