import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Link2, Plus, Trash2, FileText, ExternalLink, Shield, Search } from "lucide-react";
import { toast } from "sonner";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 text-emerald-400",
  B: "bg-amber-500/20 text-amber-400",
  C: "bg-red-500/20 text-red-400",
};

const CONF_COLORS: Record<string, string> = {
  public: "bg-green-500/20 text-green-400",
  internal: "bg-blue-500/20 text-blue-400",
  confidential: "bg-amber-500/20 text-amber-400",
  restricted: "bg-red-500/20 text-red-400",
};

const TARGET_TYPES = [
  "scenario", "decision_note", "explainability_driver",
  "design_brief", "report", "material_board", "pack_section",
] as const;

interface Props {
  projectId: number;
}

export function EvidenceReferencesPanel({ projectId }: Props) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<string>("scenario");
  const [sectionLabel, setSectionLabel] = useState("");
  const [citationText, setCitationText] = useState("");

  // Get evidence linked to this project
  const { data: projectEvidence, isLoading: loadingEvidence, refetch: refetchEvidence } =
    trpc.marketIntel.evidence.list.useQuery({ projectId, limit: 200 });

  // Get all evidence references for this project's entities
  const { data: linkedEvidence, isLoading: loadingLinked, refetch: refetchLinked } =
    trpc.marketIntel.evidence.listReferences.useQuery({ targetType: "scenario", targetId: projectId });

  // Get all available evidence for linking
  const { data: allEvidence } = trpc.marketIntel.evidence.list.useQuery({ limit: 500 });

  const addRefMutation = trpc.marketIntel.evidence.addReference.useMutation({
    onSuccess: () => {
      toast.success("Evidence linked successfully");
      refetchLinked();
      setShowLinkDialog(false);
      setSelectedEvidence(null);
      setSectionLabel("");
      setCitationText("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeRefMutation = trpc.marketIntel.evidence.removeReference.useMutation({
    onSuccess: () => {
      toast.success("Reference removed");
      refetchLinked();
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredEvidence = useMemo(() => {
    if (!allEvidence) return [];
    if (!searchTerm) return allEvidence.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return allEvidence.filter((e: any) =>
      (e.title?.toLowerCase().includes(term)) ||
      (e.sourceName?.toLowerCase().includes(term)) ||
      (e.category?.toLowerCase().includes(term)) ||
      (e.metric?.toLowerCase().includes(term))
    ).slice(0, 20);
  }, [allEvidence, searchTerm]);

  const handleLink = () => {
    if (!selectedEvidence) return;
    addRefMutation.mutate({
      evidenceRecordId: selectedEvidence,
      targetType: targetType as any,
      targetId: projectId,
      sectionLabel: sectionLabel || undefined,
      citationText: citationText || undefined,
    });
  };

  if (loadingEvidence || loadingLinked) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const directCount = projectEvidence?.length ?? 0;
  const linkedCount = (linkedEvidence as any[])?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{directCount}</div>
            <div className="text-xs text-muted-foreground">Direct Evidence Records</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{linkedCount}</div>
            <div className="text-xs text-muted-foreground">Cross-Linked References</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center justify-center">
            <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Link Evidence
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Link Evidence to Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Link Type</label>
                    <Select value={targetType} onValueChange={setTargetType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGET_TYPES.map(t => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Search Evidence</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by title, source, category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
                    {filteredEvidence.map((e: any) => (
                      <div
                        key={e.id}
                        className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                          selectedEvidence === e.id
                            ? "bg-primary/20 border border-primary/40"
                            : "hover:bg-secondary/50"
                        }`}
                        onClick={() => setSelectedEvidence(e.id)}
                      >
                        <div className="font-medium truncate">{e.title || e.metric || `Record #${e.id}`}</div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                          <span>{e.sourceName}</span>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${GRADE_COLORS[e.reliabilityGrade] || ""}`}>
                            {e.reliabilityGrade}
                          </Badge>
                          <span>{e.category}</span>
                        </div>
                      </div>
                    ))}
                    {filteredEvidence.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No evidence found</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Section Label (optional)</label>
                    <Input
                      placeholder="e.g., Cost Assumptions, Materials Specification"
                      value={sectionLabel}
                      onChange={(e) => setSectionLabel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Citation Text (optional)</label>
                    <Input
                      placeholder="e.g., RAK Ceramics 2025 catalog, p.42"
                      value={citationText}
                      onChange={(e) => setCitationText(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleLink}
                    disabled={!selectedEvidence || addRefMutation.isPending}
                    className="w-full"
                  >
                    {addRefMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                    Link Evidence
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Direct Evidence */}
      {directCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Direct Evidence ({directCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(projectEvidence as any[])?.slice(0, 10).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${GRADE_COLORS[e.reliabilityGrade] || ""}`}>
                      {e.reliabilityGrade}
                    </Badge>
                    <span className="truncate font-medium">{e.title || e.metric}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{e.sourceName}</span>
                    {e.confidentiality && e.confidentiality !== "public" && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${CONF_COLORS[e.confidentiality] || ""}`}>
                        <Shield className="h-3 w-3 mr-0.5" />{e.confidentiality}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {e.value != null ? `${e.value} ${e.unit || ""}` : "—"}
                  </div>
                </div>
              ))}
              {directCount > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {directCount - 10} more records
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cross-Linked References */}
      {linkedCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Cross-Linked References ({linkedCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(linkedEvidence as any[])?.map((ref: any) => (
                <div key={ref.reference?.id ?? ref.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {(ref.reference?.targetType || "link").replace(/_/g, " ")}
                    </Badge>
                    <span className="truncate font-medium">
                      {ref.evidence?.title || ref.evidence?.metric || `Evidence #${ref.reference?.evidenceRecordId}`}
                    </span>
                    {ref.reference?.sectionLabel && (
                      <span className="text-xs text-muted-foreground">({ref.reference.sectionLabel})</span>
                    )}
                    {ref.reference?.citationText && (
                      <span className="text-xs italic text-muted-foreground truncate max-w-[200px]">
                        "{ref.reference.citationText}"
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => ref.reference?.id && removeRefMutation.mutate({ id: ref.reference.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {directCount === 0 && linkedCount === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No evidence linked to this project yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use the "Link Evidence" button to connect evidence records from the vault.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
