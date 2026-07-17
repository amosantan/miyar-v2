import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function OnboardingFlow() {
  const { user } = useAuth();
  const { data: projects } = trpc.project.list.useQuery(undefined, { enabled: !!user });
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState(false);
  const key = user ? `miyar-redesign-intro-v1:${user.id}` : null;

  useEffect(() => {
    if (key && projects) setVisible(localStorage.getItem(key) !== "complete");
  }, [key, projects]);

  if (!visible || !key || !projects) return null;
  const returning = projects.length > 0;
  const close = () => { localStorage.setItem(key, "complete"); setVisible(false); };

  return (
    <aside className="fixed bottom-20 left-3 right-3 z-[70] mx-auto max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl lg:bottom-6 lg:left-auto lg:right-6" role="dialog" aria-label={returning ? "What moved in MIYAR" : "Start with MIYAR"}>
      <button onClick={close} className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary" aria-label="Dismiss"><X className="h-4 w-4" /></button>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{returning ? "A simpler MIYAR" : "Your first decision"}</p>
      <h2 className="mt-2 font-serif text-2xl">{returning ? "Everything is still here—just easier to find." : "Start with what you know."}</h2>
      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
        {(returning ? ["Projects now use Decision, Design, Evidence and Deliverables.", "Advanced tools remain available in context and search.", "Your existing projects, links and calculations are unchanged."] : ["Create a draft from six essential project details.", "Use readiness to separate missing facts from assumptions.", "Confirm inputs before the first evaluation."]).map(item => <div key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{item}</span></div>)}
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Got it</Button><Button className="gap-2" onClick={() => { close(); setLocation(returning ? "/projects" : "/projects/new"); }}>{returning ? "Open projects" : "Start a project"}<ArrowRight className="h-4 w-4" /></Button></div>
    </aside>
  );
}
