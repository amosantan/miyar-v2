import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FileText, Palette, Package, DollarSign, Truck, CheckSquare, RefreshCw, History, ChevronRight, Download, LayoutGrid, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatAiOperationError, withReference } from "@/lib/ai-operation-error";
import { ReportLocaleSelect } from "@/components/ReportLocaleSelect";
import { useTranslation } from "@/lib/i18n";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function textValue(record: JsonRecord | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function numberValue(record: JsonRecord | null, key: string): number {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nullableNumberValue(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(record: JsonRecord | null, key: string): boolean {
  return record?.[key] === true;
}

function stringList(record: JsonRecord | null, key: string): string[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordList(record: JsonRecord | null, key: string): JsonRecord[] {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is JsonRecord => item !== null)
    : [];
}

export default function DesignBrief() {
  const [, params] = useRoute("/projects/:id/brief");
  const [, setLocation] = useLocation();
  const projectId = Number(params?.id);
  const { locale: appLocale } = useTranslation();
  const [reportLocale, setReportLocale] = useState(appLocale);

  const latestBrief = trpc.design.getLatestBrief.useQuery({ projectId }, { enabled: !!projectId });
  const allBriefs = trpc.design.listBriefs.useQuery({ projectId }, { enabled: !!projectId });
  const scores = trpc.project.getScores.useQuery({ projectId }, { enabled: !!projectId });
  const hasEvaluation = Boolean(scores.data?.length);

  const generateMutation = trpc.design.generateBrief.useMutation({
    onSuccess: () => {
      toast.success("Design brief generated", { description: "New version created" });
      latestBrief.refetch();
      allBriefs.refetch();
    },
    onError: (err) => {
      if (err.data?.code === "PRECONDITION_FAILED") {
        toast.error("Evaluation required", {
          description: "Evaluate this project before generating its design brief.",
        });
        return;
      }
      toast.error("Generation failed", { description: withReference(formatAiOperationError(err, "We could not generate the design brief. Please try again.")) });
    },
  });

  const exportDocxMut = trpc.design.exportBriefDocx.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("DOCX exported successfully");
      }
    },
    onError: () => toast.error("Failed to export DOCX"),
  });

  const brief = latestBrief.data;
  const identityRaw = asRecord(brief?.projectIdentity);
  const narrativeRaw = asRecord(brief?.designNarrative);
  const materialsRaw = asRecord(brief?.materialSpecifications);
  const budgetRaw = asRecord(brief?.detailedBudget);
  const instructionsRaw = asRecord(brief?.designerInstructions);
  const procurementRaw = asRecord(instructionsRaw?.procurementAndLogistics);
  const phasesRaw = asRecord(instructionsRaw?.phasedDeliverables);

  const identity = identityRaw && {
    projectName: textValue(identityRaw, "projectName"), typology: textValue(identityRaw, "typology"),
    scale: textValue(identityRaw, "scale"), gfa: numberValue(identityRaw, "gfa"),
    location: textValue(identityRaw, "location"), horizon: textValue(identityRaw, "horizon"),
    marketTier: textValue(identityRaw, "marketTier"), style: textValue(identityRaw, "style"),
  };
  const styleMood = narrativeRaw && {
    positioningStatement: textValue(narrativeRaw, "positioningStatement"),
    primaryStyle: textValue(narrativeRaw, "primaryStyle"), moodKeywords: stringList(narrativeRaw, "moodKeywords"),
    colorPalette: stringList(narrativeRaw, "colorPalette"), textureDirection: textValue(narrativeRaw, "textureDirection"),
    lightingApproach: textValue(narrativeRaw, "lightingApproach"), spatialPhilosophy: textValue(narrativeRaw, "spatialPhilosophy"),
  };
  const materialGuidance = materialsRaw && {
    tierRecommendation: textValue(materialsRaw, "tierRequirement"), qualityBenchmark: textValue(materialsRaw, "qualityBenchmark"),
    primaryMaterials: stringList(materialsRaw, "approvedMaterials"), accentMaterials: stringList(materialsRaw, "finishesAndTextures"),
    avoidMaterials: stringList(materialsRaw, "prohibitedMaterials"), sustainabilityNotes: textValue(materialsRaw, "sustainabilityMandate"),
  };
  const budgetGuardrails = budgetRaw && {
    costPerSqftTarget: textValue(budgetRaw, "costPerSqmTarget"), costBand: textValue(budgetRaw, "costBand"),
    contingencyRecommendation: textValue(budgetRaw, "contingencyRecommendation"), flexibilityLevel: textValue(budgetRaw, "flexibilityLevel"),
    valueEngineeringNotes: stringList(budgetRaw, "valueEngineeringMandates"),
  };
  const procurement = procurementRaw && {
    leadTimeWindow: textValue(procurementRaw, "leadTimeWindow"), criticalPathItems: stringList(procurementRaw, "criticalPathItems"),
    importDependencies: stringList(procurementRaw, "importDependencies"), riskMitigations: stringList(instructionsRaw, "coordinationRequirements"),
  };
  const deliverables = phasesRaw && {
    phase1: stringList(phasesRaw, "conceptDesign"), phase2: stringList(phasesRaw, "schematicDesign"),
    phase3: stringList(phasesRaw, "detailedDesign"), qualityGates: stringList(instructionsRaw, "authorityApprovals"),
  };

  const spaceRaw = asRecord(budgetRaw?.spaceAllocation);
  const spaceAllocation = spaceRaw && {
    efficiencyScore: numberValue(spaceRaw, "efficiencyScore"), totalArea: numberValue(spaceRaw, "totalArea"),
    roomCount: numberValue(spaceRaw, "roomCount"), circulationPct: numberValue(spaceRaw, "circulationPct"),
    rooms: recordList(spaceRaw, "rooms").map((room) => ({
      name: textValue(room, "name"), pctOfTotal: numberValue(room, "pctOfTotal"), finishGrade: textValue(room, "finishGrade"),
    })),
    recommendations: recordList(spaceRaw, "recommendations").map((item) => ({
      severity: textValue(item, "severity"), advice: textValue(item, "advice"),
    })),
  };
  const mqiRaw = asRecord(budgetRaw?.mqiSummary);
  const mqiSummary = mqiRaw && {
    totalFinishCostMin: nullableNumberValue(mqiRaw, "totalFinishCostMin"), totalFinishCostMid: nullableNumberValue(mqiRaw, "totalFinishCostMid"),
    totalFinishCostMax: nullableNumberValue(mqiRaw, "totalFinishCostMax"), qualityLabel: textValue(mqiRaw, "qualityLabel"),
    costBasisLabel: textValue(mqiRaw, "costBasisLabel"), unpricedAllocationCount: numberValue(mqiRaw, "unpricedAllocationCount"),
    budgetUtilizationPct: typeof mqiRaw.budgetUtilizationPct === "number" ? mqiRaw.budgetUtilizationPct : null,
    isOverBudget: booleanValue(mqiRaw, "isOverBudget"), overBudgetByAed: numberValue(mqiRaw, "overBudgetByAed"),
    roomBreakdown: recordList(mqiRaw, "roomBreakdown").map((room) => ({
      roomName: textValue(room, "roomName"), roomCostMin: nullableNumberValue(room, "roomCostMin"), roomCostMax: nullableNumberValue(room, "roomCostMax"),
    })),
    topMaterials: recordList(mqiRaw, "topMaterials").map((material) => ({
      materialName: textValue(material, "materialName"), totalAreaM2: numberValue(material, "totalAreaM2"),
      pctOfTotalSurface: numberValue(material, "pctOfTotalSurface"),
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Design Brief</h2>
          <p className="text-muted-foreground">
            {brief ? `Version ${brief.version} — Generated from MIYAR evaluation` : "Generate a structured design brief from project evaluation"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {allBriefs.data && allBriefs.data.length > 1 && (
            <Badge variant="outline"><History className="mr-1 h-3 w-3" /> {allBriefs.data.length} versions</Badge>
          )}
          {brief && (
            <Button
              variant="outline"
              onClick={() => exportDocxMut.mutate({ briefId: brief.id, locale: reportLocale })}
              disabled={exportDocxMut.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {exportDocxMut.isPending ? "Exporting..." : "Export DOCX"}
            </Button>
          )}
          <ReportLocaleSelect value={reportLocale} onValueChange={setReportLocale} />
          <Button onClick={() => generateMutation.mutate({ projectId, locale: reportLocale })} disabled={generateMutation.isPending || scores.isLoading || !hasEvaluation}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {brief ? "Regenerate" : hasEvaluation ? "Generate Brief" : "Evaluate Project First"}
          </Button>
        </div>
      </div>

      {!brief ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Design Brief Yet</h3>
            <p className="text-muted-foreground mb-4">{hasEvaluation ? "Generate a 7-section design brief from the project's MIYAR evaluation results." : "This project must be evaluated before MIYAR can generate a design brief."}</p>
            {hasEvaluation ? (
              <Button onClick={() => generateMutation.mutate({ projectId, locale: reportLocale })} disabled={generateMutation.isPending}>
                Generate Design Brief
              </Button>
            ) : (
              <Button onClick={() => setLocation(`/projects/${projectId}?section=decision`)}>
                Go to Project Evaluation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="identity" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto">
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
                  <p className="text-sm text-muted-foreground leading-relaxed">{styleMood?.positioningStatement}</p>
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

            {/* Phase 9: Space Allocation (if available) */}
            {spaceAllocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><LayoutGrid className="h-5 w-5" /> Space Allocation Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Efficiency Score</p>
                      <p className="font-medium text-lg">{spaceAllocation.efficiencyScore}/100</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Area</p>
                      <p className="font-medium">{spaceAllocation.totalArea?.toLocaleString()} sqft</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Rooms</p>
                      <p className="font-medium">{spaceAllocation.roomCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Circulation</p>
                      <p className="font-medium">{spaceAllocation.circulationPct?.toFixed(1)}%</p>
                    </div>
                  </div>
                  {spaceAllocation.rooms?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-sm font-medium mb-2">Room Breakdown</p>
                        {spaceAllocation.rooms.map((room: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="w-32 text-muted-foreground truncate">{room.name}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, (room.pctOfTotal || 0) * 3)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right">{room.pctOfTotal?.toFixed(1)}%</span>
                            <Badge variant="outline" className="text-xs">{room.finishGrade || "—"}</Badge>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {spaceAllocation.recommendations?.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-sm font-medium mb-2">Space-planning Recommendations</p>
                      {spaceAllocation.recommendations.map((rec: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                          <Badge variant="outline" className={`text-xs shrink-0 mt-px ${rec.severity === "critical" ? "border-red-500/40 text-red-400" : "border-amber-500/40 text-amber-400"}`}>
                            {rec.severity}
                          </Badge>
                          <span>{rec.advice}</span>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Phase C: MQI Cost Intelligence (if available) */}
            {mqiSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> MQI Cost Intelligence</CardTitle>
                  <CardDescription>Bottom-up finish costs from material quantity allocations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Finish Cost (Min)</p>
                      <p className="font-medium">{mqiSummary.totalFinishCostMin === null ? "Insufficient" : `AED ${Math.round(mqiSummary.totalFinishCostMin).toLocaleString()}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Finish Cost (Mid)</p>
                      <p className="font-medium text-lg">{mqiSummary.totalFinishCostMid === null ? "Insufficient" : `AED ${Math.round(mqiSummary.totalFinishCostMid).toLocaleString()}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Finish Cost (Max)</p>
                      <p className="font-medium">{mqiSummary.totalFinishCostMax === null ? "Insufficient" : `AED ${Math.round(mqiSummary.totalFinishCostMax).toLocaleString()}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Quality Label</p>
                      <Badge variant="secondary">{mqiSummary.qualityLabel}</Badge>
                    </div>
                  </div>
                  {(mqiSummary.costBasisLabel || mqiSummary.unpricedAllocationCount > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {mqiSummary.costBasisLabel && (
                        <Badge variant="outline" className="text-xs">Basis: {mqiSummary.costBasisLabel}</Badge>
                      )}
                      {mqiSummary.unpricedAllocationCount > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {mqiSummary.unpricedAllocationCount} allocation{mqiSummary.unpricedAllocationCount === 1 ? "" : "s"} unresolved — aggregate total unavailable
                        </span>
                      )}
                    </div>
                  )}
                  {mqiSummary.budgetUtilizationPct != null && (
                    <>
                      <Separator />
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">Budget Utilization</p>
                          <span className={`text-sm font-medium ${mqiSummary.isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                            {mqiSummary.budgetUtilizationPct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${mqiSummary.isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, mqiSummary.budgetUtilizationPct)}%` }}
                          />
                        </div>
                        {mqiSummary.isOverBudget && (
                          <p className="text-xs text-red-400 mt-1">Over budget by AED {Math.round(mqiSummary.overBudgetByAed).toLocaleString()}</p>
                        )}
                      </div>
                    </>
                  )}
                  {mqiSummary.roomBreakdown?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-sm font-medium mb-2">Room Cost Breakdown</p>
                        {mqiSummary.roomBreakdown.map((room: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="w-32 text-muted-foreground truncate">{room.roomName}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-full"
                                style={{ width: `${room.roomCostMax !== null && mqiSummary.totalFinishCostMax
                                  ? Math.min(100, (room.roomCostMax / mqiSummary.totalFinishCostMax) * 100)
                                  : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-40 text-right">
                              {room.roomCostMin === null || room.roomCostMax === null
                                ? "Insufficient"
                                : `AED ${Math.round(room.roomCostMin).toLocaleString()} – ${Math.round(room.roomCostMax).toLocaleString()}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {mqiSummary.topMaterials?.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-sm font-medium mb-2">Top Materials by Coverage</p>
                        {mqiSummary.topMaterials.map((mat: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{mat.materialName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{mat.totalAreaM2?.toFixed(0)} m²</span>
                              <Badge variant="outline" className="text-xs">{mat.pctOfTotalSurface?.toFixed(1)}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
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
                  <p className="text-muted-foreground">{styleMood?.positioningStatement}</p>
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
                {spaceAllocation && (
                  <div>
                    <h4 className="font-semibold mb-1">7. Space Allocation</h4>
                    <p className="text-muted-foreground">Efficiency: {spaceAllocation.efficiencyScore}/100 · {spaceAllocation.roomCount} rooms · {spaceAllocation.circulationPct?.toFixed(1)}% circulation · {spaceAllocation.recommendations?.length || 0} recommendations</p>
                  </div>
                )}
                {mqiSummary && (
                  <div>
                    <h4 className="font-semibold mb-1">8. MQI Cost Intelligence</h4>
                    <p className="text-muted-foreground">Finish cost: {mqiSummary.totalFinishCostMin === null || mqiSummary.totalFinishCostMax === null
                      ? "Insufficient"
                      : `AED ${Math.round(mqiSummary.totalFinishCostMin).toLocaleString()} – ${Math.round(mqiSummary.totalFinishCostMax).toLocaleString()}`} · {mqiSummary.roomBreakdown?.length || 0} rooms · {mqiSummary.qualityLabel}{mqiSummary.budgetUtilizationPct != null ? ` · ${mqiSummary.budgetUtilizationPct.toFixed(0)}% budget utilization` : ''}</p>
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
