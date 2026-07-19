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
    title: "Canonical room geometry",
    description:
      "Review room-floor boundaries independently from professional GFA and fit-out assumptions.",
    authority: "Canonical workflow",
    legacyNotice:
      "A saved draft is not authoritative. Only an organization admin can approve it as canonical room-floor geometry; GFA and fit-out remain separate inputs.",
    manual: "Manual boundary",
    dxf: "DXF file",
    drawingLineage: "Drawing lineage ID",
    drawingLineageHelp:
      "Reuse this ID for revisions of the same drawing. Use a new ID for an unrelated drawing.",
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
    commit: "Save draft for review",
    commitHelp:
      "This stores an immutable draft. It does not select canonical geometry until an admin approves it.",
    comparison: "Draft and canonical review",
    latestOutcome: "Latest reviewed draft outcome",
    noCandidate: "Canonical room geometry has not been established.",
    legacyArea: "Legacy area — basis unspecified",
    polygonArea: "Room floor polygon area",
    delta: "Cross-basis comparison",
    fingerprint: "Fingerprint",
    overlay: "Source vs normalized boundary",
    source: "Source",
    normalized: "Normalized",
    accepted: "Approve as canonical",
    rejected: "Reject draft",
    clarification: "Request clarification",
    note: "Review note (optional)",
    reviewHelp: "Only organization admins can record a review decision.",
    readOnly:
      "You have read-only access. Geometry previews and draft changes are unavailable.",
    conflict: "Conflict",
    not_checked: "Not checked",
    insufficient: "Insufficient information",
    legacy_estimate: "Separate professional assumptions",
    ready: "Ready to save as draft",
    draft: "Draft awaiting review",
    canonical: "Reviewed canonical geometry",
    needs_clarification: "Clarification required",
    measured: "Geometry-derived",
    user_entered: "User-entered",
    imported: "Imported",
    estimated: "Estimated",
    unknown: "Not checked",
    invalidPoints: "Enter at least three valid x,y points.",
    invalidUnits: "Choose the units declared by the source.",
    invalidLevel: "Enter a valid level elevation.",
    invalidFile: "Choose an ASCII .dxf file no larger than 10 MiB.",
    invalidLineage: "Enter a drawing lineage ID (1–64 characters).",
    previewReady:
      "Geometry preview is ready. Review it before saving the draft.",
    committed: "Geometry draft saved for explicit admin review.",
    reviewed: "Review decision recorded.",
    comparisonConflict:
      "The values use different measurement bases and cannot be compared.",
    comparisonWithinTolerance:
      "The values use the same declared room-floor polygon basis.",
    comparisonUnavailable:
      "Legacy room totals, GFA, and fit-out area do not declare the room-floor polygon basis, so no equivalence claim is made.",
  },
  ar: {
    title: "هندسة الغرف المعيارية",
    description:
      "راجع حدود أرضيات الغرف بشكل مستقل عن افتراضات المساحة الإجمالية والتشطيبات المهنية.",
    authority: "مسار معياري",
    legacyNotice:
      "المسودة المحفوظة ليست معتمدة. يعتمدها مسؤول المؤسسة فقط كهندسة معيارية، بينما تبقى GFA ومساحة التشطيبات مدخلات منفصلة.",
    manual: "حدود يدوية",
    dxf: "ملف DXF",
    drawingLineage: "معرّف سلسلة الرسم",
    drawingLineageHelp:
      "أعد استخدام هذا المعرّف لإصدارات الرسم نفسه، واستخدم معرّفاً جديداً لرسم مستقل.",
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
    commit: "حفظ مسودة للمراجعة",
    commitHelp:
      "يحفظ هذا مسودة ثابتة، ولا تصبح معيارية حتى يعتمدها مسؤول المؤسسة.",
    comparison: "مراجعة المسودة والهندسة المعيارية",
    latestOutcome: "نتيجة آخر مسودة تمت مراجعتها",
    noCandidate: "لم يتم اعتماد هندسة معيارية للغرف بعد.",
    legacyArea: "مساحة قديمة — الأساس غير محدد",
    polygonArea: "مساحة مضلع أرضية الغرفة",
    delta: "مقارنة بين أسس مختلفة",
    fingerprint: "البصمة",
    overlay: "حدود المصدر مقابل الحدود المطبّعة",
    source: "المصدر",
    normalized: "المطبّعة",
    accepted: "اعتمادها كهندسة معيارية",
    rejected: "رفض المسودة",
    clarification: "طلب توضيح",
    note: "ملاحظة المراجعة (اختيارية)",
    reviewHelp: "يمكن لمسؤولي المؤسسة فقط تسجيل قرار المراجعة.",
    readOnly:
      "لديك صلاحية القراءة فقط. معاينات الهندسة وتغييرات المسودة غير متاحة.",
    conflict: "تعارض",
    not_checked: "لم يتم التحقق",
    insufficient: "معلومات غير كافية",
    legacy_estimate: "افتراضات مهنية منفصلة",
    ready: "جاهز للحفظ كمسودة",
    draft: "مسودة بانتظار المراجعة",
    canonical: "هندسة معيارية معتمدة",
    needs_clarification: "مطلوب توضيح",
    measured: "مشتق هندسياً",
    user_entered: "مدخل من المستخدم",
    imported: "مستورد",
    estimated: "تقديري",
    unknown: "لم يتم التحقق",
    invalidPoints: "أدخل ثلاث نقاط x,y صالحة على الأقل.",
    invalidUnits: "اختر الوحدة المعلنة في المصدر.",
    invalidLevel: "أدخل ارتفاع طابق صالحاً.",
    invalidFile: "اختر ملف ASCII DXF لا يزيد حجمه عن 10 ميبيبايت.",
    invalidLineage: "أدخل معرّف سلسلة رسم من 1 إلى 64 حرفاً.",
    previewReady: "المعاينة جاهزة. راجعها قبل الحفظ.",
    committed: "تم حفظ مسودة الهندسة للمراجعة الصريحة من المسؤول.",
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

function makeDrawingLineageId(): string {
  return `drawing-${makeSpaceId()}`.slice(0, 64);
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
    status === "ready" || status === "measured" || status === "canonical";
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

export default function RoomGeometryPanel({
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
  const [sourceLineageId, setSourceLineageId] = useState(
    makeDrawingLineageId
  );
  const [dxfFile, setDxfFile] = useState<File | null>(null);
  const [dxfAssetId, setDxfAssetId] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewSource, setPreviewSource] = useState<"manual" | "dxf" | null>(
    null
  );
  const [reviewNote, setReviewNote] = useState("");

  const reviewQuery = trpc.spaceProgram.getGeometryReviewState.useQuery({
    projectId,
  });
  const reviewState = reviewQuery.data;
  const reviewGeometry =
    reviewState?.draft ?? reviewState?.canonical ?? reviewState?.latestReviewed;

  useEffect(() => {
    const persistedSpaceId = reviewGeometry?.rooms?.[0]?.spaceId;
    if (persistedSpaceId && !preview) setSpaceId(persistedSpaceId);
  }, [reviewGeometry?.geometryVersionId, preview]);
  const createUpload = trpc.design.createGeometrySourceUpload.useMutation();
  const finalizeUpload = trpc.design.finalizeGeometrySourceUpload.useMutation();
  const previewManual = trpc.spaceProgram.previewManualGeometry.useMutation();
  const previewDxf = trpc.spaceProgram.previewDxfGeometry.useMutation();
  const commit = trpc.spaceProgram.saveGeometryDraft.useMutation();
  const review = trpc.spaceProgram.reviewGeometryDraft.useMutation();
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
    if (!sourceLineageId.trim() || sourceLineageId.trim().length > 64)
      return toast.error(text("invalidLineage"));
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
        sourceLineageId: sourceLineageId.trim(),
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
    if (
      previewSource === "dxf" &&
      (!sourceLineageId.trim() || sourceLineageId.trim().length > 64)
    )
      return toast.error(text("invalidLineage"));
    try {
      await commit.mutateAsync({
        projectId,
        expectedCurrentVersionId: reviewState?.currentGraphVersionId ?? null,
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
                sourceLineageId: sourceLineageId.trim(),
                sourceUnit,
                snapTransform: snap ? ("1mm" as const) : ("none" as const),
                levelElevation,
              },
      });
      setPreview(null);
      setPreviewSource(null);
      await utils.spaceProgram.getGeometryReviewState.invalidate({ projectId });
      toast.success(text("committed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleReview = async (
    decision: "approve_as_canonical" | "reject" | "request_clarification"
  ) => {
    if (
      reviewState?.draft?.status !== "draft" ||
      !reviewState.draft.geometryVersionId
    )
      return;
    try {
      await review.mutateAsync({
        projectId,
        geometryVersionId: reviewState.draft.geometryVersionId,
        expectedCurrentVersionId: reviewState.currentGraphVersionId ?? null,
        decision,
        note: reviewNote.trim() || undefined,
      });
      setReviewNote("");
      await utils.spaceProgram.getGeometryReviewState.invalidate({ projectId });
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
  const previewBlocked =
    preview != null &&
    preview.status !== "ready" &&
    preview.status !== "imported";

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
            {text("authority")}
          </Badge>
        </div>
        <Alert className="border-sky-500/25 bg-sky-500/5">
          <ShieldCheck className="text-sky-400" />
          <AlertTitle>{text("legacy_estimate")}</AlertTitle>
          <AlertDescription>{text("legacyNotice")}</AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="min-w-0 space-y-5">
        {reviewState?.canWrite ? (
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
                <Label htmlFor={`geometry-dxf-lineage-${projectId}`}>
                  {text("drawingLineage")}
                </Label>
                <Input
                  id={`geometry-dxf-lineage-${projectId}`}
                  dir="ltr"
                  maxLength={64}
                  value={sourceLineageId}
                  onChange={event => {
                    setSourceLineageId(event.target.value);
                    setPreview(null);
                  }}
                  aria-describedby={`geometry-dxf-lineage-help-${projectId}`}
                />
                <p
                  id={`geometry-dxf-lineage-help-${projectId}`}
                  className="text-xs text-muted-foreground"
                >
                  {text("drawingLineageHelp")}
                </p>
              </div>
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
        ) : !reviewQuery.isLoading ? (
          <Alert>
            <ShieldCheck />
            <AlertDescription>{text("readOnly")}</AlertDescription>
          </Alert>
        ) : null}

        {reviewState?.canWrite && preview && (
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
          {reviewState?.latestReviewed && !reviewState?.draft && (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <HelpCircle className="text-amber-400" />
              <AlertTitle>{text("latestOutcome")}</AlertTitle>
              <AlertDescription className="space-y-2">
                <StatusBadge
                  status={reviewState.latestReviewed.status}
                  label={text}
                />
                {reviewState.latestReview?.note && (
                  <p className="break-words">
                    {reviewState.latestReview.note}
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{text("comparison")}</h3>
            <StatusBadge
              status={
                reviewGeometry?.status ||
                reviewState?.reconciliation?.status ||
                "not_checked"
              }
              label={text}
            />
          </div>
          {reviewQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <div className="min-w-0 rounded-md bg-secondary/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {text("legacyArea")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {numericArea(reviewState?.legacy?.totalAreaSqm)}
                </p>
                <StatusBadge
                  status={reviewState?.legacy?.status || "legacy_estimate"}
                  label={text}
                />
              </div>
              <div className="min-w-0 rounded-md bg-secondary/25 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {text("polygonArea")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {numericArea(reviewGeometry?.totalAreaSqm)}
                </p>
                {reviewGeometry ? (
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={reviewGeometry.status} label={text} />
                    <StatusBadge
                      status={reviewGeometry.evidenceStatus}
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
                  {text("not_checked")}
                </p>
              </div>
            </div>
          )}
          {reviewState?.reconciliation?.message && (
            <p className="break-words text-xs text-muted-foreground">
              {text("comparisonUnavailable")}
            </p>
          )}

          {reviewGeometry?.rooms?.map((room, index) => (
            <BoundaryOverlay
              key={room.spaceId ?? `geometry-room-${index}`}
              source={room.sourceOuterRing}
              normalized={room.normalizedOuterRing}
              title={text("overlay")}
              sourceLabel={text("source")}
              normalizedLabel={text("normalized")}
            />
          ))}

          {reviewState?.canReview && reviewState.draft?.status === "draft" && (
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
                  onClick={() => handleReview("approve_as_canonical")}
                  disabled={review.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 />
                  {text("accepted")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReview("reject")}
                  disabled={review.isPending}
                >
                  <XCircle />
                  {text("rejected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReview("request_clarification")}
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
