import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireAuth, RequireAdmin } from "./components/RouteGuards";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Route-level splitting keeps specialist editors, admin tooling, and visualization
// dependencies out of the initial application payload.
const NotFound = lazy(() => import("@/pages/NotFound"));
const DashboardLayout = lazy(() => import("@/components/DashboardLayout"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectNew = lazy(() => import("./pages/ProjectNew"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Results = lazy(() => import("./pages/Results"));
const Scenarios = lazy(() => import("./pages/Scenarios"));
const ScenarioTemplates = lazy(() => import("./pages/ScenarioTemplates"));
const Reports = lazy(() => import("./pages/Reports"));
const EvidenceVault = lazy(() => import("./pages/EvidenceVault"));
const DesignBrief = lazy(() => import("./pages/DesignBrief"));
const DesignStudio = lazy(() => import("./pages/DesignStudio"));
const Collaboration = lazy(() => import("./pages/Collaboration"));
const Benchmarks = lazy(() => import("./pages/admin/Benchmarks"));
const BenchmarkVersions = lazy(() => import("./pages/admin/BenchmarkVersions"));
const BenchmarkCategories = lazy(
  () => import("./pages/admin/BenchmarkCategories")
);
const ModelVersions = lazy(() => import("./pages/admin/ModelVersions"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const Overrides = lazy(() => import("./pages/admin/Overrides"));
const BenchmarkHealth = lazy(() => import("./pages/admin/BenchmarkHealth"));
const ConnectorHealth = lazy(() => import("./pages/admin/ConnectorHealth"));
const Portfolio = lazy(() => import("./pages/admin/Portfolio"));
const RoiConfig = lazy(() => import("./pages/admin/RoiConfig"));
const Webhooks = lazy(() => import("./pages/admin/Webhooks"));
const CsvImport = lazy(() => import("./pages/admin/CsvImport"));
const MaterialsLibrary = lazy(() => import("./pages/admin/MaterialsLibrary"));
const PromptTemplates = lazy(() => import("./pages/admin/PromptTemplates"));
const LogicRegistry = lazy(() => import("./pages/admin/LogicRegistry"));
const Calibration = lazy(() => import("./pages/admin/Calibration"));
const BenchmarkLearning = lazy(() => import("./pages/admin/BenchmarkLearning"));
const LearningDashboard = lazy(() => import("./pages/admin/LearningDashboard"));
const Explainability = lazy(() => import("./pages/Explainability"));
const ScenarioComparison = lazy(() => import("./pages/ScenarioComparison"));
const Outcomes = lazy(() => import("./pages/Outcomes"));
const EvidenceVaultMI = lazy(
  () => import("./pages/market-intel/EvidenceVaultMI")
);
const SourceRegistry = lazy(
  () => import("./pages/market-intel/SourceRegistry")
);
const BenchmarkProposals = lazy(
  () => import("./pages/market-intel/BenchmarkProposals")
);
const CompetitorsMI = lazy(() => import("./pages/market-intel/Competitors"));
const TrendTags = lazy(() => import("./pages/market-intel/TrendTags"));
const IntelAuditLog = lazy(() => import("./pages/market-intel/IntelAuditLog"));
const IngestionMonitor = lazy(
  () => import("./pages/market-intel/IngestionMonitor")
);
const AnalyticsDashboard = lazy(
  () => import("./pages/market-intel/AnalyticsDashboard")
);
const DataHealth = lazy(() => import("./pages/market-intel/DataHealth"));
const DldInsights = lazy(() => import("./pages/market-intel/DldInsights"));
const MarketIntelligence = lazy(
  () => import("./pages/market-intel/MarketIntelligence")
);
const Alerts = lazy(() => import("./pages/Alerts"));
const DesignAdvisor = lazy(() => import("./pages/DesignAdvisor"));
const PortfolioPage = lazy(() => import("./pages/PortfolioPage"));
const RiskHeatmap = lazy(() => import("./pages/RiskHeatmap"));
const BiasInsights = lazy(() => import("./pages/BiasInsights"));
const Simulations = lazy(() => import("./pages/Simulations"));
const CustomerSuccess = lazy(() => import("./pages/CustomerSuccess"));
const Sustainability = lazy(() => import("./pages/Sustainability"));
const InvestorSummary = lazy(() => import("./pages/InvestorSummary"));
const ShareView = lazy(() => import("./pages/ShareView"));
const BriefEditor = lazy(() => import("./pages/BriefEditor"));
const Methodology = lazy(() => import("./pages/Methodology"));
const AreaVerification = lazy(() => import("./pages/AreaVerification"));
const SpacePlanner = lazy(() => import("./pages/SpacePlanner"));

// Helper: wrap a component with RequireAuth and DashboardLayout
function Protected({ Component }: { Component: React.ComponentType<any> }) {
  return (
    <RequireAuth>
      <DashboardLayout>
        <Component />
      </DashboardLayout>
    </RequireAuth>
  );
}

// Helper: wrap project sub-pages with an in-page error boundary
// so crashes don't show a blank "Unexpected Error" screen
function ProjectPage({ Component }: { Component: React.ComponentType<any> }) {
  return (
    <RequireAuth>
      <DashboardLayout>
        <PageErrorBoundary backLabel="Back to Projects" backHref="/projects">
          <Component />
        </PageErrorBoundary>
      </DashboardLayout>
    </RequireAuth>
  );
}

// Helper: wrap a component with RequireAuth + RequireAdmin and DashboardLayout
function AdminOnly({ Component }: { Component: React.ComponentType<any> }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <DashboardLayout>
          <Component />
        </DashboardLayout>
      </RequireAdmin>
    </RequireAuth>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/methodology" component={Methodology} />

      {/* Protected routes */}
      <Route path="/dashboard">
        {() => <Protected Component={Dashboard} />}
      </Route>
      <Route path="/projects">{() => <Protected Component={Projects} />}</Route>
      <Route path="/projects/new">
        {() => <Protected Component={ProjectNew} />}
      </Route>
      <Route path="/projects/:id">
        {() => <ProjectPage Component={ProjectDetail} />}
      </Route>
      <Route path="/projects/:id/evidence">
        {() => <ProjectPage Component={EvidenceVault} />}
      </Route>
      <Route path="/projects/:id/brief">
        {() => <ProjectPage Component={DesignBrief} />}
      </Route>
      <Route path="/projects/:id/design-studio">
        {() => <ProjectPage Component={DesignStudio} />}
      </Route>
      <Route path="/projects/:id/collaboration">
        {() => <ProjectPage Component={Collaboration} />}
      </Route>
      <Route path="/projects/:id/design-advisor">
        {() => <ProjectPage Component={DesignAdvisor} />}
      </Route>
      <Route path="/projects/:id/investor-summary">
        {() => <ProjectPage Component={InvestorSummary} />}
      </Route>
      <Route path="/projects/:id/brief-editor">
        {() => <ProjectPage Component={BriefEditor} />}
      </Route>
      <Route path="/projects/:id/explainability">
        {() => <ProjectPage Component={Explainability} />}
      </Route>
      <Route path="/projects/:id/outcomes">
        {() => <ProjectPage Component={Outcomes} />}
      </Route>
      <Route path="/projects/:id/verify-areas">
        {() => <ProjectPage Component={AreaVerification} />}
      </Route>
      <Route path="/projects/:id/space-planner">
        {() => <ProjectPage Component={SpacePlanner} />}
      </Route>
      <Route path="/results">{() => <Protected Component={Results} />}</Route>
      <Route path="/scenarios">
        {() => <Protected Component={Scenarios} />}
      </Route>
      <Route path="/scenarios/templates">
        {() => <Protected Component={ScenarioTemplates} />}
      </Route>
      <Route path="/scenarios/compare">
        {() => <Protected Component={ScenarioComparison} />}
      </Route>
      <Route path="/reports">{() => <Protected Component={Reports} />}</Route>
      <Route path="/alerts">{() => <Protected Component={Alerts} />}</Route>
      <Route path="/portfolio">
        {() => <Protected Component={PortfolioPage} />}
      </Route>
      <Route path="/risk-heatmap">
        {() => <Protected Component={RiskHeatmap} />}
      </Route>
      <Route path="/bias-insights">
        {() => <Protected Component={BiasInsights} />}
      </Route>
      <Route path="/simulations">
        {() => <Protected Component={Simulations} />}
      </Route>
      <Route path="/customer-success">
        {() => <Protected Component={CustomerSuccess} />}
      </Route>
      <Route path="/sustainability">
        {() => <Protected Component={Sustainability} />}
      </Route>

      {/* Market Intelligence — client-facing */}
      <Route path="/market-intel/dld-insights">
        {() => <Protected Component={DldInsights} />}
      </Route>
      <Route path="/market-intel/competitors">
        {() => <Protected Component={CompetitorsMI} />}
      </Route>

      {/* Market Intelligence — admin-only internal tools */}
      <Route path="/market-intel/evidence">
        {() => <AdminOnly Component={EvidenceVaultMI} />}
      </Route>
      <Route path="/market-intel/sources">
        {() => <AdminOnly Component={SourceRegistry} />}
      </Route>
      <Route path="/market-intel/proposals">
        {() => <AdminOnly Component={BenchmarkProposals} />}
      </Route>
      <Route path="/market-intel/tags">
        {() => <AdminOnly Component={TrendTags} />}
      </Route>
      <Route path="/market-intel/audit">
        {() => <AdminOnly Component={IntelAuditLog} />}
      </Route>
      <Route path="/market-intel/data-health">
        {() => <AdminOnly Component={DataHealth} />}
      </Route>
      <Route path="/market-intel/ingestion">
        {() => <AdminOnly Component={IngestionMonitor} />}
      </Route>
      <Route path="/market-intel/analytics">
        {() => <AdminOnly Component={AnalyticsDashboard} />}
      </Route>
      <Route path="/market-intelligence">
        {() => <AdminOnly Component={MarketIntelligence} />}
      </Route>

      {/* Admin routes (admin-only) */}
      <Route path="/admin/benchmarks">
        {() => <AdminOnly Component={Benchmarks} />}
      </Route>
      <Route path="/admin/benchmark-versions">
        {() => <AdminOnly Component={BenchmarkVersions} />}
      </Route>
      <Route path="/admin/benchmark-categories">
        {() => <AdminOnly Component={BenchmarkCategories} />}
      </Route>
      <Route path="/admin/models">
        {() => <AdminOnly Component={ModelVersions} />}
      </Route>
      <Route path="/admin/audit">
        {() => <AdminOnly Component={AuditLogs} />}
      </Route>
      <Route path="/admin/overrides">
        {() => <AdminOnly Component={Overrides} />}
      </Route>
      <Route path="/admin/benchmark-health">
        {() => <AdminOnly Component={BenchmarkHealth} />}
      </Route>
      <Route path="/admin/connector-health">
        {() => <AdminOnly Component={ConnectorHealth} />}
      </Route>
      <Route path="/admin/portfolio">
        {() => <AdminOnly Component={Portfolio} />}
      </Route>
      <Route path="/admin/roi-config">
        {() => <AdminOnly Component={RoiConfig} />}
      </Route>
      <Route path="/admin/webhooks">
        {() => <AdminOnly Component={Webhooks} />}
      </Route>
      <Route path="/admin/csv-import">
        {() => <AdminOnly Component={CsvImport} />}
      </Route>
      <Route path="/admin/materials">
        {() => <AdminOnly Component={MaterialsLibrary} />}
      </Route>
      <Route path="/admin/prompt-templates">
        {() => <AdminOnly Component={PromptTemplates} />}
      </Route>
      <Route path="/admin/logic-registry">
        {() => <AdminOnly Component={LogicRegistry} />}
      </Route>
      <Route path="/admin/calibration">
        {() => <AdminOnly Component={Calibration} />}
      </Route>
      <Route path="/admin/benchmark-learning">
        {() => <AdminOnly Component={BenchmarkLearning} />}
      </Route>
      <Route path="/admin/learning-dashboard">
        {() => <AdminOnly Component={LearningDashboard} />}
      </Route>

      {/* Fallback */}
      <Route path="/share/:token" component={ShareView} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Suspense
            fallback={
              <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
                Loading MIYAR…
              </div>
            }
          >
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
