import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sliders, Play, History, CheckCircle, AlertTriangle } from "lucide-react";

export default function Calibration() {
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");

  const versions = trpc.intelligence.logicVersions.list.useQuery();
  const utils = trpc.useUtils();

  const calibrateQuery = trpc.intelligence.calibrate.useQuery(
    { projectId: projectId ? parseInt(projectId) : 0 },
    { enabled: false }
  );

  const versionList = versions.data ?? [];
  const publishedVersion = versionList.find((v) => v.status === "published");


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sliders className="h-6 w-6 text-orange-500" /> Calibration
        </h1>
        <p className="text-muted-foreground mt-1">
          Run calibration to test how logic changes affect project scores
        </p>
      </div>

      {/* Current Logic Version */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Logic Version</CardTitle>
        </CardHeader>
        <CardContent>
          {publishedVersion ? (
            <div className="flex items-center gap-4">
              <Badge variant="default">{publishedVersion.name}</Badge>
              <span className="text-sm text-muted-foreground">
                Published {new Date(publishedVersion.createdAt).toLocaleDateString()}
              </span>
              <span className="text-sm text-muted-foreground">
                {publishedVersion.notes}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No published logic version</p>
          )}
        </CardContent>
      </Card>

      {/* Run Calibration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4" /> Run Calibration
          </CardTitle>
          <CardDescription>
            Re-evaluate a specific project (or all projects) against the current published logic version
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Project ID (leave empty for all)</label>
              <Input
                type="number"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. 30002"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Calibration reason" />
            </div>
          </div>
          <Button
            onClick={() => calibrateQuery.refetch()}
            disabled={!projectId || calibrateQuery.isFetching}
          >
            {calibrateQuery.isFetching ? "Running..." : "Run Calibration"}
          </Button>

          {calibrateQuery.data && !("error" in calibrateQuery.data) && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Logic Version</p>
                  <Badge>{calibrateQuery.data.logicVersion.name}</Badge>
                  <Badge variant="secondary" className="ml-2">{calibrateQuery.data.logicVersion.status}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Current Scores</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span>SA: {calibrateQuery.data.currentScores.sa}</span>
                    <span>FF: {calibrateQuery.data.currentScores.ff}</span>
                    <span>MP: {calibrateQuery.data.currentScores.mp}</span>
                    <span>DS: {calibrateQuery.data.currentScores.ds}</span>
                    <span>ER: {calibrateQuery.data.currentScores.er}</span>
                    <span className="font-bold">Composite: {calibrateQuery.data.currentScores.composite}</span>
                  </div>
                </div>
              </div>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Dimension</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrateQuery.data.weights.map((w) => (
                    <TableRow key={w.dimension}>
                      <TableCell className="font-medium uppercase">{w.dimension}</TableCell>
                      <TableCell>{w.weight}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Threshold Rule</TableHead>
                    <TableHead>Comparator</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calibrateQuery.data.thresholds.map((t) => (
                    <TableRow key={t.ruleKey}>
                      <TableCell className="font-mono text-sm">{t.ruleKey}</TableCell>
                      <TableCell>{t.comparator}</TableCell>
                      <TableCell>{t.thresholdValue}</TableCell>
                      <TableCell className="text-muted-foreground">{t.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
          }
          {calibrateQuery.data && "error" in calibrateQuery.data && (
            <p className="text-sm text-red-500 mt-2">{calibrateQuery.data.error as string}</p>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
