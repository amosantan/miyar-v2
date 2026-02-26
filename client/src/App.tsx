import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireAuth, RequireAdmin } from "./components/RouteGuards";
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
import Alerts from "./pages/Alerts";
import DesignAdvisor from "./pages/DesignAdvisor";
import PortfolioPage from "./pages/PortfolioPage";
import RiskHeatmap from "./pages/RiskHeatmap";
import BiasInsights from "./pages/BiasInsights";
import Simulations from "./pages/Simulations";
import CustomerSuccess from "./pages/CustomerSuccess";
import Sustainability from "./pages/Sustainability";

// Helper: wrap a component with RequireAuth
function Protected({ Component }: { Component: React.ComponentType<any> }) {
  return (
    <RequireAuth>
      <Component />
    </RequireAuth>
  );
}

// Helper: wrap a component with RequireAuth + RequireAdmin
function AdminOnly({ Component }: { Component: React.ComponentType<any> }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <Component />
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

      {/* Protected routes */}
      <Route path="/dashboard">{() => <Protected Component={Dashboard} />}</Route>
      <Route path="/projects">{() => <Protected Component={Projects} />}</Route>
      <Route path="/projects/new">{() => <Protected Component={ProjectNew} />}</Route>
      <Route path="/projects/:id">{() => <Protected Component={ProjectDetail} />}</Route>
      <Route path="/projects/:id/evidence">{() => <Protected Component={EvidenceVault} />}</Route>
      <Route path="/projects/:id/brief">{() => <Protected Component={DesignBrief} />}</Route>
      <Route path="/projects/:id/design-studio">{() => <Protected Component={DesignStudio} />}</Route>
      <Route path="/projects/:id/collaboration">{() => <Protected Component={Collaboration} />}</Route>
      <Route path="/projects/:id/design-advisor">{() => <Protected Component={DesignAdvisor} />}</Route>
      <Route path="/projects/:id/explainability">{() => <Protected Component={Explainability} />}</Route>
      <Route path="/projects/:id/outcomes">{() => <Protected Component={Outcomes} />}</Route>
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

      {/* Market Intelligence (protected) */}
      <Route path="/market-intel/evidence">{() => <Protected Component={EvidenceVaultMI} />}</Route>
      <Route path="/market-intel/sources">{() => <Protected Component={SourceRegistry} />}</Route>
      <Route path="/market-intel/proposals">{() => <Protected Component={BenchmarkProposals} />}</Route>
      <Route path="/market-intel/competitors">{() => <Protected Component={CompetitorsMI} />}</Route>
      <Route path="/market-intel/tags">{() => <Protected Component={TrendTags} />}</Route>
      <Route path="/market-intel/audit">{() => <Protected Component={IntelAuditLog} />}</Route>
      <Route path="/market-intel/data-health">{() => <Protected Component={DataHealth} />}</Route>
      <Route path="/market-intel/ingestion">{() => <Protected Component={IngestionMonitor} />}</Route>
      <Route path="/market-intel/analytics">{() => <Protected Component={AnalyticsDashboard} />}</Route>

      {/* Admin routes (admin-only) */}
      <Route path="/admin/benchmarks">{() => <AdminOnly Component={Benchmarks} />}</Route>
      <Route path="/admin/benchmark-versions">{() => <AdminOnly Component={BenchmarkVersions} />}</Route>
      <Route path="/admin/benchmark-categories">{() => <AdminOnly Component={BenchmarkCategories} />}</Route>
      <Route path="/admin/models">{() => <AdminOnly Component={ModelVersions} />}</Route>
      <Route path="/admin/audit">{() => <AdminOnly Component={AuditLogs} />}</Route>
      <Route path="/admin/overrides">{() => <AdminOnly Component={Overrides} />}</Route>
      <Route path="/admin/benchmark-health">{() => <AdminOnly Component={BenchmarkHealth} />}</Route>
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
