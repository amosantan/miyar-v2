import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  HelpCircle,
  Loader2,
  Ruler,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { putSignedMedia } from "@/lib/direct-media-upload";
import { useTranslation } from "@/lib/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Point = { x: string; y: string };
type PreviewRoom = {
  spaceId?: string;
  roomName?: string;
  areaSqm?: number | string;
  status?: string;
  sourceOuterRing?: Point[];
  normalizedOuterRing?: Point[];
};
type PreviewResult = {
  status?: string;
  fingerprint?: string | { value?: string };
  totalAreaSqm?: number | string;
  rooms?: PreviewRoom[];
  sourceOuterRing?: Point[];
  normalizedOuterRing?: Point[];
  warnings?: string[];
  insufficiencies?: string[];
};

const COPY = {
  en: {
    title: "Room geometry — shadow mode",
    description:
      "Preview a room boundary without changing GFA, MQI, scoring, reports, or shares.",
    shadow: "Shadow only",
    legacyNotice:
      "Legacy areas remain authoritative. A preview or committed candidate never silently replaces them.",
    manual: "Manual boundary",
    dxf: "DXF file",
    roomName: "Room name",
    level: "Level elevation",
    points: "Boundary points",
    pointsHelp:
      "One x,y coordinate per line. The boundary is closed automatically.",
    units: "Source units",
    chooseUnits: "Choose metres or millimetres",
    snapping: "Apply explicit 1 mm snap",
    preview: "Preview geometry",
    uploadPreview: "Upload and preview DXF",
    chooseDxf: "Choose ASCII DXF",
    noFile: "No file selected",
    commit: "Commit shadow candidate",
    commitHelp:
      "This stores a candidate and comparison evidence. Legacy numbers stay in control.",
    comparison: "Authority and comparison",
    noCandidate: "No shadow candidate has been committed.",
    legacyArea: "Legacy area",
    candidateArea: "Candidate room-floor area",
    delta: "Difference",
    fingerprint: "Fingerprint",
    overlay: "Source vs normalized boundary",
    source: "Source",
    normalized: "Normalized",
    accepted: "Accept candidate",
    rejected: "Reject candidate",
    clarification: "Request clarification",
    note: "Review note (optional)",
    reviewHelp: "Only organization admins can record a review decision.",
    readOnly:
      "You have read-only access. Geometry previews and candidate changes are unavailable.",
    conflict: "Conflict",
    not_checked: "Not checked",
    insufficient: "Insufficient information",
    legacy_estimate: "Legacy estimate",
    ready: "Ready for shadow commit",
    measured: "Measured",
    user_entered: "User-entered",
    imported: "Imported",
    estimated: "Estimated",
    unknown: "Not checked",
    invalidPoints: "Enter at least three valid x,y points.",
    invalidUnits: "Choose the units declared by the source.",
    invalidLevel: "Enter a valid level elevation.",
    invalidFile: "Choose an ASCII .dxf file no larger than 10 MiB.",
    previewReady: "Geometry preview is ready. Review it before committing.",
    committed:
      "Shadow geometry candidate committed. Legacy numbers remain unchanged.",
    reviewed: "Review decision recorded.",
    comparisonConflict:
      "Canonical room-floor area differs from the legacy estimate beyond tolerance.",
    comparisonWithinTolerance:
      "Canonical room-floor area is within the comparison tolerance.",
    comparisonUnavailable:
      "A comparable legacy room-area basis is unavailable; no equivalence claim was made.",
  },
  ar: {
    title: "هندسة الغرف — وضع الظل",
    description:
      "عاين حدود الغرفة دون تغيير المساحة الإجمالية أو MQI أو التقييم أو التقارير أو المشاركات.",
    shadow: "ظل فقط",
    legacyNotice:
      "تبقى المساحات القديمة هي المعتمدة. لا تستبدل المعاينة أو المرشح المحفوظ هذه القيم تلقائياً.",
    manual: "حدود يدوية",
    dxf: "ملف DXF",
    roomName: "اسم الغرفة",
    level: "ارتفاع الطابق",
    points: "نقاط الحدود",
    pointsHelp: "إحداثي x,y واحد في كل سطر. تُغلق الحدود تلقائياً.",
    units: "وحدة المصدر",
    chooseUnits: "اختر المتر أو المليمتر",
    snapping: "تطبيق محاذاة صريحة بمقدار 1 مم",
    preview: "معاينة الهندسة",
    uploadPreview: "رفع ومعاينة DXF",
    chooseDxf: "اختر ملف DXF نصياً",
    noFile: "لم يتم اختيار ملف",
    commit: "حفظ مرشح الظل",
    commitHelp:
      "يحفظ هذا مرشحاً ودليل مقارنة، وتبقى القيم القديمة هي المعتمدة.",
    comparison: "الاعتماد والمقارنة",
    noCandidate: "لم يُحفظ أي مرشح ظل بعد.",
    legacyArea: "المساحة القديمة",
    candidateArea: "مساحة أرضية الغرفة المرشحة",
    delta: "الفرق",
    fingerprint: "البصمة",
    overlay: "حدود المصدر مقابل الحدود المطبّعة",
    source: "المصدر",
    normalized: "المطبّعة",
    accepted: "قبول المرشح",
    rejected: "رفض المرشح",
    clarification: "طلب توضيح",
    note: "ملاحظة المراجعة (اختيارية)",
    reviewHelp: "يمكن لمسؤولي المؤسسة فقط تسجيل قرار المراجعة.",
    readOnly:
      "لديك صلاحية القراءة فقط. معاينات الهندسة وتغييرات المرشح غير متاحة.",
    conflict: "تعارض",
    not_checked: "لم يتم التحقق",
    insufficient: "معلومات غير كافية",
    legacy_estimate: "تقدير قديم",
    ready: "جاهز للحفظ في وضع الظل",
    measured: "مقاس",
    user_entered: "مدخل من المستخدم",
    imported: "مستورد",
    estimated: "تقديري",
    unknown: "لم يتم التحقق",
    invalidPoints: "أدخل ثلاث نقاط x,y صالحة على الأقل.",
    invalidUnits: "اختر الوحدة المعلنة في المصدر.",
    invalidLevel: "أدخل ارتفاع طابق صالحاً.",
    invalidFile: "اختر ملف ASCII DXF لا يزيد حجمه عن 10 ميبيبايت.",
    previewReady: "المعاينة جاهزة. راجعها قبل الحفظ.",
    committed: "تم حفظ مرشح هندسة الظل. لم تتغير القيم القديمة.",
    reviewed: "تم تسجيل قرار المراجعة.",
    comparisonConflict:
      "تختلف مساحة أرضية الغرفة المعيارية عن التقدير القديم بما يتجاوز حد التفاوت.",
    comparisonWithinTolerance:
      "تقع مساحة أرضية الغرفة المعيارية ضمن حد تفاوت المقارنة.",
    comparisonUnavailable:
      "لا يتوفر أساس قديم قابل للمقارنة لمساحة الغرفة، لذلك لم تُقدَّم أي مطالبة بالتكافؤ.",
  },
} as const;

