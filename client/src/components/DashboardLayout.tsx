import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  FolderKanban,
  PlusCircle,
  BarChart3,
  GitCompare,
  FileText,
  Settings,
  Database,
  Shield,
  ClipboardList,
  HeartPulse,
  Wand2,
  GitBranch,
  Layers,
  DollarSign,
  Webhook,
  PieChart,
  FileSpreadsheet,
  FolderOpen,
  Palette,
  Camera,
  Package,
  MessageSquare,
  Sparkles,
  Brain,
  Sliders,
  Lightbulb,
  Search,
  Target,
  Scale,
  Globe,
  FileCheck,
  Building2,
  Tags,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: PlusCircle, label: "New Project", path: "/projects/new" },
];

const analysisItems = [
  { icon: BarChart3, label: "Results", path: "/results" },
  { icon: GitCompare, label: "Scenarios", path: "/scenarios" },
  { icon: Wand2, label: "Scenario Templates", path: "/scenarios/templates" },
  { icon: Scale, label: "Scenario Comparison", path: "/scenarios/compare" },
  { icon: FileText, label: "Reports", path: "/reports" },
];

const designItems = [
  { icon: FolderOpen, label: "Evidence Vault", path: "/projects/:id/evidence", dynamic: true },
  { icon: Palette, label: "Design Brief", path: "/projects/:id/brief", dynamic: true },
  { icon: Camera, label: "Visual Studio", path: "/projects/:id/visuals", dynamic: true },
  { icon: Package, label: "Board Composer", path: "/projects/:id/boards", dynamic: true },
  { icon: MessageSquare, label: "Collaboration", path: "/projects/:id/collaboration", dynamic: true },
  { icon: Search, label: "Explainability", path: "/projects/:id/explainability", dynamic: true },
  { icon: Target, label: "Outcomes", path: "/projects/:id/outcomes", dynamic: true },
];

const marketIntelItems = [
  { icon: Globe, label: "Evidence Vault", path: "/market-intel/evidence" },
  { icon: BookOpen, label: "Source Registry", path: "/market-intel/sources" },
  { icon: FileCheck, label: "Benchmark Proposals", path: "/market-intel/proposals" },
  { icon: Building2, label: "Competitors", path: "/market-intel/competitors" },
  { icon: Tags, label: "Trend Tags", path: "/market-intel/tags" },
  { icon: ScrollText, label: "Intel Audit Log", path: "/market-intel/audit" },
];

const adminItems = [
  { icon: Database, label: "Benchmarks", path: "/admin/benchmarks" },
  { icon: GitBranch, label: "Benchmark Versions", path: "/admin/benchmark-versions" },
  { icon: Layers, label: "Benchmark Categories", path: "/admin/benchmark-categories" },
  { icon: Settings, label: "Model Versions", path: "/admin/models" },
  { icon: DollarSign, label: "ROI Config", path: "/admin/roi-config" },
  { icon: Webhook, label: "Webhooks", path: "/admin/webhooks" },
  { icon: PieChart, label: "Portfolio", path: "/admin/portfolio" },
  { icon: ClipboardList, label: "Audit Logs", path: "/admin/audit" },
  { icon: Shield, label: "Overrides", path: "/admin/overrides" },
  { icon: FileSpreadsheet, label: "CSV Import", path: "/admin/csv-import" },
  { icon: HeartPulse, label: "Benchmark Health", path: "/admin/benchmark-health" },
  { icon: Sparkles, label: "Materials Library", path: "/admin/materials" },
  { icon: Wand2, label: "Prompt Templates", path: "/admin/prompt-templates" },
  { icon: Brain, label: "Logic Registry", path: "/admin/logic-registry" },
  { icon: Sliders, label: "Calibration", path: "/admin/calibration" },
  { icon: Lightbulb, label: "Benchmark Learning", path: "/admin/benchmark-learning" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="text-3xl font-bold tracking-tight text-primary">
              MIYAR
            </div>
            <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
              Decision Intelligence
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-center text-foreground">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access the MIYAR platform to validate interior design directions
              with data-driven intelligence.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const allItems = [...menuItems, ...analysisItems, ...adminItems];
  const activeMenuItem = allItems.find((item) => location.startsWith(item.path));
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold tracking-tight text-primary text-lg">
                    MIYAR
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {/* Main Navigation */}
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Analysis Section */}
            {!isCollapsed && (
              <div className="px-4 pt-4 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Analysis
                </span>
              </div>
            )}
            <SidebarMenu className="px-2 py-1">
              {analysisItems.map((item) => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Design Enablement Section — shows when on a project page */}
            {(() => {
              const projectMatch = location.match(/\/projects\/(\d+)/);
              if (!projectMatch) return null;
              const pid = projectMatch[1];
              return (
                <>
                  {!isCollapsed && (
                    <div className="px-4 pt-4 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                        Design Enablement
                      </span>
                    </div>
                  )}
                  <SidebarMenu className="px-2 py-1">
                    {designItems.map((item) => {
                      const resolvedPath = item.path.replace(":id", pid);
                      const isActive = location === resolvedPath;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(resolvedPath)}
                            tooltip={item.label}
                            className="h-10 transition-all font-normal"
                          >
                            <item.icon
                              className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                            />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </>
              );
            })()}

            {/* Market Intelligence Section */}
            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 pt-4 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Market Intelligence
                    </span>
                  </div>
                )}
                <SidebarMenu className="px-2 py-1">
                  {marketIntelItems.map((item) => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-10 transition-all font-normal"
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}

            {/* Admin Section */}
            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 pt-4 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Administration
                    </span>
                  </div>
                )}
                <SidebarMenu className="px-2 py-1">
                  {adminItems.map((item) => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-10 transition-all font-normal"
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/20 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <span className="tracking-tight text-foreground">
                  {activeMenuItem?.label ?? "MIYAR"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
