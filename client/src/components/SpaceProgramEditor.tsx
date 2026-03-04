/**
 * MIYAR 3.0 Phase B — Space Program Editor
 *
 * Room table with fit-out toggles, amenity sub-space accordion,
 * mixed-use block tabs, and inline editing.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Loader2, Plus, Trash2, RotateCcw, Zap,
    ChevronDown, ChevronRight, Building2, Grid3X3,
    ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpaceProgramEditorProps {
    projectId: number;
}

const CATEGORY_LABELS: Record<string, string> = {
    lobby: "Lobby / Reception",
    corridor: "Corridor / Circulation",
    office_floor: "Open Plan Office",
    guest_room: "Guest Room",
    suite: "Suite / Penthouse",
    fb_restaurant: "F&B / Restaurant",
    bathroom: "Bathroom / WC",
    kitchen: "Kitchen / Pantry",
    bedroom: "Bedroom",
    living: "Living / Lounge",
    utility: "Utility / Service",
    amenity: "Amenity",
    parking: "Parking",
    retail: "Retail",
    back_of_house: "Back of House",
    other: "Other",
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

const GRADE_COLORS: Record<string, string> = {
    A: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    B: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    C: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpaceProgramEditor({ projectId }: SpaceProgramEditorProps) {
    const utils = trpc.useUtils();
    const [expandedAmenity, setExpandedAmenity] = useState<number | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [activeBlock, setActiveBlock] = useState<string>("Main");

    // ─── Block Builder State (mixed-use) ──────────────────────────────
    const [blockDefs, setBlockDefs] = useState<Array<{ blockName: string; blockTypology: string; gfaPct: number }>>([
        { blockName: "Residential Tower", blockTypology: "residential", gfaPct: 50 },
        { blockName: "Office Tower", blockTypology: "commercial", gfaPct: 35 },
        { blockName: "Retail Podium", blockTypology: "retail", gfaPct: 15 },
    ]);

    // ─── Queries ──────────────────────────────────────────────────────────
    const { data, isLoading, refetch } = trpc.spaceProgram.getForProject.useQuery(
        { projectId },
    );
    const { data: project } = trpc.project.get.useQuery({ id: projectId });

    // ─── Mutations ────────────────────────────────────────────────────────
    const generateMut = trpc.spaceProgram.generate.useMutation({
        onSuccess: (res) => {
            toast.success(`Space program generated: ${res.roomCount} rooms (${res.fitOutRooms} fit-out, ${res.shellCoreRooms} shell & core)`);
            if (res.warnings.length > 0) {
                res.warnings.forEach((w) => toast.warning(w));
            }
            refetch();
            utils.spaceProgram.getForProject.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    const toggleFitOutMut = trpc.spaceProgram.toggleFitOut.useMutation({
        onSuccess: () => {
            refetch();
        },
        onError: (err) => toast.error(err.message),
    });

    const deleteRoomMut = trpc.spaceProgram.deleteRoom.useMutation({
        onSuccess: () => {
            toast.success("Room removed");
            refetch();
        },
        onError: (err) => toast.error(err.message),
    });

    const resetMut = trpc.spaceProgram.resetToTypologyDefaults.useMutation({
        onSuccess: (res) => {
            toast.success(`Reset: ${res.roomCount} default rooms regenerated`);
            refetch();
        },
        onError: (err) => toast.error(err.message),
    });

    const addRoomMut = trpc.spaceProgram.addRoom.useMutation({
        onSuccess: () => {
            toast.success("Room added");
            refetch();
            setShowAddDialog(false);
        },
        onError: (err) => toast.error(err.message),
    });

    // ─── Helpers ──────────────────────────────────────────────────────────
    const isMixedUse = (project?.ctx01Typology || "").toLowerCase().replace(/[\s_]/g, "-") === "mixed-use";
    const totalGfa = Number(project?.ctx03Gfa) || 0;

    const handleGenerate = () => {
        if (isMixedUse && blockDefs.length > 1) {
            const totalPct = blockDefs.reduce((s, b) => s + b.gfaPct, 0);
            generateMut.mutate({
                projectId,
                blocks: blockDefs.map((b) => ({
                    blockName: b.blockName,
                    blockTypology: b.blockTypology,
                    gfaSqm: totalGfa > 0 ? (totalGfa * b.gfaPct) / totalPct : 1000,
                })),
            });
        } else {
            generateMut.mutate({ projectId });
        }
    };
    const handleReset = () => resetMut.mutate({ projectId });

    const handleToggleFitOut = (roomId: number, currentState: boolean) => {
        toggleFitOutMut.mutate({ roomId, isFitOut: !currentState, projectId });
    };

    // ─── Block Builder Helpers ────────────────────────────────────────────
    const addBlock = () => {
        setBlockDefs([...blockDefs, { blockName: `Block ${blockDefs.length + 1}`, blockTypology: "residential", gfaPct: 10 }]);
    };
    const removeBlock = (i: number) => {
        if (blockDefs.length <= 2) return;
        setBlockDefs(blockDefs.filter((_, idx) => idx !== i));
    };
    const updateBlock = (i: number, field: string, value: string | number) => {
        setBlockDefs(blockDefs.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
    };

    // ─── Empty State ──────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Grid3X3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        No Space Program Yet
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        {isMixedUse
                            ? "Define your building blocks below, then generate a space program with per-block typology rules."
                            : "Generate a space program from your project typology to see room breakdowns, fit-out vs shell & core classifications, and budget distributions."
                        }
                    </p>

                    {/* Block Builder (mixed-use only) */}
                    {isMixedUse && (
                        <div className="max-w-lg mx-auto mb-6 text-left">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    Building Blocks
                                </h4>
                                <Button variant="outline" size="sm" onClick={addBlock} className="gap-1 text-xs h-7">
                                    <Plus className="h-3 w-3" /> Add Block
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {blockDefs.map((block, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_120px_70px_32px] gap-2 items-center">
                                        <input
                                            type="text"
                                            value={block.blockName}
                                            onChange={(e) => updateBlock(i, "blockName", e.target.value)}
                                            className="px-2.5 py-1.5 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Block name"
                                        />
                                        <select
                                            value={block.blockTypology}
                                            onChange={(e) => updateBlock(i, "blockTypology", e.target.value)}
                                            className="px-2 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground"
                                        >
                                            <option value="residential">Residential</option>
                                            <option value="commercial">Office</option>
                                            <option value="retail">Retail</option>
                                            <option value="hospitality">Hospitality</option>
                                            <option value="restaurant">Restaurant</option>
                                            <option value="clinic_medical">Clinic</option>
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                value={block.gfaPct}
                                                onChange={(e) => updateBlock(i, "gfaPct", Number(e.target.value) || 0)}
                                                min={1}
                                                max={100}
                                                className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                            <span className="text-xs text-muted-foreground">%</span>
                                        </div>
                                        <button
                                            onClick={() => removeBlock(i)}
                                            disabled={blockDefs.length <= 2}
                                            className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition p-1"
                                            title="Remove block"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {totalGfa > 0 && (
                                <div className="mt-2 text-[10px] text-muted-foreground">
                                    GFA: {totalGfa.toLocaleString()} sqm — {blockDefs.map((b) => `${b.blockName}: ${((totalGfa * b.gfaPct) / blockDefs.reduce((s, x) => s + x.gfaPct, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} sqm`).join(" · ")}
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        onClick={handleGenerate}
                        disabled={generateMut.isPending}
                        className="gap-2"
                    >
                        {generateMut.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Zap className="h-4 w-4" />
                        )}
                        Generate Space Program
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ─── Data Available ───────────────────────────────────────────────────
    const { blocks, summary } = data;
    const hasMultipleBlocks = blocks.length > 1;
    const activeBlockData = blocks.find((b: any) => b.blockName === activeBlock) || blocks[0];
    const activeRooms = activeBlockData?.rooms || [];

    return (
        <div className="space-y-4">
            {/* ─── Summary Bar ──────────────────────────────────────── */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-foreground">{summary.totalRooms}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rooms</p>
                            </div>
                            <Separator orientation="vertical" className="h-10" />
                            <div className="text-center">
                                <p className="text-2xl font-bold text-emerald-400">{summary.totalSqm.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total sqm</p>
                            </div>
                            <Separator orientation="vertical" className="h-10" />
                            <div className="text-center">
                                <p className="text-2xl font-bold text-cyan-400">{summary.fitOutSqm.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fit-Out sqm</p>
                            </div>
                            <Separator orientation="vertical" className="h-10" />
                            <div className="text-center">
                                <p className="text-2xl font-bold text-muted-foreground">{summary.shellCoreSqm.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Shell & Core sqm</p>
                            </div>
                            <Separator orientation="vertical" className="h-10" />
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary">{summary.fitOutPct}%</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Fit-Out Ratio</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddDialog(true)}
                                className="gap-1.5"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add Room
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleReset}
                                disabled={resetMut.isPending}
                                className="gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                            >
                                {resetMut.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Reset Defaults
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={generateMut.isPending}
                                className="gap-1.5"
                            >
                                {generateMut.isPending ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Zap className="h-3.5 w-3.5" />
                                )}
                                Regenerate
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Block Tabs (Mixed-Use) ───────────────────────────── */}
            {hasMultipleBlocks && (
                <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
                    {blocks.map((block: any) => (
                        <button
                            key={block.blockName}
                            onClick={() => setActiveBlock(block.blockName)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${activeBlock === block.blockName
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            <Building2 className="h-3 w-3 inline mr-1.5" />
                            {block.blockName}
                            <span className="ml-1.5 text-[10px] opacity-70">
                                ({block.rooms.length} rooms)
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* ─── Room Table ───────────────────────────────────────── */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Grid3X3 className="h-4 w-4 text-primary" />
                        {hasMultipleBlocks ? `${activeBlock} — ` : ""}Room Program
                        {activeBlockData && (
                            <Badge variant="outline" className="text-[10px] ml-2">
                                {(activeBlockData as any).blockTypology}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_120px_80px_80px_60px_60px_40px] gap-2 px-3 py-2 bg-secondary/30 rounded-t-lg text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        <span>Room</span>
                        <span>Category</span>
                        <span className="text-right">SQM</span>
                        <span className="text-center">Grade</span>
                        <span className="text-center">Priority</span>
                        <span className="text-center">Fit-Out</span>
                        <span></span>
                    </div>

                    {/* Room Rows */}
                    <div className="divide-y divide-border/30">
                        {activeRooms.map((room: any) => (
                            <div key={room.id}>
                                <div
                                    className={`grid grid-cols-[1fr_120px_80px_80px_60px_60px_40px] gap-2 px-3 py-2.5 items-center group hover:bg-secondary/20 transition ${!room.isFitOut ? "opacity-60" : ""
                                        }`}
                                >
                                    {/* Room name */}
                                    <div className="flex items-center gap-2">
                                        {room.category === "amenity" && (
                                            <button
                                                onClick={() => setExpandedAmenity(
                                                    expandedAmenity === room.id ? null : room.id
                                                )}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                {expandedAmenity === room.id ? (
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChevronRight className="h-3.5 w-3.5" />
                                                )}
                                            </button>
                                        )}
                                        <span className="text-sm text-foreground font-medium">
                                            {room.roomName}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/50 font-mono">
                                            {room.roomCode}
                                        </span>
                                        {room.fitOutOverridden && (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-400 border-amber-500/30">
                                                overridden
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Category */}
                                    <span className="text-xs text-muted-foreground">
                                        {CATEGORY_LABELS[room.category] || room.category}
                                    </span>

                                    {/* SQM */}
                                    <span className="text-sm text-right font-mono text-foreground">
                                        {Number(room.sqm).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </span>

                                    {/* Grade */}
                                    <div className="flex justify-center">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 py-0 ${GRADE_COLORS[room.finishGrade] || ""}`}
                                        >
                                            Grade {room.finishGrade}
                                        </Badge>
                                    </div>

                                    {/* Priority */}
                                    <div className="flex justify-center">
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] px-1.5 py-0 ${room.priority === "high"
                                                ? "text-rose-400 border-rose-500/30"
                                                : room.priority === "medium"
                                                    ? "text-blue-400 border-blue-500/30"
                                                    : "text-muted-foreground border-border/30"
                                                }`}
                                        >
                                            {room.priority}
                                        </Badge>
                                    </div>

                                    {/* Fit-Out Toggle */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => handleToggleFitOut(room.id, room.isFitOut)}
                                            disabled={toggleFitOutMut.isPending}
                                            className="transition hover:scale-110"
                                            title={room.isFitOut ? "Click to exclude from fit-out scope" : "Click to include in fit-out scope"}
                                        >
                                            {room.isFitOut ? (
                                                <ToggleRight className="h-5 w-5 text-emerald-400" />
                                            ) : (
                                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Delete */}
                                    <div className="flex justify-center opacity-0 group-hover:opacity-100 transition">
                                        <button
                                            onClick={() => deleteRoomMut.mutate({ roomId: room.id, projectId })}
                                            disabled={deleteRoomMut.isPending}
                                            className="text-muted-foreground hover:text-destructive transition"
                                            title="Delete room"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Amenity Sub-Spaces Accordion */}
                                {room.category === "amenity" &&
                                    expandedAmenity === room.id &&
                                    room.subSpaces?.length > 0 && (
                                        <div className="ml-8 mb-2 bg-secondary/20 rounded-lg border border-border/20">
                                            <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/10">
                                                Sub-Spaces
                                            </div>
                                            {room.subSpaces.map((sub: any, i: number) => (
                                                <div
                                                    key={i}
                                                    className="grid grid-cols-[1fr_100px_80px_80px_60px] gap-2 px-3 py-1.5 text-xs"
                                                >
                                                    <span className="text-foreground/80">{sub.subSpaceName}</span>
                                                    <span className="text-muted-foreground">{sub.subSpaceType}</span>
                                                    <span className="text-right font-mono">
                                                        {Number(sub.sqm).toFixed(1)} sqm
                                                    </span>
                                                    <span className="text-right text-muted-foreground">
                                                        {Number(sub.pctOfParent).toFixed(1)}%
                                                    </span>
                                                    <div className="flex justify-center">
                                                        {sub.isFitOut ? (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-emerald-400 border-emerald-500/30">
                                                                fit-out
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground border-border/30">
                                                                S&C
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        ))}
                    </div>

                    {/* Fit-Out Reason Legend */}
                    <div className="mt-4 pt-3 border-t border-border/20 flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <ToggleRight className="h-3 w-3 text-emerald-400" /> Fit-Out scope (priced in MQI)
                        </span>
                        <span className="flex items-center gap-1">
                            <ToggleLeft className="h-3 w-3 text-muted-foreground" /> Shell & Core (excluded from MQI)
                        </span>
                        <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-400 border-amber-500/30">
                                overridden
                            </Badge>
                            Manually toggled by developer — survives reset
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Add Room Dialog ──────────────────────────────────── */}
            <AddRoomDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                projectId={projectId}
                blockTypology={(activeBlockData as any)?.blockTypology || project?.ctx01Typology || "residential"}
                blockName={activeBlock}
                onSubmit={(room) => {
                    addRoomMut.mutate({
                        projectId,
                        roomName: room.roomName,
                        category: room.category as any,
                        sqm: room.sqm,
                        finishGrade: room.finishGrade as any,
                        priority: room.priority as any,
                        blockName: activeBlock,
                        blockTypology: (activeBlockData as any)?.blockTypology || "residential",
                    });
                }}
                isPending={addRoomMut.isPending}
            />
        </div>
    );
}

// ─── Add Room Dialog Component ────────────────────────────────────────────────

function AddRoomDialog({
    open,
    onOpenChange,
    projectId: _projectId,
    blockTypology: _blockTypology,
    blockName: _blockName,
    onSubmit,
    isPending,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    projectId: number;
    blockTypology: string;
    blockName: string;
    onSubmit: (room: {
        roomName: string;
        category: string;
        sqm: number;
        finishGrade: string;
        priority: string;
    }) => void;
    isPending: boolean;
}) {
    const [roomName, setRoomName] = useState("");
    const [category, setCategory] = useState("other");
    const [sqm, setSqm] = useState("");
    const [finishGrade, setFinishGrade] = useState("B");
    const [priority, setPriority] = useState("medium");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!roomName || !sqm) return;
        onSubmit({
            roomName,
            category,
            sqm: Number(sqm),
            finishGrade,
            priority,
        });
        // Reset form
        setRoomName("");
        setCategory("other");
        setSqm("");
        setFinishGrade("B");
        setPriority("medium");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Room</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Room Name</label>
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="e.g. Executive Lounge"
                            className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
                            >
                                {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {CATEGORY_LABELS[c]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Area (sqm)</label>
                            <input
                                type="number"
                                value={sqm}
                                onChange={(e) => setSqm(e.target.value)}
                                placeholder="120"
                                min="1"
                                step="0.1"
                                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Finish Grade</label>
                            <select
                                value={finishGrade}
                                onChange={(e) => setFinishGrade(e.target.value)}
                                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
                            >
                                <option value="A">Grade A — Premium</option>
                                <option value="B">Grade B — Standard</option>
                                <option value="C">Grade C — Basic</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground"
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isPending || !roomName || !sqm} className="gap-1.5">
                            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            Add Room
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
