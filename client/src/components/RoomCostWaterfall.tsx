import React, { useMemo } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// If formatAed isn't in utils, define a local fallback helper
const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M AED`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K AED`;
    return `${amount.toLocaleString()} AED`;
};

export interface SpaceBudgetData {
    name: string;
    budget: number;
}

interface RoomCostWaterfallProps {
    data: SpaceBudgetData[];
    totalBudget: number;
}

export default function RoomCostWaterfall({ data, totalBudget }: RoomCostWaterfallProps) {
    const chartData = useMemo(() => {
        let cumulative = 0;
        const items = data.map((space) => {
            const start = cumulative;
            cumulative += space.budget;
            return {
                name: space.name,
                start,
                end: cumulative,
                value: space.budget,
                isTotal: false,
            };
        });

        // Add the final "Total" bar
        items.push({
            name: "Total Fitout",
            start: 0,
            end: totalBudget,
            value: totalBudget,
            isTotal: true,
        });

        return items;
    }, [data, totalBudget]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div className="bg-[#0f172a] border border-slate-800 p-3 rounded-lg shadow-xl text-sm min-w-[150px]">
                    <p className="font-semibold text-slate-200 mb-1">{dataPoint.name}</p>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-400">Cost:</span>
                        <span className="text-amber-400 font-mono font-medium">
                            {formatCurrency(dataPoint.value)}
                        </span>
                    </div>
                    {!dataPoint.isTotal && (
                        <div className="flex justify-between gap-4 mt-1">
                            <span className="text-slate-400">% of Total:</span>
                            <span className="text-slate-300 font-mono">
                                {((dataPoint.value / totalBudget) * 100).toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="w-full bg-[#0B1120] border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-200">
                    Room Cost Waterfall
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                    Cumulative buildup of fitout costs across programmed spaces
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 20, right: 20, left: 20, bottom: 40 }}
                        >
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 11 }}
                                angle={-45}
                                textAnchor="end"
                                interval={0}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 11 }}
                                tickFormatter={(val) => {
                                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                                    return val.toString();
                                }}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                            {/* Invisible bar to push the visible part up to 'start' */}
                            <Bar dataKey="start" stackId="stack" fill="transparent" />
                            {/* Visible bar for the value */}
                            <Bar
                                dataKey="value"
                                stackId="stack"
                                radius={[4, 4, 0, 0]}
                                animationDuration={1500}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.isTotal ? "#3b82f6" : "#f59e0b"} // Blue for total, Amber/Gold for steps
                                        className={
                                            entry.isTotal
                                                ? "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                                : "drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