type CopyKey = keyof typeof COPY.en;

function makeSpaceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parsePoints(value: string): Point[] | null {
  const parts = value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.split(",").map(part => part.trim()));
  if (parts.some(point => point.length !== 2)) return null;
  const points = parts.map(([x, y]) => ({ x, y }));

  if (
    points.length < 3 ||
    points.some(
      ({ x, y }) =>
        !x || !y || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))
    )
  ) {
    return null;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return first.x === last.x && first.y === last.y ? points : [...points, first];
}

function numericArea(value: unknown): string {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²`
    : "—";
}

function StatusBadge({
  status,
  label,
}: {
  status?: string;
  label: (key: CopyKey) => string;
}) {
  const key = (status || "not_checked") as CopyKey;
  const warning = status === "conflict" || status === "insufficient";
  const positive =
    status === "ready" || status === "measured" || status === "accepted";
  return (
    <Badge
      variant="outline"
      className={
        warning
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : positive
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-border text-muted-foreground"
      }
    >
      {label(key in COPY.en ? key : "unknown")}
    </Badge>
  );
}

function BoundaryOverlay({
  source,
  normalized,
  title,
  sourceLabel,
  normalizedLabel,
}: {
  source?: Point[];
  normalized?: Point[];
  title: string;
  sourceLabel: string;
  normalizedLabel: string;
}) {
  const paths = useMemo(() => {
    const all = [...(source || []), ...(normalized || [])]
      .map(({ x, y }) => ({ x: Number(x), y: Number(y) }))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
    if (all.length < 3) return null;
    const minX = Math.min(...all.map(point => point.x));
    const maxX = Math.max(...all.map(point => point.x));
    const minY = Math.min(...all.map(point => point.y));
    const maxY = Math.max(...all.map(point => point.y));
    const scale = Math.min(
      280 / Math.max(maxX - minX, 1),
      160 / Math.max(maxY - minY, 1)
    );
    const toPath = (ring?: Point[]) =>
      (ring || [])
        .map(({ x, y }, index) => {
          const px = 10 + (Number(x) - minX) * scale;
          const py = 170 - (Number(y) - minY) * scale;
          return `${index === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
        })
        .join(" ") + (ring?.length ? " Z" : "");
    return { source: toPath(source), normalized: toPath(normalized) };
  }, [normalized, source]);

  if (!paths) return null;
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-secondary/10 p-3">
      <p className="mb-2 text-xs font-medium">{title}</p>
      <svg
        viewBox="0 0 300 180"
        role="img"
        aria-label={title}
        className="h-auto max-h-52 w-full overflow-visible"
      >
        {paths.source && (
          <path
            d={paths.source}
            fill="rgb(59 130 246 / 0.08)"
            stroke="rgb(96 165 250)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
        {paths.normalized && (
          <path
            d={paths.normalized}
            fill="rgb(16 185 129 / 0.08)"
            stroke="rgb(52 211 153)"
            strokeWidth="2"
          />
        )}
      </svg>
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-blue-400" />
          {sourceLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-emerald-400" />
          {normalizedLabel}
        </span>
      </div>
    </div>
  );
}

export default function GeometryShadowPanel({
  projectId,
}: {
  projectId: number;
}) {
  const { locale, dir } = useTranslation();
  const copy = COPY[locale];
  const text = (key: CopyKey) => copy[key];
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const [sourceUnit, setSourceUnit] = useState<"" | "m" | "mm">("");
  const [snap, setSnap] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [levelElevation, setLevelElevation] = useState("0");
  const [pointsText, setPointsText] = useState("0,0\n4,0\n4,3\n0,3");
  const [spaceId, setSpaceId] = useState(makeSpaceId);
  const [dxfFile, setDxfFile] = useState<File | null>(null);
  const [dxfAssetId, setDxfAssetId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewSource, setPreviewSource] = useState<"manual" | "dxf" | null>(
    null
  );
  const [reviewNote, setReviewNote] = useState("");

  // These additive routes are kept behind one boundary while DI-01 lands so this
  // component does not leak staged response details into the existing editor.
  const geometryApi = trpc.spaceProgram as any;
  const geometryDesignApi = trpc.design as any;
  const geometryUtils = utils.spaceProgram as any;
  const comparisonQuery = geometryApi.getGeometryComparison.useQuery({
    projectId,
  }) as {
    data?: {
      authorityMode?: string;
      currentGraphVersionId?: number | null;
      canWrite?: boolean;
      canReview?: boolean;
      legacy?: { totalAreaSqm?: number | string; status?: string };
      candidate?: {
        geometryVersionId?: number;
        status?: string;
        evidenceStatus?: string;
        totalAreaSqm?: number | string;
        rooms?: PreviewRoom[];
      };
      reconciliation?: {
        status?: string;
        deltaSqm?: number | string;
        deltaPercent?: number | string;
        message?: string;
      };
    };
    isLoading: boolean;
  };
  const comparison = comparisonQuery.data;

  useEffect(() => {
    const persistedSpaceId = comparison?.candidate?.rooms?.[0]?.spaceId;
    if (persistedSpaceId && !preview) setSpaceId(persistedSpaceId);
  }, [comparison?.candidate?.geometryVersionId, preview]);
  const createUpload =
    geometryDesignApi.createGeometrySourceUpload.useMutation();
  const finalizeUpload =
    geometryDesignApi.finalizeGeometrySourceUpload.useMutation();
  const previewManual = geometryApi.previewManualGeometry.useMutation();
  const previewDxf = geometryApi.previewDxfGeometry.useMutation();
  const commit = geometryApi.commitShadowGeometry.useMutation();
  const review = geometryApi.reviewGeometryCandidate.useMutation();
  const pending =
    createUpload.isPending ||
    finalizeUpload.isPending ||
    previewManual.isPending ||
    previewDxf.isPending;

  const manualRooms = () => {
    const outerRing = parsePoints(pointsText);
    if (!outerRing) return null;
    return [
      {
        spaceId,
        roomName: roomName.trim() || undefined,
        levelElevation,
        outerRing,
      },
    ];
  };

  const handleManualPreview = async () => {
    const rooms = manualRooms();
    if (!rooms) return toast.error(text("invalidPoints"));
    if (sourceUnit !== "m" && sourceUnit !== "mm")
      return toast.error(text("invalidUnits"));
    if (!levelElevation.trim() || !Number.isFinite(Number(levelElevation)))
      return toast.error(text("invalidLevel"));
    try {
      const result = await previewManual.mutateAsync({
        projectId,
        sourceUnit,
        snapTransform: snap ? "1mm" : "none",
        rooms,
      });
      setPreview(result as PreviewResult);
      setPreviewSource("manual");
      toast.success(text("previewReady"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDxfPreview = async () => {
    if (sourceUnit !== "m" && sourceUnit !== "mm")
      return toast.error(text("invalidUnits"));
    if (!levelElevation.trim() || !Number.isFinite(Number(levelElevation)))
      return toast.error(text("invalidLevel"));
    if (
      !dxfFile ||
      !dxfFile.name.toLowerCase().endsWith(".dxf") ||
      dxfFile.size > 10 * 1024 * 1024
    ) {
      return toast.error(text("invalidFile"));
    }
    try {
      const mimeType = dxfFile.type || "application/dxf";
      const upload = await createUpload.mutateAsync({
        projectId,
        filename: dxfFile.name,
        mimeType,
        sizeBytes: dxfFile.size,
      });
      const uploadFile = dxfFile.type
        ? dxfFile
        : new File([dxfFile], dxfFile.name, { type: mimeType });
      await putSignedMedia(upload.uploadUrl, uploadFile);
      const finalized = await finalizeUpload.mutateAsync({
        projectId,
        storageKey: upload.storageKey,
        filename: dxfFile.name,
        mimeType,
      });
      setDxfAssetId(finalized.assetId);
      const result = await previewDxf.mutateAsync({
        projectId,
        assetId: finalized.assetId,
        sourceUnit,
        snapTransform: snap ? "1mm" : "none",
        levelElevation,
      });
      setPreview(result as PreviewResult);
      setPreviewSource("dxf");
      toast.success(text("previewReady"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCommit = async () => {
    if (!previewSource || !preview) return;
    if (sourceUnit !== "m" && sourceUnit !== "mm")
      return toast.error(text("invalidUnits"));
    const rooms = manualRooms();
    if (previewSource === "manual" && !rooms)
      return toast.error(text("invalidPoints"));
    if (
      previewSource === "manual" &&
      (!levelElevation.trim() || !Number.isFinite(Number(levelElevation)))
    )
      return toast.error(text("invalidLevel"));
    if (previewSource === "dxf" && !dxfAssetId)
      return toast.error(text("invalidFile"));
    try {
      await commit.mutateAsync({
        projectId,
        expectedCurrentVersionId: comparison?.currentGraphVersionId ?? null,
        source:
          previewSource === "manual"
            ? {
                kind: "manual" as const,
                rooms: rooms!,
                sourceUnit,
                snapTransform: snap ? ("1mm" as const) : ("none" as const),
              }
            : {
                kind: "dxf" as const,
                assetId: dxfAssetId!,
                sourceUnit,
                snapTransform: snap ? ("1mm" as const) : ("none" as const),
                levelElevation,
              },
      });
      setPreview(null);
      setPreviewSource(null);
      await geometryUtils.getGeometryComparison.invalidate({ projectId });
      toast.success(text("committed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleReview = async (
    decision: "accepted" | "rejected" | "clarification_requested"
  ) => {
    if (!comparison?.candidate?.geometryVersionId) return;
    try {
      await review.mutateAsync({
        projectId,
        geometryVersionId: comparison.candidate.geometryVersionId,
        expectedCurrentVersionId: comparison.currentGraphVersionId ?? null,
        decision,
        note: reviewNote.trim() || undefined,
      });
      setReviewNote("");
      await geometryUtils.getGeometryComparison.invalidate({ projectId });
      toast.success(text("reviewed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const previewRoom = preview?.rooms?.[0];
  const previewOverlayRooms: PreviewRoom[] = preview?.rooms?.length
    ? preview.rooms
    : preview
      ? [
          {
            sourceOuterRing: preview.sourceOuterRing,
            normalizedOuterRing: preview.normalizedOuterRing,
          },
        ]
      : [];
  const previewBlocked = preview?.status === "insufficient";

  return (
    <Card dir={dir} className="min-w-0 overflow-hidden border-sky-500/25">
      <CardHeader className="gap-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="h-4 w-4 shrink-0 text-sky-400" />
              {text("title")}
            </CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {text("description")}
            </p>
          </div>
          <Badge className="shrink-0 bg-sky-500/15 text-sky-300 hover:bg-sky-500/15">
            {text("shadow")}
          </Badge>
        </div>
        <Alert className="border-sky-500/25 bg-sky-500/5">
          <ShieldCheck className="text-sky-400" />
          <AlertTitle>{text("legacy_estimate")}</AlertTitle>
          <AlertDescription>{text("legacyNotice")}</AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        {comparison?.canWrite ? (
          <Tabs
            defaultValue="manual"
            onValueChange={() => {
              setPreview(null);
              setPreviewSource(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="manual">{text("manual")}</TabsTrigger>
              <TabsTrigger value="dxf">{text("dxf")}</TabsTrigger>
            </TabsList>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`geometry-unit-${projectId}`}>
                  {text("units")}
                </Label>
                <select
                  id={`geometry-unit-${projectId}`}
                  value={sourceUnit}
                  onChange={event => {
                    setSourceUnit(event.target.value as "" | "m" | "mm");
                    setPreview(null);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  <option value="" disabled>
                    {text("chooseUnits")}
                  </option>
                  <option value="m">m</option>
                  <option value="mm">mm</option>
                </select>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                <Label
                  htmlFor={`geometry-snap-${projectId}`}
                  className="min-w-0 text-xs leading-5"
                >
                  {text("snapping")}
                </Label>
                <Switch
                  id={`geometry-snap-${projectId}`}
                  checked={snap}
                  onCheckedChange={checked => {
                    setSnap(checked);
                    setPreview(null);
                  }}
                />
              </div>
            </div>
            <TabsContent value="manual" className="min-w-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`geometry-room-${projectId}`}>
                    {text("roomName")}
                  </Label>
                  <Input
                    id={`geometry-room-${projectId}`}
                    value={roomName}
                    onChange={event => {
                      setRoomName(event.target.value);
                      setPreview(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`geometry-level-${projectId}`}>
                    {text("level")}
                  </Label>
                  <Input
                    id={`geometry-level-${projectId}`}
                    inputMode="decimal"
                    value={levelElevation}
                    onChange={event => {
                      setLevelElevation(event.target.value);
                      setPreview(null);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`geometry-points-${projectId}`}>
                  {text("points")}
                </Label>
                <Textarea
                  id={`geometry-points-${projectId}`}
                  dir="ltr"
                  className="min-h-28 resize-y font-mono"
                  value={pointsText}
                  onChange={event => {
                    setPointsText(event.target.value);
                    setPreview(null);
                  }}
                  aria-describedby={`geometry-points-help-${projectId}`}
                />
                <p
                  id={`geometry-points-help-${projectId}`}
                  className="text-xs text-muted-foreground"
                >
                  {text("pointsHelp")}
                </p>
              </div>
              <Button
                onClick={handleManualPreview}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                {previewManual.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Ruler />
                )}
                {text("preview")}
              </Button>
            </TabsContent>
            <TabsContent value="dxf" className="min-w-0 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`geometry-dxf-level-${projectId}`}>
                  {text("level")}
                </Label>
                <Input
                  id={`geometry-dxf-level-${projectId}`}
                  inputMode="decimal"
                  value={levelElevation}
                  onChange={event => {
                    setLevelElevation(event.target.value);
                    setPreview(null);
                  }}
                />
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".dxf,application/dxf,text/plain"
                className="hidden"
                onChange={event => {
                  setDxfFile(event.target.files?.[0] || null);
                  setDxfAssetId(null);
                  setPreview(null);
                }}
              />
              <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {dxfFile?.name || text("noFile")}
                  </p>
                  {dxfFile && (
                    <p className="text-xs text-muted-foreground">
                      {(dxfFile.size / 1024).toFixed(1)} KiB
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  className="shrink-0"
                >
                  <FileUp />
                  {text("chooseDxf")}
                </Button>
              </div>
              <Button
                onClick={handleDxfPreview}
                disabled={pending || !dxfFile}
                className="w-full sm:w-auto"
              >
                {pending ? <Loader2 className="animate-spin" /> : <FileUp />}
                {text("uploadPreview")}
              </Button>
            </TabsContent>
          </Tabs>
        ) : !comparisonQuery.isLoading ? (
          <Alert>
            <ShieldCheck />
            <AlertDescription>{text("readOnly")}</AlertDescription>
          </Alert>
        ) : null}

        {comparison?.canWrite && preview && (
          <section
            aria-live="polite"
            className="min-w-0 space-y-3 rounded-lg border border-border/70 p-3 sm:p-4"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <StatusBadge
                status={preview.status || "not_checked"}
                label={text}
              />
              <span className="text-sm font-semibold">
                {numericArea(preview.totalAreaSqm ?? previewRoom?.areaSqm)}
              </span>
            </div>
            {(preview.insufficiencies || []).map((message, index) => (
              <Alert key={`insufficient-${index}`} variant="destructive">
                <AlertCircle />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ))}
            {(preview.warnings || []).map((message, index) => (
              <Alert
                key={`warning-${index}`}
                className="border-amber-500/30 bg-amber-500/5"
              >
                <HelpCircle className="text-amber-400" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ))}
            {previewOverlayRooms.map((room, index) => (
              <BoundaryOverlay
                key={room.spaceId ?? `preview-room-${index}`}
                source={room.sourceOuterRing ?? preview.sourceOuterRing}
                normalized={
                  room.normalizedOuterRing ?? preview.normalizedOuterRing
                }
                title={
                  room.roomName
                    ? `${text("overlay")} — ${room.roomName}`
                    : text("overlay")
                }
                sourceLabel={text("source")}
                normalizedLabel={text("normalized")}
              />
            ))}
            {preview.fingerprint && (
              <p
                dir="ltr"
                className="break-all font-mono text-[10px] text-muted-foreground"
              >
                {text("fingerprint")}:{" "}
                {typeof preview.fingerprint === "string"
                  ? preview.fingerprint
                  : preview.fingerprint.value}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-foreground">
                {text("commitHelp")}
              </p>
              <Button
                onClick={handleCommit}
                disabled={commit.isPending || previewBlocked}
                className="shrink-0"
              >
                {commit.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}
                {text("commit")}
              </Button>
            </div>
          </section>
        )}

        <section className="min-w-0 space-y-3 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{text("comparison")}</h3>
            <StatusBadge
              status={
                comparison?.reconciliation?.status ||
                comparison?.candidate?.status ||
                "not_checked"
              }
              label={text}
            />
          </div>
          {comparisonQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <div className="min-w-0 rounded-md bg-secondary/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {text("legacyArea")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {numericArea(comparison?.legacy?.totalAreaSqm)}
                </p>
                <StatusBadge
                  status={comparison?.legacy?.status || "legacy_estimate"}
                  label={text}
                />
              </div>
              <div className="min-w-0 rounded-md bg-secondary/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {text("candidateArea")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {numericArea(comparison?.candidate?.totalAreaSqm)}
                </p>
                {comparison?.candidate ? (
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge
                      status={comparison.candidate.status}
                      label={text}
                    />
                    <StatusBadge
                      status={comparison.candidate.evidenceStatus}
                      label={text}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text("noCandidate")}
                  </p>
                )}
              </div>
              <div className="min-w-0 rounded-md bg-secondary/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {text("delta")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {numericArea(comparison?.reconciliation?.deltaSqm)}
                </p>
                {comparison?.reconciliation?.deltaPercent != null && (
                  <p className="text-xs text-muted-foreground">
                    {Number(comparison.reconciliation.deltaPercent).toFixed(2)}%
                  </p>
                )}
              </div>
            </div>
          )}
          {comparison?.reconciliation?.message && (
            <p className="break-words text-xs text-muted-foreground">
              {comparison.reconciliation.status === "conflict"
                ? text("comparisonConflict")
                : comparison.reconciliation.status === "ready"
                  ? text("comparisonWithinTolerance")
                  : text("comparisonUnavailable")}
            </p>
          )}

          {comparison?.candidate?.rooms?.map((room, index) => (
            <BoundaryOverlay
              key={room.spaceId ?? `candidate-room-${index}`}
              source={room.sourceOuterRing}
              normalized={room.normalizedOuterRing}
              title={text("overlay")}
              sourceLabel={text("source")}
              normalizedLabel={text("normalized")}
            />
          ))}

          {comparison?.canReview && comparison.candidate && (
            <div className="min-w-0 space-y-2 rounded-lg border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">
                {text("reviewHelp")}
              </p>
              <Textarea
                value={reviewNote}
                onChange={event => setReviewNote(event.target.value)}
                placeholder={text("note")}
                className="min-h-16 resize-y"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  size="sm"
                  onClick={() => handleReview("accepted")}
                  disabled={review.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 />
                  {text("accepted")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReview("rejected")}
                  disabled={review.isPending}
                >
                  <XCircle />
                  {text("rejected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReview("clarification_requested")}
                  disabled={review.isPending}
                >
                  <HelpCircle />
                  {text("clarification")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
