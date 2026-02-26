import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/new" component={ProjectNew} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/projects/:id/evidence" component={EvidenceVault} />
      <Route path="/projects/:id/brief" component={DesignBrief} />
      <Route path="/projects/:id/design-studio" component={DesignStudio} />
      <Route path="/projects/:id/collaboration" component={Collaboration} />
      <Route path="/projects/:id/design-advisor" component={DesignAdvisor} />
      <Route path="/results" component={Results} />
      <Route path="/scenarios" component={Scenarios} />
      <Route path="/scenarios/templates" component={ScenarioTemplates} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin/benchmarks" component={Benchmarks} />
      <Route path="/admin/benchmark-versions" component={BenchmarkVersions} />
      <Route path="/admin/benchmark-categories" component={BenchmarkCategories} />
      <Route path="/admin/models" component={ModelVersions} />
      <Route path="/admin/audit" component={AuditLogs} />
      <Route path="/admin/overrides" component={Overrides} />
      <Route path="/admin/benchmark-health" component={BenchmarkHealth} />
      <Route path="/admin/portfolio" component={Portfolio} />
      <Route path="/admin/roi-config" component={RoiConfig} />
      <Route path="/admin/webhooks" component={Webhooks} />
      <Route path="/admin/csv-import" component={CsvImport} />
      <Route path="/admin/materials" component={MaterialsLibrary} />
      <Route path="/admin/prompt-templates" component={PromptTemplates} />
      <Route path="/admin/logic-registry" component={LogicRegistry} />
      <Route path="/admin/calibration" component={Calibration} />
      <Route path="/admin/benchmark-learning" component={BenchmarkLearning} />
      <Route path="/admin/learning-dashboard" component={LearningDashboard} />
      <Route path="/projects/:id/explainability" component={Explainability} />
      <Route path="/projects/:id/outcomes" component={Outcomes} />
      <Route path="/scenarios/compare" component={ScenarioComparison} />
      <Route path="/market-intel/evidence" component={EvidenceVaultMI} />
      <Route path="/market-intel/sources" component={SourceRegistry} />
      <Route path="/market-intel/proposals" component={BenchmarkProposals} />
      <Route path="/market-intel/competitors" component={CompetitorsMI} />
      <Route path="/market-intel/tags" component={TrendTags} />
      <Route path="/market-intel/audit" component={IntelAuditLog} />
      <Route path="/market-intel/data-health" component={DataHealth} />
      <Route path="/market-intel/ingestion" component={IngestionMonitor} />
      <Route path="/market-intel/analytics" component={AnalyticsDashboard} />
      <Route path="/alerts" component={Alerts} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/risk-heatmap" component={RiskHeatmap} />
      <Route path="/bias-insights" component={BiasInsights} />
      <Route path="/simulations" component={Simulations} />
      <Route path="/customer-success" component={CustomerSuccess} />
      <Route path="/sustainability" component={Sustainability} />
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
