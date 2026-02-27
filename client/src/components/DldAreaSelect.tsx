/**
 * DldAreaSelect — Phase B.3: DLD Area Picker
 *
 * Searchable dropdown listing all 71 DLD-registered Dubai areas.
 * Shows project count and unit count per area.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, Search, Loader2 } from "lucide-react";

interface Props {
    value: number | null;
    onChange: (areaId: number | null, areaName: string) => void;
}

export default function DldAreaSelect({ value, onChange }: Props) {
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);

    const { data: areas, isLoading } = trpc.design.getDldAreas.useQuery(undefined, {
        staleTime: 60 * 60 * 1000, // cache 1 hour
    });

    const filtered = useMemo(() => {
        if (!areas) return [];
        if (!search) return areas;
        const q = search.toLowerCase();
        return areas.filter(
            (a: any) =>
                a.areaNameEn?.toLowerCase().includes(q) ||
                a.areaNameAr?.includes(search)
        );
    }, [areas, search]);

    const selected = areas?.find((a: any) => a.areaId === value);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading DLD areas…
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Selected display / trigger */}
            <div
                className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => setOpen((v) => !v)}
            >
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                {selected ? (
                    <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-medium">{selected.areaNameEn}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {selected.projectCount} projects
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {Number(selected.totalUnits).toLocaleString()} units
                        </Badge>
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">Select Dubai area…</span>
                )}
            </div>

            {/* Dropdown */}
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-64 overflow-hidden">
                    {/* Search */}
                    <div className="p-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                                placeholder="Search areas…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-7 pl-7 text-xs"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Options */}
                    <div className="overflow-y-auto max-h-48">
                        {/* Clear option */}
                        <div
                            className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/50 cursor-pointer"
                            onClick={() => {
                                onChange(null, "");
                                setOpen(false);
                                setSearch("");
                            }}
                        >
                            — None —
                        </div>

                        {filtered.map((a: any) => (
                            <div
                                key={a.areaId}
                                className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-secondary/50 transition-colors ${a.areaId === value ? "bg-primary/10 border-l-2 border-primary" : ""
                                    }`}
                                onClick={() => {
                                    onChange(a.areaId, a.areaNameEn);
                                    setOpen(false);
                                    setSearch("");
                                }}
                            >
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-xs font-medium flex-1 truncate">{a.areaNameEn}</span>
                                <span className="text-[10px] text-muted-foreground">{a.projectCount}p</span>
                                <span className="text-[10px] text-muted-foreground">{Number(a.totalUnits).toLocaleString()}u</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
