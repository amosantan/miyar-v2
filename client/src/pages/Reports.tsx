import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Download,
  PlusCircle,
  Loader2,
  Clock,
  FileBarChart,
  FilePen,
  FileCheck,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const REPORT_TYPES = [
  {
    value: "validation_summary",
    label: "Validation Summary",
    icon: FileCheck,
    desc: "Concise decision outcome with key scores and risk flags",
  },
  {
    value: "design_brief",
    label: "Design Brief",
    icon: FilePen,
    desc: "Detailed design direction analysis with recommendations",
  },
  {
    value: "full_report",
    label: "Full Report",
    icon: FileBarChart,
    desc: "Comprehensive report with all dimensions, scenarios, and ROI",
  },
];

function ReportsContent() {
  const { data: projects } = trpc.project.list.useQuery();
  const evaluatedProjects = useMemo(
    () => projects?.filter((p) => p.status === "evaluated") ?? [],
    [projects]
  );
  const [selectedId, setSelectedId] = useState<string>("");
  const projectId = selectedId ? Number(selectedId) : evaluatedProjects[0]?.id;

  const { data: reports, isLoading } = trpc.project.listReports.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const generateReport = trpc.project.generateReport.useMutation();
  const utils = trpc.useUtils();

  const [reportType, setReportType] = useState("validation_summary");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function handleGenerate() {
    if (!projectId) return;
    try {
      await generateReport.mutateAsync({
        projectId,
        reportType: reportType as any,
      });
      utils.project.listReports.invalidate({ projectId });
      toast.success("Report generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and download validation reports
          </p>
        </div>
        {evaluatedProjects.length > 0 && (
          <Select
            value={selectedId || String(evaluatedProjects[0]?.id ?? "")}
            onValueChange={setSelectedId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {evaluatedProjects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!projectId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select an evaluated project to generate reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Generate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => setReportType(rt.value)}
                    className={`text-left p-4 rounded-lg border transition-all ${
                      reportType === rt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <rt.icon
                      className={`h-5 w-5 mb-2 ${
                        reportType === rt.value
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-sm font-medium text-foreground">
                      {rt.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rt.desc}
                    </p>
                  </button>
                ))}
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateReport.isPending}
                className="gap-2"
              >
                {generateReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {generateReport.isPending ? "Generating..." : "Generate Report"}
              </Button>
            </CardContent>
          </Card>

          {/* Report List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-muted/50 animate-pulse"
                    />
                  ))}
                </div>
              ) : !reports || reports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No reports generated yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {reports.map((r: any) => (
                    <div key={r.id}>
                      <div
                        className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedId(expandedId === r.id ? null : r.id)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {r.reportType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(r.generatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {expandedId === r.id && r.content && (
                        <div className="mt-2 p-4 rounded-lg bg-secondary/20 border border-border">
                          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                            {typeof r.content === "string"
                              ? r.content
                              : JSON.stringify(r.content, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <DashboardLayout>
      <ReportsContent />
    </DashboardLayout>
  );
}
