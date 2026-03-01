import { ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

export interface BreadcrumbItem {
    label: string;
    path?: string;
}

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    breadcrumbs?: BreadcrumbItem[];
    actions?: React.ReactNode;
}

/**
 * Consistent page header with breadcrumbs, title, and optional actions.
 * Usage:
 *   <PageHeader
 *     title="DLD Area Insights"
 *     description="UAE market benchmarks by area"
 *     icon={MapPin}
 *     breadcrumbs={[{ label: "Market" }, { label: "DLD Insights" }]}
 *     actions={<Button>Export</Button>}
 *   />
 */
export function PageHeader({ title, description, icon: Icon, breadcrumbs, actions }: PageHeaderProps) {
    const [, setLocation] = useLocation();

    return (
        <div className="space-y-2 mb-6">
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
                    <button
                        onClick={() => setLocation("/dashboard")}
                        className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                        <Home className="h-3 w-3" />
                        <span>Home</span>
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                            <ChevronRight className="h-3 w-3 opacity-50" />
                            {crumb.path ? (
                                <button
                                    onClick={() => setLocation(crumb.path!)}
                                    className="hover:text-foreground transition-colors"
                                >
                                    {crumb.label}
                                </button>
                            ) : (
                                <span className="text-foreground/70">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}

            {/* Title bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    {Icon && (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
                        {description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                        )}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
        </div>
    );
}
