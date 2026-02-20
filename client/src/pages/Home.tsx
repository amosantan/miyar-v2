import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  Shield,
  Zap,
  Target,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl font-bold">
          MIYAR
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-miyar-navy via-background to-miyar-navy-light opacity-50" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-36">
          <div className="flex flex-col items-center text-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                <span className="text-primary">MIYAR</span>
              </h1>
              <p className="text-xs md:text-sm tracking-[0.35em] uppercase text-muted-foreground">
                Decision Intelligence Platform
              </p>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Validate interior design directions with deterministic
              multi-criteria analysis. Transform subjective design decisions
              into data-driven strategic outcomes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={() => (window.location.href = getLoginUrl())}
                className="gap-2 px-8"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
            Six Core Analytical Engines
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Each project is evaluated across five strategic dimensions, powered
            by deterministic scoring models with full explainability.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Target,
              title: "Direction Validation",
              desc: "Evaluate alignment between design intent and project strategic parameters across 5 dimensions.",
            },
            {
              icon: BarChart3,
              title: "Budget Compatibility",
              desc: "Assess financial feasibility with cost benchmarking, budget-fit analysis, and risk-adjusted scoring.",
            },
            {
              icon: Zap,
              title: "Market Positioning",
              desc: "Score competitive positioning, differentiation pressure, and trend alignment for target segments.",
            },
            {
              icon: Shield,
              title: "Risk Assessment",
              desc: "Identify execution risks, supply chain vulnerabilities, and complexity mismatches with penalty flags.",
            },
            {
              icon: CheckCircle2,
              title: "Scenario Simulation",
              desc: "Run what-if scenarios with variable overrides and compare outcomes to find the dominant direction.",
            },
            {
              icon: BarChart3,
              title: "ROI Estimation",
              desc: "Quantify economic impact: rework avoided, procurement savings, time value, and positioning premium.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-all"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground text-center mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Input", desc: "Enter project context, strategy, market, financial, design, and execution parameters." },
              { step: "02", title: "Evaluate", desc: "The engine normalizes, scores, and classifies your direction across 5 dimensions." },
              { step: "03", title: "Simulate", desc: "Run scenarios with variable overrides. Compare outcomes side-by-side." },
              { step: "04", title: "Decide", desc: "Receive a validated/conditional/not-validated decision with full explainability." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-3xl font-bold text-primary/30 mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Version History */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground text-center mb-12">
            Platform Evolution
          </h2>
          <div className="space-y-6">
            {[
              {
                version: "V4",
                title: "Evidence & Predictive Intelligence",
                current: true,
                features: [
                  "Predictive Cost Range Engine (P15/P50/P85/P95 with trend adjustment)",
                  "Design Outcome Prediction with comparable project analysis",
                  "Scenario Cost Projection with compounding formula",
                  "Evidence Vault with references and inline citations",
                  "Material Board Composer V2 with tiles, spec notes, cost bands, PDF export",
                  "Visual Studio with AI image generation and prompt templates",
                  "Executive Decision Pack with evidence annexes",
                  "Cost Forecasting panel on Analytics Dashboard",
                  "Budget Feasibility Score (evidence-backed vs benchmark-static)",
                  "476 automated tests, 48 database tables, 0 TypeScript errors",
                ],
              },
              {
                version: "V3",
                title: "Market Intelligence & Analytics",
                features: [
                  "Market intelligence ingestion pipeline with 5 connector types",
                  "Trend analysis engine with moving averages and anomaly detection",
                  "Competitor landscape analysis with HHI concentration index",
                  "Analytics Intelligence Dashboard with 4 panels",
                  "Webhook system for external integrations",
                  "Admin panel with benchmark management and model versioning",
                ],
              },
              {
                version: "V2",
                title: "Scoring Engine & Explainability",
                features: [
                  "5-dimension scoring model (SA, FF, MP, DS, ER)",
                  "Sensitivity analysis with variable override simulation",
                  "ROI impact estimation engine",
                  "5-Lens strategic analysis",
                  "PDF report generation (Design Brief, RFQ Pack, Validation Summary)",
                  "Scenario management with side-by-side comparison",
                ],
              },
              {
                version: "V1",
                title: "Foundation",
                features: [
                  "Project creation with 20+ input variables",
                  "Deterministic evaluation with composite scoring",
                  "Risk assessment with penalty flags",
                  "Decision classification (validated/conditional/not-validated)",
                ],
              },
            ].map((v) => (
              <div
                key={v.version}
                className={`rounded-xl border p-6 ${
                  v.current
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`text-sm font-bold px-2.5 py-0.5 rounded ${
                      v.current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {v.version}
                  </span>
                  <h3 className="font-semibold text-foreground">{v.title}</h3>
                  {v.current && (
                    <span className="text-xs text-primary font-medium">Current</span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  {v.features.map((f, i) => (
                    <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary/50 mt-0.5 shrink-0" />
                      {f}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary">MIYAR</span>
            <span className="text-xs text-muted-foreground">
              Decision Intelligence Platform — V4
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Deterministic multi-criteria analysis for interior design validation.
          </p>
        </div>
      </div>
    </div>
  );
}
