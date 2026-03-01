import { Skeleton } from "./ui/skeleton";

interface PageSkeletonProps {
    /** Number of stat cards to show */
    statCards?: number;
    /** Show a table skeleton */
    showTable?: boolean;
    /** Show a large content area */
    showContent?: boolean;
}

/**
 * Reusable page loading skeleton. Matches the PageHeader + content pattern.
 * Usage:
 *   if (isLoading) return <PageSkeleton statCards={3} showTable />;
 */
export function PageSkeleton({ statCards = 0, showTable = false, showContent = true }: PageSkeletonProps) {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-3 w-32" /> {/* breadcrumbs */}
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" /> {/* icon */}
                    <div className="space-y-1.5">
                        <Skeleton className="h-6 w-48" /> {/* title */}
                        <Skeleton className="h-4 w-72" /> {/* description */}
                    </div>
                </div>
            </div>

            {/* Stat cards */}
            {statCards > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: statCards }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
            )}

            {/* Table skeleton */}
            {showTable && (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-lg" /> {/* header row */}
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                    ))}
                </div>
            )}

            {/* Content block */}
            {showContent && (
                <div className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-32 rounded-xl" />
                        <Skeleton className="h-32 rounded-xl" />
                    </div>
                </div>
            )}
        </div>
    );
}
