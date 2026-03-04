/**
 * MIYAR 3.0 Phase A — Material Allocation Panel
 *
 * Displays MQI results: budget status, room-by-room material allocation
 * with bar charts, cost ranges, lock toggle, and regeneration.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Lock,
    Unlock,
    RefreshCcw,
    ChevronDown,
    ChevronRight,
    Layers,
    AlertTriangle,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

function fmtAed(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
}

const ELEMENT_COLORS: Record<string, string> = {
    floor: "#4ecdc4",   // teal
    walls: "#f0c674",   // gold
    ceiling: "#9b9bff", // lavender
    joinery: "#e07a5f", // coral
};

interface Props {
    projectId: number;
}

export default function MaterialAllocationPanel({ projectId }: Props) {
    const utils = trpc.useUtils();
    const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());

    const { data, isLoading, error } = trpc.materialQuantity.getForProject.useQuery(
        { projectId },
    );

    const generateMutation = trpc.materialQuantity.generate.useMutation({
        onSuccess: () => {
            toast.success("Material allocations generated");
            utils.materialQuantity.getForProject.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    const lockMutation = trpc.materialQuantity.lockAllocations.useMutation({
        onSuccess: (result) => {
            toast.success(result.isLocked ? "Allocations locked" : "Allocations unlocked");
            utils.materialQuantity.getForProject.invalidate({ projectId });
        },
        onError: (err) => toast.error(err.message),
    });

    const toggleRoom = (roomId: string) => {
        setExpandedRooms((prev) => {
            const next = new Set(prev);
            if (next.has(roomId)) next.delete(roomId);
            else next.add(roomId);
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!data) {
        return (
            <Card>
                <CardContent className="py-12 text-center">
                    <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        Material Quantity Intelligence
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        Calculate surface areas, generate AI-powered material allocations,
                        and get accurate cost estimates for every room.
                    </p>
                    <Button
                        onClick={() => generateMutation.mutate({ projectId })}
                        disabled={generateMutation.isPending}
                        className="gap-2"
                    >
                        {generateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Layers className="h-4 w-4" />
                        )}
                        Generate Material Allocations
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Compute totals from room data
    const totalCostMin = data.rooms.reduce((sum: number, r: any) =>
        sum + r.elements.reduce((s: number, e: any) =>
            s + e.allocations.reduce((a: number, al: any) => a + (al.totalCostMin || 0), 0), 0), 0);
    const totalCostMax = data.rooms.reduce((sum: number, r: any) =>
        sum + r.elements.reduce((s: number, e: any) =>
            s + e.allocations.reduce((a: number, al: any) => a + (al.totalCostMax || 0), 0), 0), 0);
    const totalCostMid = (totalCostMin + totalCostMax) / 2;
    const hasLocked = data.rooms.some((r: any) =>
        r.elements.some((e: any) => e.allocations.some((a: any) => a.isLocked)));

    return (
        <div className="space-y-4">
            {/* Summary Header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Finish Cost (Est.)</p>
                        <p className="text-2xl font-bold text-miyar-emerald">
                            {fmtAed(totalCostMid)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">AED</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Cost Range</p>
                        <p className="text-lg font-semibold text-foreground">
                            {fmtAed(totalCostMin)} – {fmtAed(totalCostMax)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">AED min–max</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Allocations</p>
                        <p className="text-2xl font-bold text-foreground">
                            {data.totalAllocations}
                        </p>
                        <p className="text-[10px] text-muted-foreground">material assignments</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Rooms</p>
                        <p className="text-2xl font-bold text-foreground">
                            {data.rooms.length}
                        </p>
                        <p className="text-[10px] text-muted-foreground">with allocations</p>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateMutation.mutate({ projectId })}
                    disabled={generateMutation.isPending}
                    className="gap-1.5"
                >
                    {generateMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    Re-generate
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                        lockMutation.mutate({ projectId, isLocked: !hasLocked })
                    }
                    disabled={lockMutation.isPending}
                    className="gap-1.5"
                >
                    {hasLocked ? (
                        <Unlock className="h-3.5 w-3.5" />
                    ) : (
                        <Lock className="h-3.5 w-3.5" />
                    )}
                    {hasLocked ? "Unlock All" : "Lock All"}
                </Button>
                {data.generatedAt && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                        Generated {new Date(data.generatedAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Room Accordions */}
            {data.rooms.map((room: any) => {
                const isExpanded = expandedRooms.has(room.roomId);
                const roomCostMin = room.elements.reduce(
                    (s: number, e: any) =>
                        s + e.allocations.reduce((a: number, al: any) => a + (al.totalCostMin || 0), 0),
                    0
                );
                const roomCostMax = room.elements.reduce(
                    (s: number, e: any) =>
                        s + e.allocations.reduce((a: number, al: any) => a + (al.totalCostMax || 0), 0),
                    0
                );
                const roomCostMid = (roomCostMin + roomCostMax) / 2;

                return (
                    <Card key={room.roomId}>
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition"
                            onClick={() => toggleRoom(room.roomId)}
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div>
                                    <span className="text-sm font-medium text-foreground">
                                        {room.roomName}
                                    </span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                        ({room.roomId})
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-miyar-emerald">
                                    {fmtAed(roomCostMid)} AED
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {room.elements.reduce(
                                        (s: number, e: any) => s + e.allocations.length,
                                        0
                                    )}{" "}
                                    materials
                                </span>
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="pt-0 pb-4">
                                <div className="space-y-3">
                                    {room.elements.map((element: any) => (
                                        <div
                                            key={element.element}
                                            className="rounded-lg bg-secondary/20 p-3"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            ELEMENT_COLORS[element.element] || "#888",
                                                    }}
                                                />
                                                <span className="text-xs font-medium text-foreground capitalize">
                                                    {element.element}
                                                </span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {element.allocations.map((alloc: any, i: number) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-xs text-foreground">
                                                                    {alloc.materialName}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    {alloc.isLocked && (
                                                                        <Lock className="h-3 w-3 text-miyar-gold" />
                                                                    )}
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {alloc.allocationPct}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {/* Bar */}
                                                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${alloc.allocationPct}%`,
                                                                        backgroundColor:
                                                                            ELEMENT_COLORS[element.element] || "#888",
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex justify-between mt-0.5">
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {alloc.actualAreaM2?.toFixed(1)} m²
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {fmtAed(alloc.totalCostMin || 0)}–
                                                                    {fmtAed(alloc.totalCostMax || 0)} AED
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
