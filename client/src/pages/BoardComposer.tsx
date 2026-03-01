import { useState, useMemo, useCallback } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Package, Trash2, FileSpreadsheet, Lightbulb, DollarSign, Clock,
  AlertTriangle, ChevronUp, ChevronDown, FileText, Pencil, Save, X, Download,
} from "lucide-react";
import { toast } from "sonner";

const COST_BANDS = ["Economy", "Mid-Range", "Premium", "Luxury", "Ultra-Luxury", "Custom"];

export default function BoardComposer() {
  const [, params] = useRoute("/projects/:id/boards");
  const projectId = Number(params?.id);

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

  const selectedBoard = trpc.design.getBoard.useQuery(
    { boardId: selectedBoardId! },
    { enabled: !!selectedBoardId }
  );
  const boardSummary = trpc.design.boardSummary.useQuery(
    { boardId: selectedBoardId! },
    { enabled: !!selectedBoardId }
  );

  const createBoardMutation = trpc.design.createBoard.useMutation({
    onSuccess: (result) => {
      toast.success("Board created");
      boards.refetch();
      setSelectedBoardId(result.id);
      setCreateOpen(false);
      setNewBoardName("");
    },
  });

  const addMaterialMutation = trpc.design.addMaterialToBoard.useMutation({
    onSuccess: () => {
      toast.success("Material added");
      selectedBoard.refetch();
      boardSummary.refetch();
    },
  });

  const removeMaterialMutation = trpc.design.removeMaterialFromBoard.useMutation({
    onSuccess: () => {
      toast.success("Material removed");
      selectedBoard.refetch();
      boardSummary.refetch();
    },
  });

  const deleteBoardMutation = trpc.design.deleteBoard.useMutation({
    onSuccess: () => {
      toast.success("Board deleted");
      boards.refetch();
      setSelectedBoardId(null);
    },
  });

  const updateTileMutation = trpc.design.updateBoardTile.useMutation({
    onSuccess: () => {
      toast.success("Tile updated");
      setEditingTileId(null);
      selectedBoard.refetch();
      boardSummary.refetch();
    },
  });

  const reorderMutation = trpc.design.reorderBoardTiles.useMutation({
    onSuccess: () => {
      selectedBoard.refetch();
    },
  });

  const exportPdfMutation = trpc.design.exportBoardPdf.useMutation({
    onSuccess: (result) => {
      if (result.fileUrl) {
        window.open(result.fileUrl, "_blank");
        toast.success("Board PDF exported");
      } else if (result.html) {
        const blob = new Blob([result.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("Board PDF generated (local preview)");
      }
    },
    onError: () => toast.error("Failed to export board PDF"),
  });

  const filteredMaterials = useMemo(() => {
    if (!materials.data) return [];
    if (!materialFilter) return materials.data;
    const lower = materialFilter.toLowerCase();
    return materials.data.filter((m: any) =>
      m.name.toLowerCase().includes(lower) || m.category.toLowerCase().includes(lower)
    );
  }, [materials.data, materialFilter]);

  const startEditing = useCallback((mat: any) => {
    setEditingTileId(mat.boardJoinId);
    setEditForm({
      specNotes: mat.specNotes || "",
      costBandOverride: mat.costBandOverride || "",
      quantity: mat.quantity ? String(mat.quantity) : "",
      unitOfMeasure: mat.unitOfMeasure || "",
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
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === mats.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [mats[idx], mats[swapIdx]] = [mats[swapIdx], mats[idx]];
    const orderedIds = mats.map((m: any) => m.boardJoinId);
    reorderMutation.mutate({ boardId: selectedBoardId!, orderedJoinIds: orderedIds });
  }, [selectedBoard.data, selectedBoardId, reorderMutation]);

  const tierColors: Record<string, string> = {
    economy: "bg-gray-100 text-gray-700",
    mid: "bg-blue-100 text-blue-700",
    premium: "bg-purple-100 text-purple-700",
    luxury: "bg-amber-100 text-amber-700",
    ultra_luxury: "bg-rose-100 text-rose-700",
  };

  const leadColors: Record<string, string> = {
    short: "text-green-600",
    medium: "text-yellow-600",
    long: "text-orange-600",
    critical: "text-red-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Board Composer</h2>
          <p className="text-muted-foreground">Create material boards with cost estimates, spec notes, and RFQ-ready lists</p>
        </div>
        <div className="flex gap-2">
          {selectedBoardId && (
            <Button
              variant="outline"
              onClick={() => exportPdfMutation.mutate({ boardId: selectedBoardId })}
              disabled={exportPdfMutation.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {exportPdfMutation.isPending ? "Exporting..." : "Export PDF"}
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Board</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Material Board</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Board name (e.g., Master Suite Materials)"
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                />
                <div>
                  <p className="text-sm font-medium mb-2">Quick Start: Add Recommended Materials</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {recommended.data?.length || 0} materials recommended based on project tier
                  </p>
                </div>
                <Button
                  onClick={() => createBoardMutation.mutate({
                    projectId,
                    boardName: newBoardName || "Untitled Board",
                    materialIds: recommended.data?.map((m: any) => m.materialId),
                  })}
                  disabled={createBoardMutation.isPending}
                  className="w-full"
                >
                  Create with Recommendations
                </Button>
                <Button
                  variant="outline"
                  onClick={() => createBoardMutation.mutate({ projectId, boardName: newBoardName || "Untitled Board" })}
                  disabled={createBoardMutation.isPending}
                  className="w-full"
                >
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
          <h3 className="text-sm font-medium text-muted-foreground">Boards</h3>
          {boards.data?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No boards yet</p>
              </CardContent>
            </Card>
          )}
          {boards.data?.map((board: any) => (
            <Card
              key={board.id}
              className={`cursor-pointer transition-colors ${selectedBoardId === board.id ? "border-primary" : "hover:border-muted-foreground/30"}`}
              onClick={() => setSelectedBoardId(board.id)}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{board.boardName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(board.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteBoardMutation.mutate({ boardId: board.id }); }}
                  >
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
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Select a board or create a new one</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Card */}
              {boardSummary.data && (
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <Card>
                    <CardContent className="py-3">
                      <p className="text-xs text-muted-foreground">Items</p>
                      <p className="text-xl font-bold">{boardSummary.data.summary.totalItems}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Est. Cost Range</p>
                      <p className="text-sm font-bold">
                        {boardSummary.data.summary.estimatedCostLow.toLocaleString()} — {boardSummary.data.summary.estimatedCostHigh.toLocaleString()} AED
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Longest Lead</p>
                      <p className="text-xl font-bold">{boardSummary.data.summary.longestLeadTimeDays}d</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Critical Items</p>
                      <p className="text-xl font-bold">{boardSummary.data.summary.criticalPathItems.length}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Materials List */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Materials</CardTitle>
                    <Dialog open={addMaterialOpen} onOpenChange={setAddMaterialOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="mr-1 h-3 w-3" /> Add Material</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Add Material to Board</DialogTitle></DialogHeader>
                        <Input
                          placeholder="Search materials..."
                          value={materialFilter}
                          onChange={e => setMaterialFilter(e.target.value)}
                          className="mb-3"
                        />
                        <div className="space-y-2">
                          {filteredMaterials.slice(0, 20).map((mat: any) => (
                            <div key={mat.id} className="flex items-center justify-between p-2 rounded border hover:bg-accent/50">
                              <div>
                                <p className="text-sm font-medium">{mat.name}</p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs">{mat.category}</Badge>
                                  <Badge className={`text-xs ${tierColors[mat.tier] || ""}`}>{mat.tier}</Badge>
                                  {mat.brandStandardApproval && (
                                    <Badge variant="secondary" className="text-xs border-primary/20 text-primary">
                                      {mat.brandStandardApproval}
                                    </Badge>
                                  )}
                                  <span>{mat.typicalCostLow}–{mat.typicalCostHigh} {mat.costUnit}</span>
                                </div>
                              </div>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => {
                                  addMaterialMutation.mutate({ boardId: selectedBoardId!, materialId: mat.id });
                                }}
                              >
                                Add
                              </Button>
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
                                {mat.brandStandardApproval && (
                                  <Badge variant="secondary" className="text-xs border-primary/20 text-primary">
                                    {mat.brandStandardApproval}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {mat.typicalCostLow}–{mat.typicalCostHigh} {mat.costUnit}
                                </span>
                                <span className={`text-xs ${leadColors[mat.leadTimeBand] || ""}`}>
                                  {mat.leadTimeDays}d lead
                                </span>
                                {mat.embodiedCarbon && (
                                  <span className="text-xs text-emerald-600 font-medium">
                                    {mat.embodiedCarbon} kgCO₂e
                                  </span>
                                )}
                                {mat.maintenanceFactor && (
                                  <span className="text-xs text-amber-600 font-medium">
                                    {mat.maintenanceFactor} OPEX
                                  </span>
                                )}
                                {mat.supplierName && (
                                  <span className="text-xs text-muted-foreground">• {mat.supplierName}</span>
                                )}
                                {mat.costBandOverride && (
                                  <Badge variant="secondary" className="text-xs">{mat.costBandOverride}</Badge>
                                )}
                              </div>
                              {mat.specNotes && (
                                <p className="text-xs text-blue-600 mt-1 ml-7 italic">
                                  <FileText className="inline h-3 w-3 mr-1" />
                                  {mat.specNotes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => moveTile("up", mat)}
                                disabled={idx === 0}
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => moveTile("down", mat)}
                                disabled={idx === (selectedBoard.data?.materials?.length ?? 0) - 1}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => startEditing(mat)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                onClick={() => removeMaterialMutation.mutate({ joinId: mat.boardJoinId })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Inline Edit Form */}
                          {editingTileId === mat.boardJoinId && (
                            <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Spec Notes</label>
                                  <Textarea
                                    placeholder="e.g., Calacatta Gold, honed finish, 600x600mm"
                                    value={editForm.specNotes}
                                    onChange={e => setEditForm(f => ({ ...f, specNotes: e.target.value }))}
                                    className="mt-1 text-xs"
                                    rows={2}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Cost Band Override</label>
                                  <Select
                                    value={editForm.costBandOverride || "none"}
                                    onValueChange={v => setEditForm(f => ({ ...f, costBandOverride: v === "none" ? "" : v }))}
                                  >
                                    <SelectTrigger className="mt-1 text-xs">
                                      <SelectValue placeholder="Select cost band" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No override</SelectItem>
                                      {COST_BANDS.map(band => (
                                        <SelectItem key={band} value={band}>{band}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                                  <Input
                                    type="number"
                                    placeholder="e.g., 150"
                                    value={editForm.quantity}
                                    onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                                    className="mt-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Unit</label>
                                  <Input
                                    placeholder="e.g., sqm"
                                    value={editForm.unitOfMeasure}
                                    onChange={e => setEditForm(f => ({ ...f, unitOfMeasure: e.target.value }))}
                                    className="mt-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                                  <Input
                                    placeholder="General notes"
                                    value={editForm.notes}
                                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                    className="mt-1 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingTileId(null)}>
                                  <X className="mr-1 h-3 w-3" /> Cancel
                                </Button>
                                <Button size="sm" onClick={saveEdit} disabled={updateTileMutation.isPending}>
                                  <Save className="mr-1 h-3 w-3" /> Save
                                </Button>
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" /> RFQ-Ready Line Items
                    </CardTitle>
                    <CardDescription>Export-ready procurement schedule</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="py-2 pr-4">#</th>
                            <th className="py-2 pr-4">Material</th>
                            <th className="py-2 pr-4">Category</th>
                            <th className="py-2 pr-4">Est. Cost (AED)</th>
                            <th className="py-2 pr-4">Lead Time</th>
                            <th className="py-2">Supplier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {boardSummary.data.rfqLines.map(line => (
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" /> Recommended Materials
                    </CardTitle>
                    <CardDescription>Based on project tier and evaluation results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 md:grid-cols-2">
                      {recommended.data.map((rec: any) => (
                        <div key={rec.materialId} className="flex items-center justify-between p-2 rounded border">
                          <div>
                            <p className="text-sm font-medium">{rec.name}</p>
                            <p className="text-xs text-muted-foreground">{rec.category} • {rec.tier}</p>
                          </div>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => addMaterialMutation.mutate({ boardId: selectedBoardId!, materialId: rec.materialId })}
                          >
                            Add
                          </Button>
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
