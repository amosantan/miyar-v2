/**
 * ProjectNew — MIYAR 2.0 Intelligent Intake
 *
 * Default: "Talk to MIYAR" AI intake canvas with multimodal upload
 * Fallback: "Expert Mode" — existing 7-step ProjectForm wizard
 *
 * Flow: Upload assets → AI extracts → review pre-filled form → create project
 */
import { useState, useRef, useCallback } from "react";
import { ProjectForm } from "@/components/ProjectForm";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, Mic, MicOff, Globe, Sparkles, ArrowRight,
  CheckCircle2, AlertCircle, Image, X, Loader2, FileAudio, Film,
  ChevronDown, ChevronUp, Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface UploadedAsset {
  id?: number;
  type: "image" | "pdf" | "audio" | "video" | "url" | "text_note";
  fileName: string;
  url: string;
  mimeType?: string;
  textContent?: string;
  preview?: string; // data URL for thumbnails
  file?: File; // retain file reference for upload
}

type IntakeMode = "intake" | "form";
type IntakePhase = "upload" | "analyzing" | "review";

// ─── Confidence Badges ───────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const config = {
    high: { color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/30", label: "AI ✓" },
    medium: { color: "text-amber-400 bg-amber-950/40 border-amber-800/30", label: "Review" },
    low: { color: "text-red-400 bg-red-950/40 border-red-800/30", label: "Low conf." },
  };
  const c = config[level];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${c.color}`}>
      {c.label}
    </span>
  );
}

// ─── Asset Thumbnail ─────────────────────────────────────────────────────────

function AssetThumbnail({ asset, onRemove }: { asset: UploadedAsset; onRemove: () => void }) {
  const icons: Record<string, any> = { image: Image, pdf: FileText, audio: FileAudio, video: Film, url: Globe, text_note: FileText };
  const Icon = icons[asset.type] || FileText;
  return (
    <div className="group relative flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition">
      {asset.preview ? (
        <img src={asset.preview} alt="" className="w-10 h-10 rounded object-cover" />
      ) : (
        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white/50" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/80 truncate">{asset.fileName}</p>
        <p className="text-[10px] text-white/40 uppercase">{asset.type}</p>
      </div>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const createProject = trpc.project.create.useMutation();
  const processAssets = trpc.intake.processAssets.useMutation();
  const getUploadUrl = trpc.intake.getUploadUrl.useMutation();

  // Mode: AI intake vs manual form
  const [mode, setMode] = useState<IntakeMode>("intake");
  const [phase, setPhase] = useState<IntakePhase>("upload");

  // Assets & description
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [description, setDescription] = useState("");
  const [urlInput, setUrlInput] = useState("");

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // AI results
  const [intakeResult, setIntakeResult] = useState<any>(null);
  const [prefillData, setPrefillData] = useState<any>(null);

  // Confidence accordion
  const [showConfidence, setShowConfidence] = useState(false);

  // ─── File Upload ─────────────────────────────────────────────────────────

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const newAssets: UploadedAsset[] = [];

    for (const file of Array.from(files)) {
      const type = inferAssetType(file.type);
      const preview = type === "image" ? URL.createObjectURL(file) : undefined;

      // Upload to S3 via getUploadUrl
      try {
        const uploadResult = await getUploadUrl.mutateAsync({
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });

        newAssets.push({
          type,
          fileName: file.name,
          url: uploadResult.storageUrl,
          mimeType: file.type,
          preview,
          file,
        });
      } catch {
        // If S3 upload fails, create a local data URL instead
        const dataUrl = await fileToDataUrl(file);
        newAssets.push({
          type,
          fileName: file.name,
          url: dataUrl,
          mimeType: file.type,
          preview,
          file,
        });
      }
    }

    setAssets(prev => [...prev, ...newAssets]);
  }, [getUploadUrl]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ─── URL Input ───────────────────────────────────────────────────────────

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    setAssets(prev => [...prev, {
      type: "url",
      fileName: urlInput,
      url: urlInput,
      textContent: undefined,
    }]);
    setUrlInput("");
  };

  // ─── Voice Recording ────────────────────────────────────────────────────

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const dataUrl = await blobToDataUrl(audioBlob);
        stream.getTracks().forEach(t => t.stop());

        setAssets(prev => [...prev, {
          type: "audio",
          fileName: `voice-note-${Date.now()}.webm`,
          url: dataUrl,
          mimeType: "audio/webm",
        }]);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  // ─── AI Processing ──────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (assets.length === 0 && !description.trim()) {
      toast.error("Add at least one asset or describe your project");
      return;
    }

    setPhase("analyzing");

    try {
      const result = await processAssets.mutateAsync({
        assets: assets.map(a => ({
          type: a.type,
          url: a.url,
          mimeType: a.mimeType,
          textContent: a.textContent,
          fileName: a.fileName,
          assetId: a.id,
        })),
        freeformDescription: description || undefined,
      });

      setIntakeResult(result);
      setPrefillData(result.suggestedInputs);
      setPhase("review");

      const fieldCount = Object.keys(result.suggestedInputs).length;
      toast.success(`MIYAR detected ${fieldCount} parameters from your inputs`);
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
      setPhase("upload");
    }
  };

  // ─── Project Creation ───────────────────────────────────────────────────

  const handleSubmit = async (data: any) => {
    try {
      const result = await createProject.mutateAsync(data);
      toast.success("Project created successfully");
      setLocation(`/projects/${result.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    }
  };

  const removeAsset = (index: number) => {
    setAssets(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Render: Expert Mode ────────────────────────────────────────────────

  if (mode === "form") {
    return (
      <ProjectForm
        onSubmit={handleSubmit}
        isPending={createProject.isPending}
        submitLabel="Create Project"
        onCancel={() => setLocation("/projects")}
        initialData={prefillData}
      />
    );
  }

  // ─── Render: Review Phase ───────────────────────────────────────────────

  if (phase === "review" && intakeResult) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-950/30 border border-emerald-800/30 rounded-full text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" /> AI Analysis Complete
          </div>
          <h1 className="text-2xl font-serif text-white">
            {intakeResult.extractedInsights?.projectDescription || "Project Parameters Detected"}
          </h1>
          <p className="text-white/50 text-sm">
            {Object.keys(intakeResult.suggestedInputs).length} fields auto-filled ·{" "}
            {Object.values(intakeResult.confidence).filter((c: any) => c === "high").length} high confidence
          </p>
        </div>

        {/* Extracted Insights */}
        {intakeResult.extractedInsights && (
          <Card className="bg-white/[0.02] border-white/10">
            <CardContent className="p-5">
              <h3 className="text-sm font-medium text-white/70 mb-3">Detected Insights</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {intakeResult.extractedInsights.detectedStyle && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Style</p>
                    <p className="text-sm text-white">{intakeResult.extractedInsights.detectedStyle}</p>
                  </div>
                )}
                {intakeResult.extractedInsights.detectedTier && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Tier</p>
                    <p className="text-sm text-white">{intakeResult.extractedInsights.detectedTier}</p>
                  </div>
                )}
                {intakeResult.extractedInsights.detectedTypology && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Typology</p>
                    <p className="text-sm text-white">{intakeResult.extractedInsights.detectedTypology}</p>
                  </div>
                )}
                {intakeResult.extractedInsights.detectedLocation && (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Location</p>
                    <p className="text-sm text-white">{intakeResult.extractedInsights.detectedLocation}</p>
                  </div>
                )}
              </div>
              {(intakeResult.extractedInsights.detectedMaterials?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-white/40 uppercase mb-1">Materials Detected</p>
                  <div className="flex flex-wrap gap-1">
                    {intakeResult.extractedInsights.detectedMaterials.map((m: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-white/5 rounded text-white/70">{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confidence Details */}
        <Card className="bg-white/[0.02] border-white/10">
          <button
            onClick={() => setShowConfidence(!showConfidence)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <span className="text-sm text-white/70">Field Confidence & Reasoning</span>
            {showConfidence ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>
          {showConfidence && (
            <CardContent className="pt-0 pb-4 px-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(intakeResult.suggestedInputs).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-white/60">{key}</code>
                        <ConfidenceBadge level={intakeResult.confidence[key] || "low"} />
                      </div>
                      {intakeResult.reasoning[key] && (
                        <p className="text-[11px] text-white/40 mt-0.5">{intakeResult.reasoning[key]}</p>
                      )}
                    </div>
                    <span className="text-xs text-white/80 font-mono shrink-0">{String(value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Warnings */}
        {intakeResult.warnings?.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/20 border border-amber-800/20">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-300/80 space-y-1">
              {intakeResult.warnings.map((w: string, i: number) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="outline" onClick={() => { setPhase("upload"); setIntakeResult(null); }}>
            ← Re-upload
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setMode("form")}>
              Edit All Fields
            </Button>
            <Button onClick={() => setMode("form")} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500">
              <Sparkles className="w-4 h-4" /> Continue to Review
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Upload Phase (Main Intake Canvas) ──────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-serif text-white">
          Tell MIYAR about your project
        </h1>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Drop files, paste URLs, record a voice note, or describe your vision.
          MIYAR will auto-fill your project parameters.
        </p>
      </div>

      {/* Upload Zone */}
      <Card
        className="bg-white/[0.02] border-white/10 border-dashed hover:border-white/20 transition cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="py-12 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-800/20 flex items-center justify-center">
            <Upload className="w-7 h-7 text-emerald-400/70" />
          </div>
          <div>
            <p className="text-sm text-white/70">Drop files here or click to browse</p>
            <p className="text-xs text-white/30 mt-1">
              📎 Images · 📄 PDFs · 🎤 Audio · 🎬 Video — up to 50MB each
            </p>
          </div>
        </CardContent>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,audio/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Uploaded Assets */}
      {assets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-wider">{assets.length} asset{assets.length !== 1 ? "s" : ""} added</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {assets.map((asset, i) => (
              <AssetThumbnail key={i} asset={asset} onRemove={() => removeAsset(i)} />
            ))}
          </div>
        </div>
      )}

      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            placeholder="Paste supplier or reference URL..."
            className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleAddUrl} disabled={!urlInput.trim()}>
          Add URL
        </Button>
      </div>

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Describe your project vision...\n\nExample: "50 luxury apartments in Dubai Marina, Japandi-style interiors, targeting HNWI buyers, 150M AED budget, Ultra-luxury tier"`}
          className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
        />
      </div>

      {/* Voice Recorder */}
      <div className="flex items-center justify-center">
        <Button
          variant={isRecording ? "destructive" : "outline"}
          onClick={toggleRecording}
          className={`gap-2 ${isRecording ? "animate-pulse" : ""}`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {isRecording ? "Stop Recording" : "Record Voice Note"}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <Button
          variant="ghost"
          onClick={() => setMode("form")}
          className="text-white/40 hover:text-white/60 text-xs"
        >
          Skip to Manual Form →
        </Button>

        <Button
          onClick={handleAnalyze}
          disabled={phase === "analyzing" || (assets.length === 0 && !description.trim())}
          className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-6"
        >
          {phase === "analyzing" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Analyze & Auto-Fill
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferAssetType(mimeType: string): UploadedAsset["type"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "pdf"; // default for unknown file types
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
