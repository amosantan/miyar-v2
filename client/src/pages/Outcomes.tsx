import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, Plus, BarChart3, BookOpen, Lightbulb } from "lucide-react";

export default function Outcomes() {
  const [, params] = useRoute("/projects/:id/outcomes");
  const projectId = Number(params?.id);

  const [showCapture, setShowCapture] = useState(false);
  const [costKey, setCostKey] = useState("");
  const [costVal, setCostVal] = useState("");
  const [costEntries, setCostEntries] = useState<Record<string, number>>({});
  const [leadKey, setLeadKey] = useState("");
  const [leadVal, setLeadVal] = useState("");
  const [leadEntries, setLeadEntries] = useState<Record<string, number>>({});
  const [rfqKey, setRfqKey] = useState("");
  const [rfqVal, setRfqVal] = useState("");
  const [rfqEntries, setRfqEntries] = useState<Record<string, number>>({});

  const outcomes = trpc.intelligence.outcomes.list.useQuery({ projectId }, { enabled: !!projectId });
  const utils = trpc.useUtils();

  const captureMut = trpc.intelligence.outcomes.capture.useMutation({
    onSuccess: () => {
      toast.success("Outcome captured");
      setShowCapture(false);
      setCostEntries({});
      setLeadEntries({});
      setRfqEntries({});
      utils.intelligence.outcomes.list.invalidate();
    },
    onError: () => toast.error("Failed to capture outcome"),
  });

  const outcomeList = outcomes.data ?? [];

  const addEntry = (
    key: string,
    val: string,
    entries: Record<string, number>,
    setEntries: (v: Record<string, number>) => void,
    setKey: (v: string) => void,
    setVal: (v: string) => void
  ) => {
    if (!key || !val) return;
    setEntries({ ...entries, [key]: parseFloat(val) });
    setKey("");
    setVal("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-amber-500" /> Outcomes & Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Capture real-world outcomes and compare against MIYAR predictions
          </p>
        </div>
        <Button onClick={() => setShowCapture(!showCapture)}>
          <Plus className="h-4 w-4 mr-2" /> Capture Outcome
        </Button>
      </div>

      {/* Capture Form */}
      {showCapture && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Capture Outcome</CardTitle>
            <CardDescription>Record actual procurement costs, lead times, and RFQ results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Procurement Costs */}
            <div>
              <p className="text-sm font-medium mb-2">Procurement Actual Costs (AED)</p>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Item (e.g. flooring)" value={costKey} onChange={(e) => setCostKey(e.target.value)} className="flex-1" />
                <Input type="number" placeholder="Cost" value={costVal} onChange={(e) => setCostVal(e.target.value)} className="w-32" />
                <Button size="sm" variant="outline" onClick={() => addEntry(costKey, costVal, costEntries, setCostEntries, setCostKey, setCostVal)}>Add</Button>
              </div>
              {Object.keys(costEntries).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(costEntries).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="cursor-pointer" onClick={() => {
                      const copy = { ...costEntries };
                      delete copy[k];
                      setCostEntries(copy);
                    }}>
                      {k}: {v.toLocaleString()} AED ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Lead Times */}
            <div>
              <p className="text-sm font-medium mb-2">Actual Lead Times (days)</p>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Item" value={leadKey} onChange={(e) => setLeadKey(e.target.value)} className="flex-1" />
                <Input type="number" placeholder="Days" value={leadVal} onChange={(e) => setLeadVal(e.target.value)} className="w-32" />
                <Button size="sm" variant="outline" onClick={() => addEntry(leadKey, leadVal, leadEntries, setLeadEntries, setLeadKey, setLeadVal)}>Add</Button>
              </div>
              {Object.keys(leadEntries).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(leadEntries).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="cursor-pointer" onClick={() => {
                      const copy = { ...leadEntries };
                      delete copy[k];
                      setLeadEntries(copy);
                    }}>
                      {k}: {v} days ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* RFQ Results */}
            <div>
              <p className="text-sm font-medium mb-2">RFQ Results</p>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Metric (e.g. rounds)" value={rfqKey} onChange={(e) => setRfqKey(e.target.value)} className="flex-1" />
                <Input type="number" placeholder="Value" value={rfqVal} onChange={(e) => setRfqVal(e.target.value)} className="w-32" />
                <Button size="sm" variant="outline" onClick={() => addEntry(rfqKey, rfqVal, rfqEntries, setRfqEntries, setRfqKey, setRfqVal)}>Add</Button>
              </div>
              {Object.keys(rfqEntries).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(rfqEntries).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="cursor-pointer" onClick={() => {
                      const copy = { ...rfqEntries };
                      delete copy[k];
                      setRfqEntries(copy);
                    }}>
                      {k}: {v} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={() =>
                captureMut.mutate({
                  projectId,
                  procurementActualCosts: Object.keys(costEntries).length > 0 ? costEntries : undefined,
                  leadTimesActual: Object.keys(leadEntries).length > 0 ? leadEntries : undefined,
                  rfqResults: Object.keys(rfqEntries).length > 0 ? rfqEntries : undefined,
                })
              }
              disabled={captureMut.isPending || (Object.keys(costEntries).length === 0 && Object.keys(leadEntries).length === 0 && Object.keys(rfqEntries).length === 0)}
            >
              Save Outcome
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Outcomes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Captured Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outcomeList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No outcomes captured yet. Click "Capture Outcome" to record real-world results.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Procurement Costs</TableHead>
                  <TableHead>Lead Times</TableHead>
                  <TableHead>RFQ Results</TableHead>
                  <TableHead>Captured</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outcomeList.map((o) => {
                  const costs = (o.procurementActualCosts as Record<string, number>) ?? {};
                  const leads = (o.leadTimesActual as Record<string, number>) ?? {};
                  const rfqs = (o.rfqResults as Record<string, number>) ?? {};
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{o.id}</TableCell>
                      <TableCell>
                        {Object.keys(costs).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(costs).map(([k, v]) => (
                              <p key={k} className="text-xs">{k}: {Number(v).toLocaleString()} AED</p>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {Object.keys(leads).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(leads).map(([k, v]) => (
                              <p key={k} className="text-xs">{k}: {v} days</p>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {Object.keys(rfqs).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(rfqs).map(([k, v]) => (
                              <p key={k} className="text-xs">{k}: {v}</p>
                            ))}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(o.capturedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
