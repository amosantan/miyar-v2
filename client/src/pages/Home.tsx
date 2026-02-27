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
  Sparkles,
  FileText,
  DollarSign,
  TrendingUp,
  Leaf,
  ChevronDown,
  Building2,
  Layers,
  Scale,
  Globe,
  Award,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";

/* ─── Animated Counter Component ────────────────────────────────────────────── */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: string; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const numericTarget = parseInt(target.replace(/[^0-9]/g, ""), 10);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const duration = 2000;
          const step = numericTarget / (duration / 16);
          const timer = setInterval(() => {
            start += step;
            if (start >= numericTarget) {
              setCount(numericTarget);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [numericTarget]);

  return (
    <div ref={ref} className="text-3xl md:text-4xl font-bold text-gold-gradient">
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

/* ─── Section Wrapper with Scroll Animation ─────────────────────────────────── */
function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Main Home Component ───────────────────────────────────────────────────── */
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
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="flex flex-col items-center gap-3">
          <div className="text-3xl font-bold text-gold-gradient tracking-tight">MIYAR</div>
          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[#C9A96E] to-transparent animate-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-[#F0EBE3] overflow-x-hidden">

      {/* ─── Navigation Bar ───────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-overlay border-b border-[#C9A96E]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-gold-gradient tracking-tight">MIYAR</span>
            <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9CB7] hidden sm:inline">مِعيار</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/methodology" className="text-sm text-[#8B9CB7] hover:text-[#C9A96E] transition-colors hidden md:inline">Methodology</a>
            <Button
              size="sm"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold px-5 rounded-lg"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Section 1: Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0 animate-gradient" style={{
          background: "linear-gradient(135deg, #0A1628 0%, #111827 25%, #162033 50%, #0F1A2E 75%, #0A1628 100%)",
          backgroundSize: "400% 400%",
        }} />
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #C9A96E 1px, transparent 1px), radial-gradient(circle at 75% 75%, #C9A96E 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }} />
        {/* Gold glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" style={{
          background: "radial-gradient(circle, rgba(201, 169, 110, 0.08) 0%, transparent 70%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#C9A96E]/20 bg-[#C9A96E]/5 mb-8 animate-fade-in-down">
            <div className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
            <span className="text-xs font-medium text-[#C9A96E] tracking-wide">V5 — THE AUTHORITY ENGINE</span>
          </div>

          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-in-up">
            <span className="text-gold-gradient">Design</span>
            <span className="text-[#F0EBE3]"> Intelligence</span>
            <br />
            <span className="text-[#8B9CB7] text-3xl md:text-4xl lg:text-5xl font-medium mt-2 block">
              for UAE Luxury Real Estate
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-[#8B9CB7] max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up delay-200" style={{ animationFillMode: "both" }}>
            From project parameters to board-ready investor briefs in 60 seconds —
            powered by live DLD market data, Gemini AI, and deterministic scoring.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in-up delay-300" style={{ animationFillMode: "both" }}>
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold px-8 py-6 text-base rounded-xl gap-2 shadow-lg shadow-[#C9A96E]/20 hover:shadow-[#C9A96E]/30 transition-all"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="border-[#C9A96E]/30 text-[#C9A96E] hover:bg-[#C9A96E]/10 hover:border-[#C9A96E]/50 px-8 py-6 text-base rounded-xl"
            >
              See How It Works
            </Button>
          </div>

          {/* Floating stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto animate-fade-in-up delay-500" style={{ animationFillMode: "both" }}>
            {[
              { value: "578K", suffix: "+", label: "DLD Transactions Analyzed" },
              { value: "150", suffix: "+", label: "Cost Benchmarks" },
              { value: "38", label: "Compliance Checks" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-xl px-6 py-4 text-center">
                <AnimatedCounter target={stat.value} suffix={stat.suffix || ""} />
                <p className="text-xs text-[#8B9CB7] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-scroll-hint">
          <ChevronDown className="h-6 w-6 text-[#C9A96E]/50" />
        </div>
      </section>

      {/* ─── Section 2: Features ──────────────────────────────────────────── */}
      <section id="features" className="relative py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3 block">Core Platform</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-4">
                What MIYAR Does
              </h2>
              <p className="text-[#8B9CB7] max-w-xl mx-auto">
                Six analytical engines working together to validate design directions
                with defensible market data.
              </p>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: "AI Design Brief",
                desc: "7-section design brief with AI-generated recommendations grounded in UAE market trends.",
                tag: "Gemini AI",
              },
              {
                icon: DollarSign,
                title: "Live Cost Calculator",
                desc: "Interactive material cost calculator with real-time AED/m² from 150+ benchmarks.",
                tag: "Real-time",
              },
              {
                icon: FileText,
                title: "Investor PDF Export",
                desc: "Board-ready investor briefs with professional formatting, shareable via token-gated links.",
                tag: "Export",
              },
              {
                icon: Target,
                title: "MIYAR Score",
                desc: "5-dimension evaluation (SA/FF/MP/DS/ER) with full explainability trace for every number.",
                tag: "Scoring",
              },
              {
                icon: TrendingUp,
                title: "Market Intelligence",
                desc: "Live DLD transaction analytics, area intelligence, and competitor landscape analysis.",
                tag: "DLD Data",
              },
              {
                icon: Leaf,
                title: "Sustainability",
                desc: "Estidama Pearl & Al Sa'fat compliance checklists with certification-aware pricing.",
                tag: "Compliance",
              },
            ].map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 100}>
                <div className="glass-card rounded-2xl p-6 h-full group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-[#C9A96E]/10 flex items-center justify-center group-hover:bg-[#C9A96E]/20 transition-colors">
                      <feature.icon className="h-5 w-5 text-[#C9A96E]" />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-[#C9A96E]/60 px-2 py-0.5 rounded-full border border-[#C9A96E]/15">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[#F0EBE3] mb-2 text-lg">{feature.title}</h3>
                  <p className="text-sm text-[#8B9CB7] leading-relaxed">{feature.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 3: How It Works ──────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#1E2D42]">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3 block">Workflow</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3]">
                From Input to Insight in 60 Seconds
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting line (hidden on mobile) */}
            <div className="absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-[#C9A96E]/20 via-[#C9A96E]/40 to-[#C9A96E]/20 hidden md:block" />

            {[
              { step: "01", title: "Define Project", desc: "Enter typology, GFA, tier, style, city, and sustainability target.", icon: Building2 },
              { step: "02", title: "AI Analysis", desc: "Gemini AI generates a design brief with DLD-calibrated cost estimates.", icon: Sparkles },
              { step: "03", title: "Review & Score", desc: "5-dimension MIYAR Score evaluates feasibility, risk, and market fit.", icon: BarChart3 },
              { step: "04", title: "Export & Share", desc: "One-click PDF export or token-gated share link for investors.", icon: ArrowUpRight },
            ].map((s, i) => (
              <AnimatedSection key={s.step} delay={i * 150}>
                <div className="text-center relative">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#C9A96E]/20 to-[#C9A96E]/5 border border-[#C9A96E]/20 flex items-center justify-center relative z-10">
                    <s.icon className="h-7 w-7 text-[#C9A96E]" />
                  </div>
                  <div className="text-xs font-bold text-[#C9A96E]/40 mb-2 tracking-widest">STEP {s.step}</div>
                  <h3 className="font-semibold text-[#F0EBE3] mb-2">{s.title}</h3>
                  <p className="text-sm text-[#8B9CB7] leading-relaxed">{s.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 4: Trust Signals ─────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#1E2D42]">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3 block">Institutional Grade</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3]">
                Built for UAE Market Authority
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Globe,
                title: "Live DLD Data",
                desc: "578K+ real transactions from Dubai Land Department power every cost estimate and area analysis.",
                stat: "578K+",
                statLabel: "Transactions",
              },
              {
                icon: Leaf,
                title: "Estidama & Al Sa'fat",
                desc: "38 compliance checklist items with certification-aware pricing and sustainability scoring.",
                stat: "38",
                statLabel: "Compliance Items",
              },
              {
                icon: Scale,
                title: "RICS NRM Aligned",
                desc: "30+ material categories mapped to RICS New Rules of Measurement for institutional credibility.",
                stat: "30+",
                statLabel: "NRM Codes",
              },
            ].map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 100}>
                <div className="glass-card rounded-2xl p-8 text-center group">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#C9A96E]/10 flex items-center justify-center">
                    <item.icon className="h-7 w-7 text-[#C9A96E]" />
                  </div>
                  <div className="text-2xl font-bold text-gold-gradient mb-1">{item.stat}</div>
                  <div className="text-xs text-[#C9A96E]/60 uppercase tracking-wider mb-3">{item.statLabel}</div>
                  <h3 className="font-semibold text-[#F0EBE3] mb-2">{item.title}</h3>
                  <p className="text-sm text-[#8B9CB7] leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 5: App Preview ───────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#1E2D42] overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3 block">The Platform</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-4">
                A Bloomberg Terminal for Interior Design
              </h2>
              <p className="text-[#8B9CB7] max-w-lg mx-auto">
                Data-dense yet beautiful. Every metric traceable to source.
                Every score explainable.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <div className="relative mx-auto max-w-5xl" style={{ perspective: "1200px" }}>
              <div
                className="rounded-2xl border border-[#C9A96E]/20 overflow-hidden shadow-2xl shadow-[#C9A96E]/5"
                style={{ transform: "rotateX(2deg) rotateY(-1deg)" }}
              >
                {/* Fake dashboard preview */}
                <div className="bg-[#070F1D] p-1">
                  {/* Window chrome */}
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    <div className="ml-4 flex-1 h-5 rounded-md bg-[#111827] flex items-center px-3">
                      <span className="text-[10px] text-[#8B9CB7]">miyar.app/dashboard</span>
                    </div>
                  </div>
                  {/* Dashboard content */}
                  <div className="flex min-h-[400px]">
                    {/* Sidebar */}
                    <div className="w-48 bg-[#070F1D] border-r border-[#162033] p-3 hidden sm:block">
                      <div className="text-sm font-bold text-[#C9A96E] mb-4">MIYAR</div>
                      {["Dashboard", "Projects", "Portfolio", "Market Intel", "Sustainability"].map((item, i) => (
                        <div key={item} className={`text-xs py-2 px-2 rounded-lg mb-1 ${i === 0 ? "bg-[#C9A96E]/10 text-[#C9A96E]" : "text-[#8B9CB7]"}`}>
                          {item}
                        </div>
                      ))}
                    </div>
                    {/* Main */}
                    <div className="flex-1 p-4">
                      <div className="text-sm font-semibold text-[#F0EBE3] mb-3">Executive Dashboard</div>
                      {/* KPI row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {[
                          { label: "Active Projects", value: "12" },
                          { label: "Avg Score", value: "78.4" },
                          { label: "Data Sources", value: "24" },
                          { label: "Portfolio Value", value: "485M" },
                        ].map((kpi) => (
                          <div key={kpi.label} className="bg-[#111827] rounded-lg p-3 border border-[#1E2D42]">
                            <div className="text-[10px] text-[#8B9CB7]">{kpi.label}</div>
                            <div className="text-lg font-bold text-[#C9A96E]">{kpi.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Chart placeholder */}
                      <div className="bg-[#111827] rounded-lg p-3 border border-[#1E2D42] h-32 flex items-end gap-1">
                        {[40, 55, 35, 65, 50, 75, 60, 80, 70, 85, 78, 82].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t" style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, rgba(201,169,110,0.3), rgba(201,169,110,0.8))`,
                          }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Reflection glow */}
              <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-[#C9A96E]/5 blur-3xl rounded-full" />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Section 6: Version Changelog ─────────────────────────────────── */}
      <section className="relative py-24 md:py-32 border-t border-[#1E2D42]">
        <div className="max-w-4xl mx-auto px-6">
          <AnimatedSection>
            <div className="text-center mb-16">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3 block">Changelog</span>
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3]">
                Platform Evolution
              </h2>
            </div>
          </AnimatedSection>

          <div className="space-y-6">
            {[
              {
                version: "V5",
                title: "The Authority Engine",
                current: true,
                features: [
                  "Live DLD transaction analytics (578K+ records)",
                  "Estidama & Al Sa'fat sustainability compliance",
                  "RICS NRM cost alignment (30+ material codes)",
                  "Portfolio benchmarking with cross-project comparison",
                  "City-aware certification pricing (Dubai / Abu Dhabi)",
                  "Mobile-responsive share views",
                  "SCAD Abu Dhabi material index integration",
                  "Synthetic gap-filler with labeled data quality",
                ],
              },
              {
                version: "V4",
                title: "Evidence & Predictive Intelligence",
                features: [
                  "Predictive Cost Range Engine (P15/P50/P85/P95)",
                  "Evidence Vault with provenance click-through",
                  "Material Board Composer V2 with PDF export",
                  "Visual Studio with AI image generation",
                  "Data Freshness Badges (green/amber/red)",
                  "Cost Forecasting panel on Analytics Dashboard",
                ],
              },
              {
                version: "V3",
                title: "Market Intelligence & Analytics",
                features: [
                  "Market ingestion pipeline with 5 connector types",
                  "Trend analysis with anomaly detection",
                  "Competitor landscape with HHI index",
                  "Analytics Intelligence Dashboard",
                  "Webhook system for integrations",
                ],
              },
              {
                version: "V2",
                title: "Scoring Engine & Explainability",
                features: [
                  "5-dimension scoring model (SA, FF, MP, DS, ER)",
                  "Sensitivity analysis with variable simulation",
                  "ROI impact estimation engine",
                  "PDF report generation (Brief, RFQ, Summary)",
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
            ].map((v, i) => (
              <AnimatedSection key={v.version} delay={i * 100}>
                <div
                  className={`rounded-2xl border p-6 transition-all ${v.current
                      ? "border-[#C9A96E]/40 bg-[#C9A96E]/5 shadow-lg shadow-[#C9A96E]/5"
                      : "border-[#1E2D42] bg-[#111827]/50 hover:border-[#1E2D42]/80"
                    }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-lg ${v.current
                          ? "bg-[#C9A96E] text-[#0A1628]"
                          : "bg-[#1A2332] text-[#8B9CB7]"
                        }`}
                    >
                      {v.version}
                    </span>
                    <h3 className="font-semibold text-[#F0EBE3]">{v.title}</h3>
                    {v.current && (
                      <span className="text-xs font-medium text-[#C9A96E] flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
                        Current
                      </span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {v.features.map((f, fi) => (
                      <p key={fi} className="text-sm text-[#8B9CB7] flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A96E]/40 mt-0.5 shrink-0" />
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 7: Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-[#1E2D42]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-bold text-gold-gradient">MIYAR</span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-[#8B9CB7]">مِعيار</span>
              </div>
              <p className="text-sm text-[#8B9CB7] leading-relaxed mb-4">
                AI-powered Design Intelligence Engine for the UAE luxury
                real estate and interior design market.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#C9A96E]/60">
                <Zap className="h-3 w-3" />
                Powered by Gemini AI + Live UAE Market Data
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-[#F0EBE3] mb-4">Product</h4>
              <div className="space-y-2.5">
                {[
                  { label: "Methodology", href: "/methodology" },
                  { label: "Design Brief", href: "#features" },
                  { label: "MIYAR Score", href: "#features" },
                  { label: "Market Intelligence", href: "#features" },
                ].map((link) => (
                  <a key={link.label} href={link.href} className="block text-sm text-[#8B9CB7] hover:text-[#C9A96E] transition-colors">
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Coverage */}
            <div>
              <h4 className="text-sm font-semibold text-[#F0EBE3] mb-4">Market Coverage</h4>
              <div className="space-y-2.5 text-sm text-[#8B9CB7]">
                <p className="flex items-center gap-2">
                  <Award className="h-3.5 w-3.5 text-[#C9A96E]/50" />
                  Dubai (Primary)
                </p>
                <p className="flex items-center gap-2">
                  <Award className="h-3.5 w-3.5 text-[#C9A96E]/50" />
                  Abu Dhabi (SCAD + Estidama)
                </p>
                <p className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-[#C9A96E]/50" />
                  RICS NRM Compliant
                </p>
                <p className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-[#C9A96E]/50" />
                  Estidama & Al Sa'fat Certified
                </p>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-[#1E2D42] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#8B9CB7]">
              © 2026 MIYAR Design Intelligence. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs text-[#8B9CB7]">
              <a href="/methodology" className="hover:text-[#C9A96E] transition-colors">Methodology</a>
              <span className="text-[#1E2D42]">·</span>
              <a href="#" className="hover:text-[#C9A96E] transition-colors">Privacy</a>
              <span className="text-[#1E2D42]">·</span>
              <a href="#" className="hover:text-[#C9A96E] transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
