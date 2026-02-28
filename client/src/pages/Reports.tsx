
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
  Printer,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import ReportRenderer from "@/components/ReportRenderer";

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

  const handlePrintPdf = useCallback((reportId: number) => {
    const el = document.getElementById(`report-content-${reportId}`);
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups for PDF download"); return; }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
      <meta charset="utf-8">
      <title>MIYAR Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a2e; background: white; font-size: 13px; line-height: 1.6; }
        h2 { font-size: 22px; margin-bottom: 4px; color: #0f0f23; }
        h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 12px; color: #444; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }
        .header { border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; }
        .header p { color: #666; font-size: 12px; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
        .stat-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
        .stat-box .label { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
        .stat-box .value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
        .score-bar { margin-bottom: 8px; }
        .score-bar .bar-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
        .score-bar .bar-track { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .score-bar .bar-fill { height: 100%; border-radius: 4px; background: #0ea5e9; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8f9fa; font-weight: 600; color: #666; font-size: 11px; text-transform: uppercase; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .badge-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .badge-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .badge-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
        .action { display: flex; gap: 10px; padding: 10px; margin-bottom: 6px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e5e7eb; }
        .action-num { width: 20px; height: 20px; background: #0ea5e9; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .param-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .param-box { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
        .param-box .label { font-size: 10px; color: #888; text-transform: uppercase; }
        .param-box .value { font-size: 13px; font-weight: 600; color: #1a1a2e; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style>
      </head><body>
    `);

    // Convert the React-rendered content to print-friendly HTML
    const content = el.innerHTML;
    // Simple transform: replace dark theme classes with print-friendly content
    const printContent = content
      .replace(/text-foreground/g, '')
      .replace(/text-muted-foreground/g, '')
      .replace(/bg-secondary\/[\d]+/g, '')
      .replace(/bg-primary\/[\d]+/g, '');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  }, []);

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
                            {!r.fileUrl && r.content && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => handlePrintPdf(r.id)}
                              >
                                <Printer className="h-3.5 w-3.5" />
                                PDF
                              </Button>
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
                            ) : r.content ? (
                              <div id={`report-content-${r.id}`} className="max-h-[600px] overflow-y-auto">
                                <ReportRenderer content={r.content} reportType={r.reportType} />
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
    <>
      <ReportsContent />
    </>
  );
}
