import { ArrowRight, CheckCircle2, FileCheck2, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";

const stages = [
  { number: "01", title: "Define", copy: "Capture the project intent, constraints and evidence that matter before evaluation." },
  { number: "02", title: "Evaluate", copy: "Review explainable scores, cost ranges, risks and scenarios with assumptions visible." },
  { number: "03", title: "Share", copy: "Turn the approved decision into a traceable brief and board-ready deliverables." },
];

export default function Home() {
  const { locale } = useTranslation();
  const text = (english: string, arabic: string) => locale === "ar" ? arabic : english;
  const start = () => { window.location.href = getLoginUrl(); };

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-baseline gap-2" aria-label="MIYAR home">
          <span className="font-serif text-2xl">MIYAR</span><span className="text-xs text-muted-foreground">مِعيار</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <LanguageToggle compact />
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{text("Sign in", "تسجيل الدخول")}</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 md:px-8 md:pt-24 lg:grid-cols-[1.05fr_.95fr] lg:pb-28">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{text("UAE design-decision intelligence", "ذكاء قرارات التصميم في الإمارات")}</p>
          <h1 className="max-w-4xl font-serif text-5xl leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
            {text("Make defensible design decisions before committing capital.", "اتخذ قرارات تصميم قابلة للدفاع قبل الالتزام برأس المال.")}
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            {text("MIYAR brings project intent, market evidence, cost guardrails and design risk into one reviewable decision workspace for UAE development teams.", "يجمع مِعيار هدف المشروع وأدلة السوق وضوابط التكلفة ومخاطر التصميم في مساحة قرار واحدة قابلة للمراجعة لفرق التطوير في الإمارات.")}
          </p>
          <Button size="lg" onClick={start} className="mt-9 h-12 gap-2 px-6">
            {text("Start a project", "ابدأ مشروعاً")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">Decision support, not professional certification. Assumptions and evidence remain visible.</p>
        </div>

        <div className="relative">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent opacity-70 blur-3xl" aria-hidden="true" />
          <div className="relative rounded-2xl border border-border bg-card p-4 shadow-[0_28px_70px_rgba(32,38,34,0.12)] sm:p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project decision</p><p className="mt-1 font-semibold">Dubai residential concept</p></div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">Review required</span>
            </div>
            <div className="grid gap-3 py-5 sm:grid-cols-3">
              <PreviewMetric label="Readiness" value="8 of 10" note="2 assumptions" />
              <PreviewMetric label="Decision" value="Conditional" note="3 priority risks" />
              <PreviewMetric label="Evidence" value="Scoped" note="UAE sources" />
            </div>
            <div className="rounded-xl bg-secondary/70 p-4">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Next decision</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Confirm the fit-out budget and review the execution-risk assumptions before evaluation.</p></div></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {["Project inputs remain explicit", "Evidence provenance is visible", "Calculations are deterministic", "Outputs retain assumptions"].map(item => <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{item}</div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-px bg-border md:grid-cols-3">
          {stages.map(stage => <article key={stage.number} className="bg-card p-8 md:p-10"><span className="font-mono text-xs text-primary">{stage.number}</span><h2 className="mt-6 font-serif text-3xl">{stage.title}</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{stage.copy}</p></article>)}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:grid-cols-3 md:px-8">
        <Capability icon={Layers3} title="One project workspace" copy="Move from decision to design, evidence and deliverables without losing context." />
        <Capability icon={FileCheck2} title="Evidence before assertion" copy="See provenance, freshness and insufficiency instead of precise-looking unsupported numbers." />
        <Capability icon={ShieldCheck} title="Organization isolated" copy="Your organization’s projects and learning corpus remain separated from other tenants." />
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">MIYAR · UAE design-decision intelligence</footer>
    </main>
  );
}

function PreviewMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border border-border p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function Capability({ icon: Icon, title, copy }: { icon: typeof Layers3; title: string; copy: string }) {
  return <article><Icon className="h-5 w-5 text-primary" /><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p></article>;
}
