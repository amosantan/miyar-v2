import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
    LayoutDashboard, FolderKanban, PlusCircle, BarChart3,
    GitCompare, FileText, PieChart, Shield, Brain, Dices,
    HeartPulse, Leaf, Globe, BookOpen, Search, Settings,
    Database, Zap, TrendingUp,
} from "lucide-react";

interface CommandItem {
    id: string;
    label: string;
    category: string;
    path: string;
    icon: React.FC<{ className?: string }>;
    keywords?: string[];
}

const COMMANDS: CommandItem[] = [
    // Navigation
    { id: "dashboard", label: "Dashboard", category: "Navigation", path: "/dashboard", icon: LayoutDashboard },
    { id: "projects", label: "Projects", category: "Navigation", path: "/projects", icon: FolderKanban },
    { id: "new-project", label: "New Project", category: "Navigation", path: "/projects/new", icon: PlusCircle, keywords: ["create", "add"] },
    // Analysis
    { id: "results", label: "Results", category: "Analysis", path: "/results", icon: BarChart3, keywords: ["scores", "evaluation"] },
    { id: "scenarios", label: "Scenarios", category: "Analysis", path: "/scenarios", icon: GitCompare, keywords: ["compare", "what-if"] },
    { id: "reports", label: "Reports", category: "Analysis", path: "/reports", icon: FileText, keywords: ["pdf", "export"] },
    { id: "portfolio", label: "Portfolio", category: "Analysis", path: "/portfolio", icon: PieChart, keywords: ["overview"] },
    { id: "risk", label: "Risk Heatmap", category: "Analysis", path: "/risk-heatmap", icon: Shield, keywords: ["stress", "risk"] },
    { id: "bias", label: "Bias Insights", category: "Analysis", path: "/bias-insights", icon: Brain, keywords: ["cognitive", "anchoring"] },
    { id: "simulations", label: "Monte Carlo Simulations", category: "Analysis", path: "/simulations", icon: Dices, keywords: ["monte carlo", "probability"] },
    { id: "health", label: "Customer Success", category: "Analysis", path: "/customer-success", icon: HeartPulse, keywords: ["health", "score"] },
    { id: "sustainability", label: "Sustainability", category: "Analysis", path: "/sustainability", icon: Leaf, keywords: ["carbon", "green", "twin"] },
    // Market Intelligence
    { id: "evidence", label: "Evidence Vault", category: "Market Intel", path: "/market-intel/evidence", icon: Globe },
    { id: "sources", label: "Source Registry", category: "Market Intel", path: "/market-intel/sources", icon: BookOpen },
    { id: "competitors", label: "Competitors", category: "Market Intel", path: "/market-intel/competitors", icon: Search, keywords: ["competition"] },
    { id: "analytics", label: "Analytics Intelligence", category: "Market Intel", path: "/market-intel/analytics", icon: TrendingUp },
    { id: "ingestion", label: "Ingestion Monitor", category: "Market Intel", path: "/market-intel/ingestion", icon: Zap },
    // Admin
    { id: "benchmarks", label: "Benchmarks", category: "Admin", path: "/admin/benchmarks", icon: Database },
    { id: "settings", label: "Model Versions", category: "Admin", path: "/admin/models", icon: Settings },
];

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [, setLocation] = useLocation();

    // Keyboard shortcut: Cmd+K / Ctrl+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
                setQuery("");
                setSelectedIndex(0);
            }
            if (e.key === "Escape" && open) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Filter commands
    const filtered = useMemo(() => {
        if (!query.trim()) return COMMANDS;
        const q = query.toLowerCase();
        return COMMANDS.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(q) ||
                cmd.category.toLowerCase().includes(q) ||
                cmd.keywords?.some((kw) => kw.includes(q))
        );
    }, [query]);

    // Reset index when filtered list changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [filtered.length]);

    // Navigate on select
    const handleSelect = useCallback(
        (cmd: CommandItem) => {
            setLocation(cmd.path);
            setOpen(false);
            setQuery("");
        },
        [setLocation]
    );

    // Arrow keys + Enter
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && filtered[selectedIndex]) {
                e.preventDefault();
                handleSelect(filtered[selectedIndex]);
            }
        },
        [filtered, selectedIndex, handleSelect]
    );

    // Scroll selected item into view
    useEffect(() => {
        const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
        el?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (!open) return null;

    // Group by category
    const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
        (acc[cmd.category] ??= []).push(cmd);
        return acc;
    }, {});

    let flatIndex = 0;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                onClick={() => setOpen(false)}
            />

            {/* Dialog */}
            <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[20vh]">
                <div className="w-full max-w-lg rounded-xl border bg-popover shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                    {/* Search input */}
                    <div className="flex items-center gap-3 border-b px-4 py-3">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a command or search..."
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
                        {filtered.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No results found.
                            </div>
                        ) : (
                            Object.entries(grouped).map(([category, items]) => (
                                <div key={category}>
                                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                        {category}
                                    </div>
                                    {items.map((cmd) => {
                                        const idx = flatIndex++;
                                        return (
                                            <button
                                                key={cmd.id}
                                                onClick={() => handleSelect(cmd)}
                                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${idx === selectedIndex
                                                        ? "bg-accent text-accent-foreground"
                                                        : "hover:bg-accent/50"
                                                    }`}
                                            >
                                                <cmd.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span>{cmd.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between border-t px-4 py-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↑↓</kbd>
                            <span>Navigate</span>
                            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↵</kbd>
                            <span>Open</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}
