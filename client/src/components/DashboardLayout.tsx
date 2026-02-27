import { useAuth } from "@/_core/hooks/useAuth";
import { NotificationBell } from "./NotificationBell";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { AdminSystemHealthMenu } from "./AdminSystemHealthMenu";
import { CommandPalette } from "./CommandPalette";
import { OnboardingFlow } from "./OnboardingFlow";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  Activity,
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
  Zap,
  TrendingUp,
  Dices,
  Leaf,
  MapPin,
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
  { icon: PieChart, label: "Portfolio", path: "/portfolio" },
  { icon: Shield, label: "Risk Heatmap", path: "/risk-heatmap" },
  { icon: Brain, label: "Bias Insights", path: "/bias-insights" },
  { icon: Dices, label: "Simulations", path: "/simulations" },
  { icon: HeartPulse, label: "Customer Success", path: "/customer-success" },
  { icon: Leaf, label: "Sustainability", path: "/sustainability" },
];

const designItems = [
  { icon: Sparkles, label: "AI Design Advisor", path: "/projects/:id/design-advisor", dynamic: true },
  { icon: FolderOpen, label: "Evidence Vault", path: "/projects/:id/evidence", dynamic: true },
  { icon: Palette, label: "Design Brief", path: "/projects/:id/brief", dynamic: true },
  { icon: Layers, label: "Design Studio", path: "/projects/:id/design-studio", dynamic: true },
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
  { icon: HeartPulse, label: "Data Health", path: "/market-intel/data-health" },
  { icon: Zap, label: "Ingestion Monitor", path: "/market-intel/ingestion" },
  { icon: TrendingUp, label: "Analytics Intelligence", path: "/market-intel/analytics" },
  { icon: MapPin, label: "DLD Insights", path: "/market-intel/dld-insights" },
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
  { icon: Activity, label: "Connector Health", path: "/admin/connector-health" },
  { icon: Sparkles, label: "Materials Library", path: "/admin/materials" },
  { icon: Wand2, label: "Prompt Templates", path: "/admin/prompt-templates" },
  { icon: Brain, label: "Logic Registry", path: "/admin/logic-registry" },
  { icon: Sliders, label: "Calibration", path: "/admin/calibration" },
  { icon: Lightbulb, label: "Benchmark Learning", path: "/admin/benchmark-learning" },
  { icon: BarChart3, label: "Learning Dashboard", path: "/admin/learning-dashboard" },
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
      <div className="flex items-center justify-center min-h-screen bg-[#0A1628]">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="text-3xl font-bold tracking-tight text-gold-gradient">
              MIYAR
            </div>
            <p className="text-xs tracking-[0.3em] uppercase text-[#8B9CB7]">
              مِعيار — Design Intelligence
            </p>
          </div>
          <div className="glass-card rounded-2xl p-8 w-full">
            <div className="flex flex-col items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-center text-[#F0EBE3]">
                Sign in to continue
              </h1>
              <p className="text-sm text-[#8B9CB7] text-center max-w-sm">
                Access the MIYAR platform to validate interior design directions
                with data-driven intelligence.
              </p>
            </div>
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full mt-6 bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold shadow-lg shadow-[#C9A96E]/20 hover:shadow-[#C9A96E]/30 transition-all"
            >
              Sign in
            </Button>
          </div>
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
                className="h-8 w-8 flex items-center justify-center hover:bg-[#C9A96E]/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]/30 shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-[#8B9CB7]" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold tracking-tight text-gold-gradient text-lg">
                    MIYAR
                  </span>
                  <span className="text-[9px] tracking-[0.2em] text-[#8B9CB7]/60 uppercase">مِعيار</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* Main Navigation */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
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
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Analysis Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Analysis</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {analysisItems.map((item) => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
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
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Design Enablement Section — shows when on a project page */}
            {(() => {
              const projectMatch = location.match(/\/projects\/(\d+)/);
              if (!projectMatch) return null;
              const pid = projectMatch[1];
              return (
                <SidebarGroup>
                  <SidebarGroupLabel>Design Enablement</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {designItems.map((item) => {
                        const resolvedPath = item.path.replace(":id", pid);
                        const isActive = location === resolvedPath;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(resolvedPath)}
                              tooltip={item.label}
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
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })()}

            {/* Market Intelligence Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Market Intelligence</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {marketIntelItems.map((item) => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
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
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Admin Section */}
            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => {
                      const isActive = location.startsWith(item.path);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={item.label}
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
                </SidebarGroupContent>
              </SidebarGroup>
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
        <div className="flex border-b border-[#1E2D42] h-14 items-center justify-between bg-[#0A1628]/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile || isCollapsed ? (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-[#111827]" />
            ) : null}
            <div className="flex items-center gap-3">
              <span className="tracking-tight text-[#F0EBE3] font-medium">
                {activeMenuItem?.label ?? "MIYAR"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Cmd+K shortcut hint */}
            <button
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
              }}
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[#1E2D42] bg-[#111827]/50 px-3 py-1.5 text-xs text-[#8B9CB7] hover:bg-[#C9A96E]/10 hover:border-[#C9A96E]/30 hover:text-[#C9A96E] transition-colors"
            >
              <Search className="h-3 w-3" />
              <span>Search</span>
              <kbd className="ml-1 rounded border border-[#1E2D42] bg-[#0A1628] px-1 font-mono text-[10px]">⌘K</kbd>
            </button>
            {isAdmin && <AdminSystemHealthMenu />}
            <AiAssistantPanel />
            <NotificationBell />
          </div>
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>

      {/* Global overlays */}
      <CommandPalette />
      <OnboardingFlow />
    </>
  );
}
