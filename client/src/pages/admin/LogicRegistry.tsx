import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, CheckCircle, Archive, Scale, AlertTriangle, History } from "lucide-react";

export default function LogicRegistry() {
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [weightRationale, setWeightRationale] = useState("");
  const [thresholdRationale, setThresholdRationale] = useState("");

  const versions = trpc.intelligence.logicVersions.list.useQuery();
  const selectedVersion = trpc.intelligence.logicVersions.get.useQuery(
    { id: selectedVersionId! },
    { enabled: !!selectedVersionId }
  );
  const utils = trpc.useUtils();

  const createMut = trpc.intelligence.logicVersions.create.useMutation({
    onSuccess: (data) => {
      toast.success("Logic version created");
      setShowCreate(false);
      setNewName("");
      setNewNotes("");
      utils.intelligence.logicVersions.list.invalidate();
      setSelectedVersionId(data.id);
    },
  });

  const publishMut = trpc.intelligence.logicVersions.publish.useMutation({
    onSuccess: () => {
      toast.success("Logic version published");
      utils.intelligence.logicVersions.list.invalidate();
      utils.intelligence.logicVersions.get.invalidate();
    },
  });

  const archiveMut = trpc.intelligence.logicVersions.archive.useMutation({
    onSuccess: () => {
      toast.success("Logic version archived");
      utils.intelligence.logicVersions.list.invalidate();
      utils.intelligence.logicVersions.get.invalidate();
    },
  });

  const setWeightsMut = trpc.intelligence.logicVersions.setWeights.useMutation({
    onSuccess: () => {
      toast.success("Weights updated");
      utils.intelligence.logicVersions.get.invalidate();
    },
  });

  const setThresholdsMut = trpc.intelligence.logicVersions.setThresholds.useMutation({
    onSuccess: () => {
      toast.success("Thresholds updated");
      utils.intelligence.logicVersions.get.invalidate();
    },
  });

  const [editWeights, setEditWeights] = useState<Record<string, string>>({});
  const [editThresholds, setEditThresholds] = useState<
    Array<{ ruleKey: string; thresholdValue: string; comparator: string; notes: string }>
  >([]);

  const initWeightEdit = () => {
    if (!selectedVersion.data?.weights) return;
    const w: Record<string, string> = {};
    for (const wt of selectedVersion.data.weights) {
      w[wt.dimension] = wt.weight;
    }
    // Ensure all 5 dimensions present
    for (const d of ["sa", "ff", "mp", "ds", "er"]) {
      if (!w[d]) w[d] = "0.20";
    }
    setEditWeights(w);
  };

  const initThresholdEdit = () => {
    if (!selectedVersion.data?.thresholds) return;
    setEditThresholds(
      selectedVersion.data.thresholds.map((t) => ({
        ruleKey: t.ruleKey,
        thresholdValue: t.thresholdValue,
        comparator: t.comparator ?? "gte",
        notes: t.notes ?? "",
      }))
    );
  };

  const versionList = versions.data ?? [];
  const sv = selectedVersion.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" /> Logic Registry
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage scoring logic versions, dimension weights, and decision thresholds
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Version
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Logic Version</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Version name (e.g. v2.1)" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Textarea placeholder="Notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              <Button onClick={() => createMut.mutate({ name: newName, notes: newNotes })} disabled={!newName || createMut.isPending}>
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {versionList.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVersionId(v.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedVersionId === v.id ? "border-blue-500 bg-blue-500/10" : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{v.name}</span>
                  <Badge variant={v.status === "published" ? "default" : v.status === "draft" ? "secondary" : "outline"}>
                    {v.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(v.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
            {versionList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No logic versions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Version Detail */}
        <div className="lg:col-span-2 space-y-4">
          {sv ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{sv.name}</CardTitle>
                      <CardDescription>{sv.notes || "No notes"}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {sv.status === "draft" && (
                        <Button size="sm" onClick={() => publishMut.mutate({ id: sv.id })}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Publish
                        </Button>
                      )}
                      {sv.status !== "archived" && (
                        <Button size="sm" variant="outline" onClick={() => archiveMut.mutate({ id: sv.id })}>
                          <Archive className="h-4 w-4 mr-1" /> Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Tabs defaultValue="weights">
                <TabsList>
                  <TabsTrigger value="weights"><Scale className="h-4 w-4 mr-1" /> Weights</TabsTrigger>
                  <TabsTrigger value="thresholds"><AlertTriangle className="h-4 w-4 mr-1" /> Thresholds</TabsTrigger>
                  <TabsTrigger value="changelog"><History className="h-4 w-4 mr-1" /> Change Log</TabsTrigger>
                </TabsList>

                <TabsContent value="weights">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Dimension Weights</CardTitle>
                        <Button size="sm" variant="outline" onClick={initWeightEdit}>Edit Weights</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(editWeights).length > 0 ? (
                        <div className="space-y-4">
                          {Object.entries(editWeights).map(([dim, w]) => (
                            <div key={dim} className="flex items-center gap-4">
                              <span className="w-24 font-medium uppercase text-sm">{dim}</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={w}
                                onChange={(e) => setEditWeights({ ...editWeights, [dim]: e.target.value })}
                                className="w-32"
                              />
                            </div>
                          ))}
                          <Textarea
                            placeholder="Rationale for weight change..."
                            value={weightRationale}
                            onChange={(e) => setWeightRationale(e.target.value)}
                          />
                          <Button
                            onClick={() => {
                              setWeightsMut.mutate({
                                logicVersionId: sv.id,
                                weights: Object.entries(editWeights).map(([d, w]) => ({ dimension: d, weight: w })),
                                rationale: weightRationale,
                              });
                              setEditWeights({});
                              setWeightRationale("");
                            }}
                            disabled={!weightRationale}
                          >
                            Save Weights
                          </Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Dimension</TableHead>
                              <TableHead>Weight</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(sv.weights ?? []).map((w) => (
                              <TableRow key={w.dimension}>
                                <TableCell className="font-medium uppercase">{w.dimension}</TableCell>
                                <TableCell>{w.weight}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="thresholds">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Decision Thresholds</CardTitle>
                        <Button size="sm" variant="outline" onClick={initThresholdEdit}>Edit Thresholds</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {editThresholds.length > 0 ? (
                        <div className="space-y-4">
                          {editThresholds.map((t, i) => (
                            <div key={i} className="grid grid-cols-4 gap-2 items-center">
                              <Input
                                value={t.ruleKey}
                                onChange={(e) => {
                                  const copy = [...editThresholds];
                                  copy[i] = { ...copy[i], ruleKey: e.target.value };
                                  setEditThresholds(copy);
                                }}
                                placeholder="Rule key"
                              />
                              <Select
                                value={t.comparator}
                                onValueChange={(v) => {
                                  const copy = [...editThresholds];
                                  copy[i] = { ...copy[i], comparator: v };
                                  setEditThresholds(copy);
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gt">&gt;</SelectItem>
                                  <SelectItem value="gte">&gt;=</SelectItem>
                                  <SelectItem value="lt">&lt;</SelectItem>
                                  <SelectItem value="lte">&lt;=</SelectItem>
                                  <SelectItem value="eq">=</SelectItem>
                                  <SelectItem value="neq">!=</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                value={t.thresholdValue}
                                onChange={(e) => {
                                  const copy = [...editThresholds];
                                  copy[i] = { ...copy[i], thresholdValue: e.target.value };
                                  setEditThresholds(copy);
                                }}
                                placeholder="Value"
                              />
                              <Input
                                value={t.notes}
                                onChange={(e) => {
                                  const copy = [...editThresholds];
                                  copy[i] = { ...copy[i], notes: e.target.value };
                                  setEditThresholds(copy);
                                }}
                                placeholder="Notes"
                              />
                            </div>
                          ))}
                          <Textarea
                            placeholder="Rationale for threshold change..."
                            value={thresholdRationale}
                            onChange={(e) => setThresholdRationale(e.target.value)}
                          />
                          <Button
                            onClick={() => {
                              setThresholdsMut.mutate({
                                logicVersionId: sv.id,
                                thresholds: editThresholds.map((t) => ({
                                  ruleKey: t.ruleKey,
                                  thresholdValue: t.thresholdValue,
                                  comparator: t.comparator as "gt" | "gte" | "lt" | "lte" | "eq" | "neq",
                                  notes: t.notes || undefined,
                                })),
                                rationale: thresholdRationale,
                              });
                              setEditThresholds([]);
                              setThresholdRationale("");
                            }}
                            disabled={!thresholdRationale}
                          >
                            Save Thresholds
                          </Button>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rule</TableHead>
                              <TableHead>Comparator</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(sv.thresholds ?? []).map((t) => (
                              <TableRow key={t.ruleKey}>
                                <TableCell className="font-mono text-sm">{t.ruleKey}</TableCell>
                                <TableCell>{t.comparator}</TableCell>
                                <TableCell>{t.thresholdValue}</TableCell>
                                <TableCell className="text-muted-foreground">{t.notes}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="changelog">
                  <Card>
                    <CardContent className="pt-6">
                      {(sv.changeLog ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No changes recorded</p>
                      ) : (
                        <div className="space-y-3">
                          {(sv.changeLog ?? []).map((entry) => (
                            <div key={entry.id} className="border-l-2 border-blue-500 pl-4 py-2">
                              <p className="font-medium text-sm">{entry.changeSummary}</p>
                              <p className="text-sm text-muted-foreground">{entry.rationale}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(entry.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a logic version to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
