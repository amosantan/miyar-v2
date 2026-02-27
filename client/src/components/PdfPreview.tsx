/**
 * PdfPreview — Room Extraction Viewer
 * Displays extracted rooms as cards with confidence badges.
 */
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface ExtractedRoom {
    name: string;
    areaSqm: number;
    confidence: number;
    category?: string;
}

interface PdfPreviewProps {
    rooms: ExtractedRoom[];
    totalArea: number;
    warnings?: string[];
    manualTotalArea?: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
    living: "bg-blue-500/20 text-blue-400",
    bedroom: "bg-purple-500/20 text-purple-400",
    bathroom: "bg-cyan-500/20 text-cyan-400",
    kitchen: "bg-orange-500/20 text-orange-400",
    dining: "bg-amber-500/20 text-amber-400",
    corridor: "bg-gray-500/20 text-gray-400",
    utility: "bg-gray-500/20 text-gray-400",
    balcony: "bg-green-500/20 text-green-400",
    terrace: "bg-green-500/20 text-green-400",
    study: "bg-indigo-500/20 text-indigo-400",
    storage: "bg-gray-500/20 text-gray-400",
    other: "bg-gray-500/20 text-gray-400",
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
    if (confidence >= 0.8) {
        return (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                {Math.round(confidence * 100)}%
            </span>
        );
    }
    if (confidence >= 0.6) {
        return (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {Math.round(confidence * 100)}%
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            {Math.round(confidence * 100)}%
        </span>
    );
}

export default function PdfPreview({ rooms, totalArea, warnings, manualTotalArea }: PdfPreviewProps) {
    const delta = manualTotalArea ? totalArea - manualTotalArea : null;
    const deltaPct = manualTotalArea ? ((totalArea - manualTotalArea) / manualTotalArea) * 100 : null;
    const avgConfidence = rooms.length > 0
        ? rooms.reduce((sum, r) => sum + r.confidence, 0) / rooms.length
        : 0;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{rooms.length}</div>
                    <div className="text-xs text-muted-foreground">Rooms Detected</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{totalArea.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Extracted Area (sqm)</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-foreground">{Math.round(avgConfidence * 100)}%</div>
                    <div className="text-xs text-muted-foreground">Avg Confidence</div>
                </div>
                {manualTotalArea && delta !== null && deltaPct !== null && (
                    <div className={`border rounded-lg p-3 text-center ${Math.abs(deltaPct) > 10
                            ? "bg-red-500/10 border-red-500/30"
                            : Math.abs(deltaPct) > 5
                                ? "bg-amber-500/10 border-amber-500/30"
                                : "bg-emerald-500/10 border-emerald-500/30"
                        }`}>
                        <div className={`text-2xl font-bold ${Math.abs(deltaPct) > 10 ? "text-red-400" : Math.abs(deltaPct) > 5 ? "text-amber-400" : "text-emerald-400"
                            }`}>
                            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">vs Manual Entry</div>
                    </div>
                )}
            </div>

            {/* Warnings */}
            {warnings && warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Extraction Notes
                    </div>
                    <ul className="text-xs text-amber-300/80 space-y-1">
                        {warnings.map((w, i) => (
                            <li key={i}>• {w}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Room cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rooms.map((room, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <div className="font-medium text-foreground text-sm">{room.name}</div>
                                {room.category && (
                                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-1 ${CATEGORY_COLORS[room.category] || CATEGORY_COLORS.other
                                        }`}>
                                        {room.category}
                                    </span>
                                )}
                            </div>
                            <ConfidenceBadge confidence={room.confidence} />
                        </div>
                        <div className="text-xl font-bold text-foreground">{room.areaSqm.toLocaleString()} sqm</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
