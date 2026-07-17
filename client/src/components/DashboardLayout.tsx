import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  BarChart3,
  Building2,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { CommandPalette } from "./CommandPalette";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { NotificationBell } from "./NotificationBell";
import { OnboardingFlow } from "./OnboardingFlow";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "@/lib/i18n";

const navigation = [
  { label: "Overview", key: "nav.overview", path: "/dashboard", icon: LayoutDashboard, matches: ["/dashboard", "/alerts"] },
  { label: "Projects", key: "nav.projects", path: "/projects", icon: FolderKanban, matches: ["/projects", "/results", "/scenarios"] },
  { label: "Portfolio", key: "nav.portfolio", path: "/portfolio", icon: BarChart3, matches: ["/portfolio", "/reports", "/risk-heatmap", "/bias-insights", "/simulations", "/customer-success"] },
  { label: "Market", key: "nav.market", path: "/market-intel/dld-insights", icon: Building2, matches: ["/market-intel/dld-insights", "/market-intel/competitors"] },
] as const;

function isActive(location: string, matches: readonly string[]) {
  return matches.some((path) => location === path || location.startsWith(`${path}/`));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="font-serif text-3xl text-foreground">MIYAR</p>
          <p className="mt-1 text-sm text-muted-foreground">مِعيار — Decision intelligence</p>
          <h1 className="mt-8 text-xl font-semibold">Sign in to continue</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Review projects, evidence and decisions for your organization.
          </p>
          <Button className="mt-6 w-full" onClick={() => { window.location.href = getLoginUrl(); }}>
            Sign in
          </Button>
        </section>
      </main>
    );
  }

  const current = navigation.find((item) => isActive(location, item.matches));
  const projectMatch = location.match(/^\/projects\/(\d+)/);
  const pageLabel = projectMatch ? "Project workspace" : current ? t(current.key, current.label) : "MIYAR";

  return (
    <div className="min-h-screen bg-background text-foreground" data-app-shell>
      <aside data-main-sidebar className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <button className="flex h-20 items-center gap-3 px-6 text-left" onClick={() => setLocation("/dashboard")}>
          <span className="font-serif text-2xl tracking-tight">MIYAR</span>
          <span className="text-xs text-muted-foreground">مِعيار</span>
        </button>

        <nav className="flex-1 px-3" aria-label="Primary navigation">
          <Button className="mb-5 w-full justify-start gap-2" onClick={() => setLocation("/projects/new")}>
            <Plus className="h-4 w-4" /> {t("nav.newProject", "New Project")}
          </Button>
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(location, item.matches);
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`}
                >
                  <item.icon className="h-4 w-4" /> {t(item.key, item.label)}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-3">
          {user.role === "admin" && (
            <button
              onClick={() => setLocation("/admin")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
            >
              <Settings2 className="h-4 w-4" /> {t("nav.controlCenter", "Control center")}
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <Avatar className="h-9 w-9 border border-sidebar-border">
                  <AvatarFallback>{user.name?.charAt(0).toUpperCase() || "M"}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user.name || "MIYAR user"}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div data-main-content className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div>
            <span className="font-serif text-lg lg:hidden">MIYAR</span>
            <span className="hidden text-sm font-semibold lg:block">{pageLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground hover:bg-secondary md:flex"
              aria-label="Search MIYAR"
            >
              <Search className="h-3.5 w-3.5" /> Search <kbd className="rounded bg-muted px-1.5 py-0.5">⌘K</kbd>
            </button>
            <ThemeToggle compact />
            <LanguageToggle compact />
            <AiAssistantPanel />
            <NotificationBell />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 pb-24 md:px-6 md:py-7 lg:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Mobile navigation" data-mobile-nav>
        {navigation.slice(0, 2).map((item) => <MobileItem key={item.path} item={item} location={location} navigate={setLocation} label={t(item.key, item.label)} />)}
        <button onClick={() => setLocation("/projects/new")} className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-primary" aria-label="New Project">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground"><Plus className="h-5 w-5" /></span>
          New
        </button>
        {navigation.slice(2).map((item) => <MobileItem key={item.path} item={item} location={location} navigate={setLocation} label={t(item.key, item.label)} />)}
      </nav>

      <CommandPalette />
      <OnboardingFlow />
    </div>
  );
}

function MobileItem({ item, location, navigate, label }: { item: (typeof navigation)[number]; location: string; navigate: (path: string) => void; label: string }) {
  const active = isActive(location, item.matches);
  return (
    <button onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
      <item.icon className="h-5 w-5" /> {label}
    </button>
  );
}
