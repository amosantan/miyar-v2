import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  FileText,
  DollarSign,
  TrendingUp,
  Leaf,
  ChevronDown,
  LineChart,
  Layers,
  Globe,
  Star,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";

/* ─── Animated Counter ──────────────────────────────────────────────────────── */
function AnimatedCounter({ target, suffix = "" }: { target: string; suffix?: string }) {
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
      {count.toLocaleString()}{suffix}
    </div>
  );
}

/* ─── Scroll-reveal wrapper ─────────────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); observer.disconnect(); } },
      { threshold: 0.12 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>
      {children}
    </div>
  );
}

/* ─── Gold decorative diamond separator ─────────────────────────────────────── */
function GoldDiamond() {
  return (
    <div className="flex items-center justify-center gap-2 my-2">
      <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#C9A96E]/40" />
      <div className="w-2 h-2 rotate-45 bg-[#C9A96E]" />
      <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#C9A96E]/40" />
    </div>
  );
}

/* ─── Ornamental MIYAR Logo SVG ─────────────────────────────────────────────── */
function MiyarLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer ornamental frame */}
      <path d="M32 2L42 12L52 12L52 22L62 32L52 42L52 52L42 52L32 62L22 52L12 52L12 42L2 32L12 22L12 12L22 12Z" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none" />
      {/* Inner diamond */}
      <path d="M32 14L44 26L44 38L32 50L20 38L20 26Z" stroke="url(#logoGrad)" strokeWidth="1" fill="rgba(201,169,110,0.08)" />
      {/* Center A/star */}
      <path d="M32 20L38 32L44 44H36L34 40H30L28 44H20L26 32Z" fill="url(#logoGrad)" />
      <path d="M30 36H34L32 28Z" fill="#0A1628" />
      {/* Corner ornaments */}
      <circle cx="32" cy="8" r="1.5" fill="#C9A96E" />
      <circle cx="56" cy="32" r="1.5" fill="#C9A96E" />
      <circle cx="32" cy="56" r="1.5" fill="#C9A96E" />
      <circle cx="8" cy="32" r="1.5" fill="#C9A96E" />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#D4B87A" />
          <stop offset="50%" stopColor="#C9A96E" />
          <stop offset="100%" stopColor="#8B7355" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) setLocation("/dashboard");
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

  /* ─── Sections data ─────────────────────────────────────────────────────── */
  const features = [
    { icon: Sparkles, title: "AI Design Brief", desc: "Generative aesthetics tailored for high-end residential and commercial spaces based on current trends." },
    { icon: DollarSign, title: "Live Cost Calculator", desc: "Real-time UAE market pricing for materials, labor, and luxury fit-outs updated daily." },
    { icon: FileText, title: "Investor PDF Export", desc: "Institutional-grade reporting ready for board presentations and investment committees." },
    { icon: BarChart3, title: "MIYAR Score", desc: "Proprietary luxury benchmark scoring to evaluate long-term property value appreciation." },
    { icon: Globe, title: "Market Intelligence", desc: "Direct integration with Dubai Land Department (DLD) for live transaction mapping." },
    { icon: Leaf, title: "Sustainability Compliance", desc: "Ensure every design meets the latest Dubai green building standards and ESG requirements." },
  ];

  const steps = [
    { num: "01", title: "Define", desc: "Input property coordinates and basic shell parameters." },
    { num: "02", title: "Analyze", desc: "Gemini AI generates 50+ localized design variations." },
    { num: "03", title: "Review", desc: "Validate with live cost benchmarks and DLD data." },
    { num: "04", title: "Export", desc: "Download your investor-ready PDF strategy package." },
  ];

  const versions = [
    {
      ver: "5.0", title: "The Authority Engine", date: "February 2026", current: true,
      items: [
        "Direct API connection to Dubai Land Department",
        "Multi-asset portfolio comparison engine",
        "Enhanced Sustainability score compliance",
        "RICS NRM cost alignment (30+ codes)",
        "City-aware certification pricing",
        "Mobile-responsive share views",
      ],
    },
    {
      ver: "4.0", title: "Evidence & Prediction", date: "January 2026",
      items: [
        "Gemini AI Pro Integration for design logic",
        "Institutional-grade PDF export formatting",
        "Predictive Cost Range Engine (P15–P95)",
        "Evidence Vault with provenance tracking",
      ],
    },
    {
      ver: "3.0", title: "Market Intelligence", date: "December 2025",
      items: [
        "Live material cost tracking for UAE market",
        "Market ingestion pipeline with 5 connector types",
        "Trend analysis & competitor landscape",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A1628] text-[#F0EBE3] overflow-x-hidden">

      {/* ═══ NAVBAR ═══════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#C9A96E]/10" style={{
        background: "rgba(10,22,40,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)"
      }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <MiyarLogo size={34} />
              <span className="text-lg font-bold text-gold-gradient tracking-tight">MIYAR</span>
            </div>
            {/* Nav links */}
            <div className="hidden md:flex items-center gap-6 text-sm text-[#8B9CB7]">
              <a href="#features" className="hover:text-[#C9A96E] transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-[#C9A96E] transition-colors">How it Works</a>
              <a href="#dashboard" className="hover:text-[#C9A96E] transition-colors">Dashboard</a>
              <a href="#changelog" className="hover:text-[#C9A96E] transition-colors">Changelog</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (window.location.href = getLoginUrl())}
              className="text-[#C9A96E] hover:bg-[#C9A96E]/10 hidden sm:inline-flex"
            >
              Login
            </Button>
            <Button
              size="sm"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold px-5 rounded-lg"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Animated luxury interior background — Ken Burns effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("/images/hero-bg.png")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation: "kenBurns 25s ease-in-out infinite alternate",
            }}
          />
          {/* Dark overlay gradient for readability — center is darkest */}
          <div className="absolute inset-0" style={{
            background: `
              linear-gradient(180deg, rgba(10,22,40,0.75) 0%, rgba(10,22,40,0.55) 50%, rgba(10,22,40,0.85) 100%),
              radial-gradient(ellipse at center, rgba(10,22,40,0.80) 30%, transparent 75%)
            `,
          }} />
          {/* Left vignette */}
          <div className="absolute inset-y-0 left-0 w-1/4" style={{
            background: "linear-gradient(to right, rgba(10,22,40,0.9), transparent)",
          }} />
          {/* Right vignette */}
          <div className="absolute inset-y-0 right-0 w-1/4" style={{
            background: "linear-gradient(to left, rgba(10,22,40,0.9), transparent)",
          }} />
        </div>

        {/* Gold ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-25 pointer-events-none" style={{
          background: "radial-gradient(ellipse, rgba(201,169,110,0.15) 0%, transparent 70%)",
        }} />
        {/* Bottom fade to page bg */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A1628] to-transparent z-10" />

        {/* Decorative vertical lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-[15%] w-px h-full bg-gradient-to-b from-transparent via-[#C9A96E]/8 to-transparent" />
          <div className="absolute top-0 left-[85%] w-px h-full bg-gradient-to-b from-transparent via-[#C9A96E]/8 to-transparent" />
        </div>

        <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
          {/* Ornamental MIYAR Icon */}
          <div className="flex justify-center mb-6 animate-fade-in-down">
            <MiyarLogo size={56} className="drop-shadow-lg" />
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up leading-tight">
            Design Intelligence for
            <br />
            <span className="text-gold-gradient">UAE </span>
            <span className="italic font-light text-gold-gradient">Luxury </span>
            <span className="text-[#F0EBE3]">Real</span>
            <br />
            <span className="text-[#F0EBE3]">Estate</span>
          </h1>

          {/* Ornamental */}
          <GoldDiamond />

          {/* Subtitle */}
          <p className="text-base md:text-lg text-[#B8C5D6] max-w-2xl mx-auto leading-relaxed mt-4 mb-10 animate-fade-in-up delay-200" style={{ animationFillMode: "both" }}>
            The pinnacle of AI-driven interior design intelligence for Dubai's most
            prestigious institutional property portfolios.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6 animate-fade-in-up delay-300" style={{ animationFillMode: "both" }}>
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold px-10 py-6 text-base rounded-xl gap-2 shadow-lg shadow-[#C9A96E]/25 hover:shadow-[#C9A96E]/45 transition-all"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              className="border-[#C9A96E]/30 text-[#C9A96E] hover:bg-[#C9A96E]/10 hover:border-[#C9A96E]/50 px-10 py-6 text-base rounded-xl backdrop-blur-sm"
            >
              See How it Works
            </Button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 animate-scroll-hint">
          <ChevronDown className="h-5 w-5 text-[#C9A96E]/40" />
        </div>
      </section>

      {/* ═══ STATS BAR ════════════════════════════════════════════════════════ */}
      <section className="relative z-20 -mt-6">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-[#C9A96E]/25 overflow-hidden" style={{
            background: "linear-gradient(135deg, rgba(17,24,39,0.8) 0%, rgba(10,22,40,0.9) 100%)",
            backdropFilter: "blur(16px)",
          }}>
            {[
              { value: "578K", suffix: "+", label: "DLD Transactions" },
              { value: "150", suffix: "+", label: "Benchmarks" },
              { value: "38", label: "Compliance Checks" },
            ].map((stat, i) => (
              <div key={stat.label} className={`px-8 py-6 text-center ${i < 2 ? "sm:border-r border-b sm:border-b-0 border-[#C9A96E]/15" : ""}`}>
                <AnimatedCounter target={stat.value} suffix={stat.suffix || ""} />
                <p className="text-xs uppercase tracking-[0.15em] text-[#8B9CB7] mt-1.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES — "Elite Capabilities" ══════════════════════════════════ */}
      <section id="features" className="py-28 md:py-36">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-4">
              <span className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C9A96E]">Elite Capabilities</span>
            </div>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-3">What MIYAR Does</h2>
              <GoldDiamond />
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="group rounded-2xl border border-[#1E2D42] bg-[#0D1926] p-7 transition-all duration-300 hover:border-[#C9A96E]/30 hover:bg-[#101E2F] hover:shadow-lg hover:shadow-[#C9A96E]/5 h-full">
                  <div className="flex items-start gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#C9A96E]/20 to-[#C9A96E]/5 flex items-center justify-center shrink-0 group-hover:from-[#C9A96E]/30 group-hover:to-[#C9A96E]/10 transition-all">
                      <f.icon className="h-5 w-5 text-[#C9A96E]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#F0EBE3] mb-2 text-base">{f.title}</h3>
                      <p className="text-sm text-[#8B9CB7] leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 md:py-32 border-t border-[#1E2D42]">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-2">How it Works</h2>
              <p className="text-[#8B9CB7]">A seamless workflow for rapid property intelligence.</p>
              <GoldDiamond />
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Horizontal connector (desktop) */}
            <div className="absolute top-12 left-[12%] right-[12%] h-px bg-gradient-to-r from-[#C9A96E]/10 via-[#C9A96E]/25 to-[#C9A96E]/10 hidden lg:block" />

            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 120}>
                <div className="text-center relative">
                  <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-gradient-to-br from-[#C9A96E]/25 to-[#C9A96E]/5 border border-[#C9A96E]/30 flex items-center justify-center relative z-10">
                    <span className="text-sm font-bold text-[#C9A96E]">{s.num}</span>
                  </div>
                  <h3 className="font-semibold text-[#F0EBE3] mb-2 text-lg">{s.title}</h3>
                  <p className="text-sm text-[#8B9CB7] leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PORTFOLIO COMMAND CENTER ═════════════════════════════════════════ */}
      <section id="dashboard" className="py-24 md:py-32 border-t border-[#1E2D42] overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <Reveal>
              <div>
                <span className="text-xs font-semibold tracking-[0.3em] uppercase text-[#C9A96E] mb-3 block">The Platform</span>
                <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-6 leading-tight">
                  Your Portfolio<br />Command Center
                </h2>
                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <LineChart className="h-4 w-4 text-[#C9A96E]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#F0EBE3] text-sm">Live Analytics</h4>
                      <p className="text-sm text-[#8B9CB7]">Monitor ROI predictions for every asset in real-time.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers className="h-4 w-4 text-[#C9A96E]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#F0EBE3] text-sm">Advanced Modeling</h4>
                      <p className="text-sm text-[#8B9CB7]">Compare fit-out levels from 'Standard' to 'Ultra Luxury'.</p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => (window.location.href = getLoginUrl())}
                  className="bg-[#C9A96E] hover:bg-[#B08D4C] text-[#0A1628] font-semibold px-8 rounded-xl shadow-lg shadow-[#C9A96E]/20"
                >
                  Explore the Dashboard
                </Button>
              </div>
            </Reveal>

            {/* Right: dashboard mockup */}
            <Reveal delay={200}>
              <div className="relative" style={{ perspective: "1200px" }}>
                <div className="rounded-2xl border border-[#C9A96E]/20 overflow-hidden shadow-2xl shadow-black/40" style={{ transform: "rotateY(-4deg) rotateX(2deg)" }}>
                  {/* Window chrome */}
                  <div className="bg-[#070F1D] px-4 py-2.5 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                    <div className="ml-4 flex-1 h-5 rounded bg-[#111827] flex items-center px-3">
                      <span className="text-[10px] text-[#8B9CB7]">miyar.app/dashboard</span>
                    </div>
                  </div>
                  {/* Dashboard content */}
                  <div className="bg-[#0A1628] flex">
                    {/* Sidebar mini */}
                    <div className="w-40 bg-[#070F1D] border-r border-[#162033] p-3 hidden md:block">
                      <div className="text-xs font-bold text-[#C9A96E] mb-4 flex items-center gap-1.5">
                        <Star className="h-3 w-3 fill-[#C9A96E]" />
                        MIYAR
                      </div>
                      {["Dashboard", "Projects", "Portfolio", "Market Intel"].map((item, i) => (
                        <div key={item} className={`text-[11px] py-1.5 px-2 rounded mb-0.5 ${i === 0 ? "bg-[#C9A96E]/10 text-[#C9A96E]" : "text-[#8B9CB7]"}`}>
                          {item}
                        </div>
                      ))}
                    </div>
                    {/* Main area */}
                    <div className="flex-1 p-4">
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {[
                          { label: "Active Projects", value: "24" },
                          { label: "Avg Score", value: "88.4" },
                          { label: "Data Sources", value: "112" },
                          { label: "Portfolio", value: "1.8B" },
                        ].map((kpi) => (
                          <div key={kpi.label} className="bg-[#111827] rounded-lg p-2.5 border border-[#1E2D42]">
                            <div className="text-[9px] text-[#8B9CB7] uppercase tracking-wider">{kpi.label}</div>
                            <div className="text-base font-bold text-[#C9A96E]">{kpi.value}</div>
                          </div>
                        ))}
                      </div>
                      {/* Chart */}
                      <div className="bg-[#111827] rounded-lg p-3 border border-[#1E2D42] h-28 flex items-end gap-0.5">
                        {[35, 50, 30, 60, 45, 70, 55, 75, 65, 82, 74, 80].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t transition-all" style={{
                            height: `${h}%`,
                            background: `linear-gradient(to top, rgba(201,169,110,0.3), rgba(201,169,110,0.8))`,
                          }} />
                        ))}
                      </div>
                      {/* MIYAR Score badge */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="text-[10px] uppercase tracking-wider text-[#8B9CB7]">MIYAR Score</div>
                        <div className="bg-[#C9A96E]/15 border border-[#C9A96E]/30 rounded-lg px-3 py-1 text-sm font-bold text-[#C9A96E]">94/100</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Drop-shadow glow */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#C9A96E]/5 blur-3xl rounded-full" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ DEVELOPMENT JOURNEY (CHANGELOG) ══════════════════════════════════ */}
      <section id="changelog" className="py-24 md:py-32 border-t border-[#1E2D42]">
        <div className="max-w-4xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-[#F0EBE3] mb-2">Development Journey</h2>
              <GoldDiamond />
            </div>
          </Reveal>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-[#C9A96E]/40 via-[#C9A96E]/20 to-transparent" />

            <div className="space-y-8">
              {versions.map((v, i) => (
                <Reveal key={v.ver} delay={i * 100}>
                  <div className="relative pl-12 md:pl-16">
                    {/* Dot on timeline */}
                    <div className={`absolute left-2.5 md:left-4.5 top-1 w-3 h-3 rounded-full border-2 ${v.current ? "bg-[#C9A96E] border-[#C9A96E] shadow-lg shadow-[#C9A96E]/30" : "bg-[#0A1628] border-[#C9A96E]/40"}`} />

                    <div className={`rounded-xl border p-6 transition-all ${v.current
                      ? "border-[#C9A96E]/35 bg-[#C9A96E]/[0.04]"
                      : "border-[#1E2D42] bg-[#0D1926]/50"
                      }`}>
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${v.current ? "bg-[#C9A96E] text-[#0A1628]" : "bg-[#1A2332] text-[#8B9CB7]"
                          }`}>
                          Version {v.ver}
                        </span>
                        {v.current && (
                          <span className="text-xs font-medium text-[#C9A96E] flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
                            Current
                          </span>
                        )}
                        <span className="text-xs text-[#8B9CB7]">{v.date}</span>
                      </div>
                      <h3 className="font-semibold text-[#F0EBE3] mb-3">{v.title}</h3>
                      <ul className="space-y-1.5">
                        {v.items.map((item, ii) => (
                          <li key={ii} className="text-sm text-[#8B9CB7] flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#C9A96E]/50 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer className="border-t border-[#1E2D42] bg-[#070F1D]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C9A96E] to-[#8B7355] flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 text-[#0A1628] fill-[#0A1628]" />
                </div>
                <span className="text-lg font-bold text-gold-gradient">MIYAR</span>
              </div>
              <p className="text-sm text-[#8B9CB7] leading-relaxed mb-4 max-w-sm">
                Defining the future of luxury real estate design through the lens of
                institutional intelligence and advanced AI.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#C9A96E]/70">
                <Zap className="h-3 w-3" />
                Powered by Gemini AI + Live UAE Market Data
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-[#F0EBE3] mb-4">Platform</h4>
              <div className="space-y-2.5 text-sm text-[#8B9CB7]">
                <a href="#features" className="block hover:text-[#C9A96E] transition-colors">Enterprise</a>
                <a href="/methodology" className="block hover:text-[#C9A96E] transition-colors">Methodology</a>
                <a href="#features" className="block hover:text-[#C9A96E] transition-colors">Integrations</a>
                <a href="#features" className="block hover:text-[#C9A96E] transition-colors">Documentation</a>
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold tracking-[0.15em] uppercase text-[#F0EBE3] mb-4">Company</h4>
              <div className="space-y-2.5 text-sm text-[#8B9CB7]">
                <a href="#" className="block hover:text-[#C9A96E] transition-colors">About Us</a>
                <a href="#" className="block hover:text-[#C9A96E] transition-colors">Privacy Policy</a>
                <a href="#" className="block hover:text-[#C9A96E] transition-colors">Terms of Service</a>
                <a href="#" className="block hover:text-[#C9A96E] transition-colors">Contact</a>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-[#1E2D42] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#8B9CB7]">© 2026 MIYAR Design Intelligence. All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs text-[#8B9CB7]">
              <a href="#features" className="hover:text-[#C9A96E] transition-colors">Enterprise</a>
              <a href="#" className="hover:text-[#C9A96E] transition-colors">Pricing</a>
              <a href="#features" className="hover:text-[#C9A96E] transition-colors">Integrations</a>
              <a href="#features" className="hover:text-[#C9A96E] transition-colors">Documentation</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
