import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectNew from "./pages/ProjectNew";
import ProjectDetail from "./pages/ProjectDetail";
import Results from "./pages/Results";
import Scenarios from "./pages/Scenarios";
import Reports from "./pages/Reports";
import Benchmarks from "./pages/admin/Benchmarks";
import ModelVersions from "./pages/admin/ModelVersions";
import AuditLogs from "./pages/admin/AuditLogs";
import Overrides from "./pages/admin/Overrides";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/new" component={ProjectNew} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/results" component={Results} />
      <Route path="/scenarios" component={Scenarios} />
      <Route path="/reports" component={Reports} />
      <Route path="/admin/benchmarks" component={Benchmarks} />
      <Route path="/admin/models" component={ModelVersions} />
      <Route path="/admin/audit" component={AuditLogs} />
      <Route path="/admin/overrides" component={Overrides} />
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
