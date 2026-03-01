import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireAuth, RequireAdmin } from "./components/RouteGuards";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";
import Results from "./pages/Results";
import Scenarios from "./pages/Scenarios";
import ScenarioTemplates from "./pages/ScenarioTemplates";
import Reports from "./pages/Reports";
import EvidenceVault from "./pages/EvidenceVault";
import DesignBrief from "./pages/DesignBrief";
import DesignStudio from "./pages/DesignStudio";
import Collaboration from "./pages/Collaboration";
import Benchmarks from "./pages/admin/Benchmarks";
import BenchmarkVersions from "./pages/admin/BenchmarkVersions";
import BenchmarkCategories from "./pages/admin/BenchmarkCategories";
import ModelVersions from "./pages/admin/ModelVersions";
import AuditLogs from "./pages/admin/AuditLogs";
import Overrides from "./pages/admin/Overrides";
import BenchmarkHealth from "./pages/admin/BenchmarkHealth";
import ConnectorHealth from "./pages/admin/ConnectorHealth";
import Portfolio from "./pages/admin/Portfolio";
import RoiConfig from "./pages/admin/RoiConfig";
import Webhooks from "./pages/admin/Webhooks";
import CsvImport from "./pages/admin/CsvImport";
import MaterialsLibrary from "./pages/admin/MaterialsLibrary";
import PromptTemplates from "./pages/admin/PromptTemplates";
import LogicRegistry from "./pages/admin/LogicRegistry";
import Calibration from "./pages/admin/Calibration";
import BenchmarkLearning from "./pages/admin/BenchmarkLearning";
import LearningDashboard from "./pages/admin/LearningDashboard";
import Explainability from "./pages/Explainability";
import ScenarioComparison from "./pages/ScenarioComparison";
import Outcomes from "./pages/Outcomes";
import EvidenceVaultMI from "./pages/market-intel/EvidenceVaultMI";
import SourceRegistry from "./pages/market-intel/SourceRegistry";
import BenchmarkProposals from "./pages/market-intel/BenchmarkProposals";
import CompetitorsMI from "./pages/market-intel/Competitors";
import TrendTags from "./pages/market-intel/TrendTags";
import IntelAuditLog from "./pages/market-intel/IntelAuditLog";
import IngestionMonitor from "./pages/market-intel/IngestionMonitor";
import AnalyticsDashboard from "./pages/market-intel/AnalyticsDashboard";
import DataHealth from "./pages/market-intel/DataHealth";
import DldInsights from "./pages/market-intel/DldInsights";
import MarketIntelligence from "./pages/market-intel/MarketIntelligence";
import Alerts from "./pages/Alerts";
import DesignAdvisor from "./pages/DesignAdvisor";
import PortfolioPage from "./pages/PortfolioPage";
import RiskHeatmap from "./pages/RiskHeatmap";
import BiasInsights from "./pages/BiasInsights";
import Simulations from "./pages/Simulations";
import CustomerSuccess from "./pages/CustomerSuccess";
import Sustainability from "./pages/Sustainability";
import InvestorSummary from "./pages/InvestorSummary";
import ShareView from "./pages/ShareView";
import BriefEditor from "./pages/BriefEditor";
import Methodology from "./pages/Methodology";
import AreaVerification from "./pages/AreaVerification";
import SpacePlanner from "./pages/SpacePlanner";

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
      <Route path="/dashboard">{() => <Protected Component={Dashboard} />}</Route>
      <Route path="/projects">{() => <Protected Component={Projects} />}</Route>
      <Route path="/projects/new">{() => <Protected Component={ProjectNew} />}</Route>
      <Route path="/projects/:id">{() => <ProjectPage Component={ProjectDetail} />}</Route>
      <Route path="/projects/:id/evidence">{() => <ProjectPage Component={EvidenceVault} />}</Route>
      <Route path="/projects/:id/brief">{() => <ProjectPage Component={DesignBrief} />}</Route>
      <Route path="/projects/:id/design-studio">{() => <ProjectPage Component={DesignStudio} />}</Route>
      <Route path="/projects/:id/collaboration">{() => <ProjectPage Component={Collaboration} />}</Route>
      <Route path="/projects/:id/design-advisor">{() => <ProjectPage Component={DesignAdvisor} />}</Route>
      <Route path="/projects/:id/investor-summary">{() => <ProjectPage Component={InvestorSummary} />}</Route>
      <Route path="/projects/:id/brief-editor">{() => <ProjectPage Component={BriefEditor} />}</Route>
      <Route path="/projects/:id/explainability">{() => <ProjectPage Component={Explainability} />}</Route>
      <Route path="/projects/:id/outcomes">{() => <ProjectPage Component={Outcomes} />}</Route>
      <Route path="/projects/:id/verify-areas">{() => <ProjectPage Component={AreaVerification} />}</Route>
      <Route path="/projects/:id/space-planner">{() => <ProjectPage Component={SpacePlanner} />}</Route>
      <Route path="/results">{() => <Protected Component={Results} />}</Route>
      <Route path="/scenarios">{() => <Protected Component={Scenarios} />}</Route>
      <Route path="/scenarios/templates">{() => <Protected Component={ScenarioTemplates} />}</Route>
      <Route path="/scenarios/compare">{() => <Protected Component={ScenarioComparison} />}</Route>
      <Route path="/reports">{() => <Protected Component={Reports} />}</Route>
      <Route path="/alerts">{() => <Protected Component={Alerts} />}</Route>
      <Route path="/portfolio">{() => <Protected Component={PortfolioPage} />}</Route>
      <Route path="/risk-heatmap">{() => <Protected Component={RiskHeatmap} />}</Route>
      <Route path="/bias-insights">{() => <Protected Component={BiasInsights} />}</Route>
      <Route path="/simulations">{() => <Protected Component={Simulations} />}</Route>
      <Route path="/customer-success">{() => <Protected Component={CustomerSuccess} />}</Route>
      <Route path="/sustainability">{() => <Protected Component={Sustainability} />}</Route>

      {/* Market Intelligence — client-facing */}
      <Route path="/market-intel/dld-insights">{() => <Protected Component={DldInsights} />}</Route>
      <Route path="/market-intel/competitors">{() => <Protected Component={CompetitorsMI} />}</Route>

      {/* Market Intelligence — admin-only internal tools */}
      <Route path="/market-intel/evidence">{() => <AdminOnly Component={EvidenceVaultMI} />}</Route>
      <Route path="/market-intel/sources">{() => <AdminOnly Component={SourceRegistry} />}</Route>
      <Route path="/market-intel/proposals">{() => <AdminOnly Component={BenchmarkProposals} />}</Route>
      <Route path="/market-intel/tags">{() => <AdminOnly Component={TrendTags} />}</Route>
      <Route path="/market-intel/audit">{() => <AdminOnly Component={IntelAuditLog} />}</Route>
      <Route path="/market-intel/data-health">{() => <AdminOnly Component={DataHealth} />}</Route>
      <Route path="/market-intel/ingestion">{() => <AdminOnly Component={IngestionMonitor} />}</Route>
      <Route path="/market-intel/analytics">{() => <AdminOnly Component={AnalyticsDashboard} />}</Route>
      <Route path="/market-intelligence">{() => <AdminOnly Component={MarketIntelligence} />}</Route>

      {/* Admin routes (admin-only) */}
      <Route path="/admin/benchmarks">{() => <AdminOnly Component={Benchmarks} />}</Route>
      <Route path="/admin/benchmark-versions">{() => <AdminOnly Component={BenchmarkVersions} />}</Route>
      <Route path="/admin/benchmark-categories">{() => <AdminOnly Component={BenchmarkCategories} />}</Route>
      <Route path="/admin/models">{() => <AdminOnly Component={ModelVersions} />}</Route>
      <Route path="/admin/audit">{() => <AdminOnly Component={AuditLogs} />}</Route>
      <Route path="/admin/overrides">{() => <AdminOnly Component={Overrides} />}</Route>
      <Route path="/admin/benchmark-health">{() => <AdminOnly Component={BenchmarkHealth} />}</Route>
      <Route path="/admin/connector-health">{() => <AdminOnly Component={ConnectorHealth} />}</Route>
      <Route path="/admin/portfolio">{() => <AdminOnly Component={Portfolio} />}</Route>
      <Route path="/admin/roi-config">{() => <AdminOnly Component={RoiConfig} />}</Route>
      <Route path="/admin/webhooks">{() => <AdminOnly Component={Webhooks} />}</Route>
      <Route path="/admin/csv-import">{() => <AdminOnly Component={CsvImport} />}</Route>
      <Route path="/admin/materials">{() => <AdminOnly Component={MaterialsLibrary} />}</Route>
      <Route path="/admin/prompt-templates">{() => <AdminOnly Component={PromptTemplates} />}</Route>
      <Route path="/admin/logic-registry">{() => <AdminOnly Component={LogicRegistry} />}</Route>
      <Route path="/admin/calibration">{() => <AdminOnly Component={Calibration} />}</Route>
      <Route path="/admin/benchmark-learning">{() => <AdminOnly Component={BenchmarkLearning} />}</Route>
      <Route path="/admin/learning-dashboard">{() => <AdminOnly Component={LearningDashboard} />}</Route>

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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
