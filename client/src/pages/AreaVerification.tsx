/**
 * Area Verification Page (V4 — Phase D)
 * Upload floor plan → extract rooms via Gemini Vision → compare → verify
 */
import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Upload, FileImage, Loader2, CheckCircle, XCircle, ArrowLeft,
    Shield, Scan, AlertTriangle, Eye, RefreshCw
} from "lucide-react";
import PdfPreview from "../components/PdfPreview";

type ExtractionResult = {
    id: number;
    rooms: { name: string; areaSqm: number; confidence: number; category?: string }[];
    totalArea: number;
    warnings: string[];
    status: "extracted";
};

export default function AreaVerification() {
    const { id } = useParams<{ id: string }>();
    const [, navigate] = useLocation();
    const projectId = Number(id);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedAssetId, setUploadedAssetId] = useState<number | null>(null);
    const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
    const [step, setStep] = useState<"upload" | "extracting" | "review" | "verified">("upload");

    // Project data
    const projectQuery = trpc.project.get.useQuery(
        { id: projectId },
        { enabled: !!projectId }
    );

    // Existing extractions
    const extractionsQuery = trpc.project.getExtractions.useQuery(
        { projectId },
        { enabled: !!projectId }
    );

    // Mutations
    const uploadMutation = trpc.design.uploadAsset.useMutation();
    const extractMutation = trpc.project.extractAreas.useMutation();
    const verifyMutation = trpc.project.verifyAreas.useMutation();

    const project = projectQuery.data;
    const manualFitoutArea = project?.totalFitoutArea ? Number(project.totalFitoutArea) : null;
    const isVerified = project?.fitoutAreaVerified ?? false;

    // Handle file selection
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
            if (!allowed.includes(file.type)) {
                toast.error("Please upload a PNG, JPEG, WebP, or PDF file");
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                toast.error("File size must be under 20 MB");
                return;
            }
            setSelectedFile(file);
        }
    }, []);

    // Handle drag & drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) setSelectedFile(file);
    }, []);

    // Upload + Extract
    const handleExtract = async () => {
        if (!selectedFile) return;
        setStep("extracting");

        try {
            // Step 1: Upload file as asset
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(",")[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(selectedFile);
            });

            const uploadResult = await uploadMutation.mutateAsync({
                projectId,
                filename: selectedFile.name,
                mimeType: selectedFile.type,
                base64Data: base64,
                category: "brief",
                tags: ["floor_plan", "area_verification"],
                notes: "Uploaded for area verification via Gemini Vision",
            });

            setUploadedAssetId(uploadResult.id);
            toast.success("File uploaded successfully");

            // Step 2: Run extraction
            const extractResult = await extractMutation.mutateAsync({
                projectId,
                assetId: uploadResult.id,
            });

            setExtraction(extractResult);
            setStep("review");
            toast.success(`Extracted ${extractResult.rooms.length} rooms (${extractResult.totalArea} sqm)`);
        } catch (error: any) {
            toast.error(error.message || "Extraction failed");
            setStep("upload");
        }
    };

    // Verify areas
    const handleVerify = async () => {
        if (!extraction) return;
        try {
            await verifyMutation.mutateAsync({
                projectId,
                extractionId: extraction.id,
                action: "verify",
            });
            setStep("verified");
            toast.success("Areas verified! Fitout area updated.");
            projectQuery.refetch();
            extractionsQuery.refetch();
        } catch (error: any) {
            toast.error(error.message || "Verification failed");
        }
    };

    // Reject extraction
    const handleReject = async () => {
        if (!extraction) return;
        try {
            await verifyMutation.mutateAsync({
                projectId,
                extractionId: extraction.id,
                action: "reject",
            });
            toast.info("Extraction rejected. Upload a new floor plan to try again.");
            setExtraction(null);
            setSelectedFile(null);
            setStep("upload");
            extractionsQuery.refetch();
        } catch (error: any) {
            toast.error(error.message || "Rejection failed");
        }
    };

    const existingExtractions = (extractionsQuery.data || []) as any[];

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-5xl px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            <Shield className="w-6 h-6 text-primary" />
                            Area Verification
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Upload a floor plan and let Gemini Vision extract room areas for verification
                        </p>
                    </div>
                    {isVerified && (
                        <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-4 h-4" /> Verified
                        </span>
                    )}
                </div>

                {/* Current Status */}
                {project && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-foreground">
                                {project.ctx03Gfa ? Number(project.ctx03Gfa).toLocaleString() : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">GFA (sqm)</div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-foreground">
                                {manualFitoutArea ? manualFitoutArea.toLocaleString() : "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">Fitout Area (sqm)</div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                            <div className="text-lg font-bold text-foreground">
                                {project.ctx01Typology || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">Typology</div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-center">
                            <div className={`text-lg font-bold ${isVerified ? "text-emerald-400" : "text-amber-400"}`}>
                                {isVerified ? "Verified" : "Unverified"}
                            </div>
                            <div className="text-xs text-muted-foreground">Status</div>
                        </div>
                    </div>
                )}

                {/* Step: Upload */}
                {step === "upload" && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileImage className="w-5 h-5 text-primary" />
                                Upload Floor Plan
                            </CardTitle>
                            <CardDescription>
                                Upload a floor plan (PNG, JPEG, WebP, or PDF) to extract room areas using Gemini Vision AI
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${selectedFile
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border hover:border-primary/30 hover:bg-accent/50"
                                    }`}
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                onClick={() => document.getElementById("floor-plan-input")?.click()}
                            >
                                <input
                                    id="floor-plan-input"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,application/pdf"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                {selectedFile ? (
                                    <div className="space-y-2">
                                        <FileImage className="w-12 h-12 mx-auto text-primary" />
                                        <div className="font-medium text-foreground">{selectedFile.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                                        <div className="text-sm text-muted-foreground">
                                            <span className="font-medium text-foreground">Click to upload</span> or drag and drop
                                        </div>
                                        <div className="text-xs text-muted-foreground">PNG, JPEG, WebP, or PDF up to 20 MB</div>
                                    </div>
                                )}
                            </div>

                            {selectedFile && (
                                <div className="mt-4 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setSelectedFile(null)}>
                                        Clear
                                    </Button>
                                    <Button onClick={handleExtract}>
                                        <Scan className="w-4 h-4 mr-2" />
                                        Extract Areas with Gemini
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Step: Extracting */}
                {step === "extracting" && (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin mb-4" />
                            <div className="text-lg font-medium text-foreground mb-2">Analyzing Floor Plan...</div>
                            <div className="text-sm text-muted-foreground">
                                Gemini Vision is detecting rooms and calculating areas. This may take 10-30 seconds.
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step: Review */}
                {step === "review" && extraction && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5 text-primary" />
                                    Extraction Results
                                </CardTitle>
                                <CardDescription>
                                    Review the detected rooms and areas below. If the results look correct, click "Verify" to confirm.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PdfPreview
                                    rooms={extraction.rooms}
                                    totalArea={extraction.totalArea}
                                    warnings={extraction.warnings}
                                    manualTotalArea={manualFitoutArea}
                                />
                            </CardContent>
                        </Card>

                        {/* Comparison */}
                        {manualFitoutArea !== null && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Manual vs Extracted Comparison</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border">
                                                    <th className="text-left py-2 text-muted-foreground font-medium">Source</th>
                                                    <th className="text-right py-2 text-muted-foreground font-medium">Total Area (sqm)</th>
                                                    <th className="text-right py-2 text-muted-foreground font-medium">Delta</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b border-border/50">
                                                    <td className="py-2 text-foreground">Manual Entry</td>
                                                    <td className="text-right py-2 text-foreground font-medium">
                                                        {manualFitoutArea.toLocaleString()}
                                                    </td>
                                                    <td className="text-right py-2 text-muted-foreground">—</td>
                                                </tr>
                                                <tr className="border-b border-border/50">
                                                    <td className="py-2 text-foreground">Gemini Extraction</td>
                                                    <td className="text-right py-2 text-foreground font-medium">
                                                        {extraction.totalArea.toLocaleString()}
                                                    </td>
                                                    <td className={`text-right py-2 font-medium ${Math.abs(extraction.totalArea - manualFitoutArea) / manualFitoutArea > 0.1
                                                        ? "text-red-400"
                                                        : "text-emerald-400"
                                                        }`}>
                                                        {((extraction.totalArea - manualFitoutArea) / manualFitoutArea * 100).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    {Math.abs(extraction.totalArea - manualFitoutArea) / manualFitoutArea > 0.1 && (
                                        <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                                            <div className="text-xs text-amber-300/80">
                                                The extracted area differs by more than 10% from your manual entry.
                                                Review the room breakdown above before verifying. Verifying will update
                                                the project's fitout area to the extracted value.
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={handleReject} disabled={verifyMutation.isPending}>
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject & Re-upload
                            </Button>
                            <Button variant="outline" onClick={() => { setStep("upload"); setExtraction(null); setSelectedFile(null); }}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Another Plan
                            </Button>
                            <Button onClick={handleVerify} disabled={verifyMutation.isPending}>
                                {verifyMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Verify Areas
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step: Verified */}
                {step === "verified" && (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <CheckCircle className="w-16 h-16 mx-auto text-emerald-400 mb-4" />
                            <div className="text-xl font-bold text-foreground mb-2">Areas Verified ✓</div>
                            <div className="text-sm text-muted-foreground mb-6">
                                The project's fitout area has been updated and marked as verified.
                                All cost calculations will now use the verified area.
                            </div>
                            <div className="flex justify-center gap-3">
                                <Button variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>
                                    Back to Project
                                </Button>
                                <Button onClick={() => { setStep("upload"); setExtraction(null); setSelectedFile(null); }}>
                                    Verify Another Plan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Previous Extractions */}
                {existingExtractions.length > 0 && step === "upload" && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-sm">Previous Extractions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-2 text-muted-foreground font-medium">ID</th>
                                            <th className="text-left py-2 text-muted-foreground font-medium">Method</th>
                                            <th className="text-right py-2 text-muted-foreground font-medium">Total Area</th>
                                            <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                                            <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {existingExtractions.map((ext: any) => (
                                            <tr key={ext.id} className="border-b border-border/50">
                                                <td className="py-2 text-foreground">#{ext.id}</td>
                                                <td className="py-2 text-foreground">{ext.extractionMethod}</td>
                                                <td className="text-right py-2 text-foreground">
                                                    {ext.totalExtractedArea ? Number(ext.totalExtractedArea).toLocaleString() : "—"} sqm
                                                </td>
                                                <td className="py-2">
                                                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${ext.status === "verified"
                                                        ? "bg-emerald-500/20 text-emerald-400"
                                                        : ext.status === "rejected"
                                                            ? "bg-red-500/20 text-red-400"
                                                            : ext.status === "extracted"
                                                                ? "bg-blue-500/20 text-blue-400"
                                                                : "bg-gray-500/20 text-gray-400"
                                                        }`}>
                                                        {ext.status}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-muted-foreground">
                                                    {new Date(ext.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
