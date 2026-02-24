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
import { Badge } from "@/components/ui/badge";
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
  ExternalLink,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const REPORT_TYPES = [
  {
    value: "validation_summary",
    label: "Validation Summary",
    icon: FileCheck,
    desc: "Executive Decision Pack with scores, risk flags, 5-Lens defensibility, and conditional actions",
    badge: "Quick",
    badgeColor: "bg-miyar-emerald/20 text-miyar-emerald",
  },
  {
    value: "design_brief",
    label: "Design Brief",
    icon: FilePen,
    desc: "Design Brief + RFQ Pack with variable contributions, sensitivity analysis, and evidence trace",
    badge: "Detailed",
    badgeColor: "bg-miyar-teal/20 text-miyar-teal",
  },
  {
    value: "full_report",
    label: "Full Report",
    icon: FileBarChart,
    desc: "Full Report with ROI narrative engine, 5-Lens framework, evidence trace, and watermarking",
    badge: "Complete",
    badgeColor: "bg-miyar-gold/20 text-miyar-gold",
  },
  {
    value: "autonomous_design_brief",
    label: "Autonomous Design Brief (AI)",
    icon: FileText,
    desc: "AI-Generated Comprehensive Brief synthesizing project data with 5-Lens Evaluation and Logic Matrix",
    badge: "AI-Powered",
    badgeColor: "bg-blue-500/20 text-blue-500",
  }
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
  const [previewId, setPreviewId] = useState<number | null>(null);

  async function handleGenerate() {
    if (!projectId) return;
    try {
      const result = await generateReport.mutateAsync({
        projectId,
        reportType: reportType as any,
      });
      utils.project.listReports.invalidate({ projectId });
      if ((result as any).fileUrl) {
        toast.success("Report generated and uploaded to cloud storage");
      } else {
        toast.success("Report generated (stored locally)");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    }
  }

  function handleView(fileUrl: string) {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }

  function handleDownload(fileUrl: string, reportType: string) {
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `miyar-${reportType}-${Date.now()}.html`;
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, view, and download structured validation reports
          </p>
        </div>
        {evaluatedProjects.length > 0 && (
          <Select
            value={selectedId || String(evaluatedProjects[0]?.id ?? "")}
            onValueChange={setSelectedId}
          >
            <SelectTrigger className="w-[220px]">
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
              Evaluate a project first, then generate reports here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Report Type Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Generate New Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {REPORT_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => setReportType(rt.value)}
                    className={`text-left p-4 rounded-lg border transition-all ${reportType === rt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <rt.icon
                        className={`h-5 w-5 ${reportType === rt.value
                          ? "text-primary"
                          : "text-muted-foreground"
                          }`}
                      />
                      <Badge className={`text-[10px] ${rt.badgeColor} border-0`}>
                        {rt.badge}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {rt.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
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
                {generateReport.isPending
                  ? "Generating & Uploading..."
                  : "Generate Report"}
              </Button>
            </CardContent>
          </Card>

          {/* Report History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Generated Reports
                {reports && reports.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {reports.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-muted/50 animate-pulse"
                    />
                  ))}
                </div>
              ) : !reports || reports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No reports generated yet. Select a type above and click Generate.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r: any) => {
                    const rtDef = REPORT_TYPES.find(
                      (t) => t.value === r.reportType
                    );
                    const Icon = rtDef?.icon || FileText;
                    const isExpanded = previewId === r.id;

                    return (
                      <div key={r.id} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                  {r.reportType
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (c: string) =>
                                      c.toUpperCase()
                                    )}
                                </p>
                                {r.fileUrl && (
                                  <Badge className="bg-miyar-emerald/20 text-miyar-emerald border-0 text-[9px]">
                                    Cloud
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock className="h-3 w-3" />
                                {new Date(r.generatedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.fileUrl && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => handleView(r.fileUrl)}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() =>
                                    handleDownload(r.fileUrl, r.reportType)
                                  }
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={() =>
                                setPreviewId(isExpanded ? null : r.id)
                              }
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Inline Preview */}
                        {isExpanded && (
                          <div className="border-t border-border">
                            {r.fileUrl ? (
                              <iframe
                                src={r.fileUrl}
                                className="w-full h-[600px] bg-white"
                                title={`Report preview: ${r.reportType}`}
                              />
                            ) : r.content?.html ? (
                              <iframe
                                srcDoc={r.content.html}
                                className="w-full h-[600px] bg-white"
                                title={`Report preview: ${r.reportType}`}
                                sandbox="allow-same-origin"
                              />
                            ) : r.content ? (
                              <div className="p-4 bg-secondary/10 max-h-96 overflow-y-auto">
                                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                  {typeof r.content === "string"
                                    ? r.content
                                    : JSON.stringify(r.content, null, 2)}
                                </pre>
                              </div>
                            ) : (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No preview available.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
