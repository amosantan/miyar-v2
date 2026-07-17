import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, Database, Gauge, HeartPulse, Menu, Scale, Settings2, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";

type AdminGroup = {
  label: string;
  icon: typeof Database;
  items: readonly (readonly [string, string])[];
};

const groups: readonly AdminGroup[] = [
  { label: "Data & Sources", icon: Database, items: [
    ["Evidence vault", "/market-intel/evidence"], ["Source registry", "/market-intel/sources"], ["CSV import", "/admin/csv-import"], ["Materials", "/admin/materials"], ["Ingestion", "/market-intel/ingestion"],
  ] },
  { label: "Benchmarks & Models", icon: Scale, items: [
    ["Benchmarks", "/admin/benchmarks"], ["Versions", "/admin/benchmark-versions"], ["Categories", "/admin/benchmark-categories"], ["Models", "/admin/models"], ["ROI configuration", "/admin/roi-config"], ["Calibration", "/admin/calibration"], ["Logic registry", "/admin/logic-registry"],
  ] },
  { label: "Governance", icon: ShieldCheck, items: [
    ["Benchmark proposals", "/market-intel/proposals"], ["Overrides", "/admin/overrides"], ["Audit logs", "/admin/audit"], ["Intelligence audit", "/market-intel/audit"], ["Prompt templates", "/admin/prompt-templates"],
  ] },
  { label: "Operations", icon: HeartPulse, items: [
    ["Control center", "/admin"], ["Benchmark health", "/admin/benchmark-health"], ["Connector health", "/admin/connector-health"], ["Data health", "/market-intel/data-health"], ["Learning", "/admin/learning-dashboard"], ["Benchmark learning", "/admin/benchmark-learning"], ["Analytics", "/market-intel/analytics"], ["Webhooks", "/admin/webhooks"], ["Portfolio operations", "/admin/portfolio"],
  ] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap(group => group.items).find(([, path]) => location === path)?.[0] ?? "Control center";

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {open && <button className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <aside data-admin-sidebar data-open={open} className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-sidebar-border bg-sidebar transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <button onClick={() => setLocation("/dashboard")} className="text-left">
            <span className="block font-serif text-xl">MIYAR</span><span className="text-xs text-muted-foreground">Control center</span>
          </button>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button>
        </div>
        <nav className="h-[calc(100vh-5rem)] overflow-y-auto p-3" aria-label="Administration">
          {groups.map(group => (
            <section key={group.label} className="mb-5">
              <h2 className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><group.icon className="h-3.5 w-3.5" />{group.label}</h2>
              <div className="space-y-0.5">
                {group.items.map(([label, path]) => (
                  <button key={path} onClick={() => { setLocation(path); setOpen(false); }} className={`w-full rounded-md px-3 py-2 text-left text-sm ${location === path ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"}`}>{label}</button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <div data-admin-content className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <div><p className="text-sm font-semibold">{current}</p><p className="hidden text-xs text-muted-foreground sm:block">Platform governance · {user?.email}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/dashboard")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:bg-secondary"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to MIYAR</span></button>
            <ThemeToggle compact />
            <LanguageToggle compact />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const [, setLocation] = useLocation();
  return (
    <div className="space-y-8">
      <div><p className="text-sm font-medium text-primary">Platform administration</p><h1 className="mt-2 font-serif text-4xl">Control center</h1><p className="mt-3 max-w-2xl text-muted-foreground">Manage governed data, benchmarks, models and platform operations without mixing administrative tools into the project workflow.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map(group => <button key={group.label} onClick={() => setLocation(group.items[0][1])} className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"><group.icon className="h-5 w-5 text-primary" /><h2 className="mt-4 font-semibold">{group.label}</h2><p className="mt-1 text-sm text-muted-foreground">{group.items.length} governed tools</p></button>)}
      </div>
      <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><Gauge className="h-5 w-5 text-primary" /><div><h2 className="font-semibold">Operational discipline</h2><p className="text-sm text-muted-foreground">Changes to public evidence, models and production data remain approval-gated and auditable.</p></div></div></div>
    </div>
  );
}
