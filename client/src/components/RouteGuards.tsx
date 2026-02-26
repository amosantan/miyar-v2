import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

/**
 * Route guard: redirects unauthenticated users to /login.
 * Wrap any <Route> that requires a logged-in user.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth({ redirectOnUnauthenticated: true });

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user) return null; // redirect already triggered by useAuth

    return <>{children}</>;
}

/**
 * Route guard: requires admin role. Non-admins redirected to /dashboard.
 * Must be nested inside <RequireAuth>.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!user || (user as any).role !== "admin") {
        // Redirect non-admins to dashboard
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
            window.location.href = "/dashboard";
        }
        return null;
    }

    return <>{children}</>;
}
