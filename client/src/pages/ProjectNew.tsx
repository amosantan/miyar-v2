import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Info, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectForm } from "@/components/ProjectForm";
import { EVALUATION_REQUIRED_FIELDS, type InputProvenance } from "@shared/project-readiness";
import { useTranslation } from "@/lib/i18n";

type Typology = "Residential" | "Mixed-use" | "Hospitality" | "Office" | "Villa" | "Gated Community" | "Villa Development";
type LocationClass = "Prime" | "Secondary" | "Emerging";
type Purpose = "sell_offplan" | "sell_ready" | "rent" | "mixed";

const typologies: Typology[] = ["Residential", "Mixed-use", "Hospitality", "Office", "Villa", "Gated Community", "Villa Development"];

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const { locale } = useTranslation();
  const text = (english: string, arabic: string) => locale === "ar" ? arabic : english;
  const [detailed, setDetailed] = useState(false);
  const [form, setForm] = useState({
    name: "", typology: "" as Typology | "", locationName: "", locationClass: "" as LocationClass | "",
    gfa: "", purpose: "" as Purpose | "", budget: "",
  });
  const create = trpc.project.create.useMutation();

  async function submitQuick(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.typology || !form.locationName.trim() || !form.locationClass || !form.gfa || !form.purpose) {
      toast.error("Complete the required project details");
      return;
    }
    const gfa = Number(form.gfa);
    const budget = form.budget ? Number(form.budget) : null;
    if (!Number.isFinite(gfa) || gfa <= 0 || (budget !== null && (!Number.isFinite(budget) || budget <= 0))) {
      toast.error("GFA and budget must be positive numbers");
      return;
    }
    const inputProvenance: InputProvenance = {
      name: "explicit", ctx01Typology: "explicit", ctx03Gfa: "explicit", ctx04Location: "explicit", projectPurpose: "explicit",
      fin01BudgetCap: budget === null ? "assumed" : "explicit",
    };
    try {
      const project = await create.mutateAsync({
        name: form.name.trim(), ctx01Typology: form.typology, ctx03Gfa: gfa,
        ctx04Location: form.locationClass, dldAreaName: form.locationName.trim(),
        projectPurpose: form.purpose, fin01BudgetCap: budget, inputProvenance,
      });
      toast.success("Draft project created");
      setLocation(`/projects/${project.id}?section=decision`);
    } catch (error: any) {
      toast.error(error.message || "Could not create project");
    }
  }

  async function submitDetailed(data: any) {
    const inputProvenance = Object.fromEntries(EVALUATION_REQUIRED_FIELDS.map(field => [field, "confirmed"])) as InputProvenance;
    const project = await create.mutateAsync({ ...data, inputProvenance });
    toast.success("Project created with reviewed inputs");
    setLocation(`/projects/${project.id}?section=decision`);
  }

  if (detailed) {
    return (
      <div className="space-y-5">
        <button className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setDetailed(false)}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {text("Back to quick start", "العودة إلى البدء السريع")}</button>
        <div className="rounded-xl border border-border bg-secondary/60 p-4 text-sm text-muted-foreground"><strong className="text-foreground">{text("Detailed setup:", "الإعداد التفصيلي:")}</strong> {text("review every value shown before creating the project. AI Assist suggestions remain proposals until you submit this reviewed form.", "راجع كل قيمة معروضة قبل إنشاء المشروع. تبقى اقتراحات الذكاء الاصطناعي مقترحات حتى إرسال النموذج بعد مراجعته.")}</div>
        <ProjectForm onSubmit={submitDetailed} isPending={create.isPending} onCancel={() => setDetailed(false)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">{text("New project", "مشروع جديد")}</p><h1 className="mt-2 font-serif text-4xl tracking-tight">{text("Start with what you know.", "ابدأ بما تعرفه.")}</h1><p className="mt-3 max-w-2xl text-muted-foreground">{text("Create a draft in one screen. MIYAR will show what is missing or assumed before any evaluation can run.", "أنشئ مسودة في شاشة واحدة. سيعرض مِعيار المعلومات الناقصة والافتراضات قبل تشغيل أي تقييم.")}</p></div>
        <Button variant="outline" className="hidden gap-2 sm:flex" onClick={() => setDetailed(true)}><SlidersHorizontal className="h-4 w-4" /> {text("Detailed setup", "الإعداد التفصيلي")}</Button>
      </div>

      <form onSubmit={submitQuick} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card><CardContent className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
          <Field className="sm:col-span-2" label={text("Project name", "اسم المشروع")} required><Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder={text("e.g. Creek residential concept", "مثال: مشروع سكني في الخور")} autoFocus /></Field>
          <Field label={text("Typology", "نوع المشروع")} required><Select value={form.typology} onChange={value => setForm(v => ({ ...v, typology: value as Typology }))} placeholder={text("Choose typology", "اختر النوع")} options={typologies.map(value => [value, value])} /></Field>
          <Field label={text("Project purpose", "هدف المشروع")} required><Select value={form.purpose} onChange={value => setForm(v => ({ ...v, purpose: value as Purpose }))} placeholder={text("Choose purpose", "اختر الهدف")} options={[["sell_offplan", text("Sell off-plan", "البيع على الخارطة")], ["sell_ready", text("Sell completed", "البيع بعد الإنجاز")], ["rent", text("Build to rent", "البناء للتأجير")], ["mixed", text("Mixed strategy", "استراتيجية مختلطة")]]} /></Field>
          <Field label={text("Area or community", "المنطقة أو المجتمع")} required><Input value={form.locationName} onChange={e => setForm(v => ({ ...v, locationName: e.target.value }))} placeholder={text("e.g. Dubai Creek Harbour", "مثال: خور دبي")} /></Field>
          <Field label={text("Market context", "سياق السوق")} required><Select value={form.locationClass} onChange={value => setForm(v => ({ ...v, locationClass: value as LocationClass }))} placeholder={text("Choose context", "اختر السياق")} options={[["Prime", text("Prime", "رئيسي")], ["Secondary", text("Secondary", "ثانوي")], ["Emerging", text("Emerging", "ناشئ")]]} /></Field>
          <Field label={text("Gross floor area", "المساحة الإجمالية")} hint={text("sqm", "م²")} required><Input inputMode="decimal" type="number" min="1" value={form.gfa} onChange={e => setForm(v => ({ ...v, gfa: e.target.value }))} placeholder="12,500" /></Field>
          <Field label={text("Budget cap", "سقف الميزانية")} hint={text("AED / sqm · optional", "درهم / م² · اختياري")}><Input inputMode="decimal" type="number" min="1" value={form.budget} onChange={e => setForm(v => ({ ...v, budget: e.target.value }))} placeholder={text("Not known yet", "غير معروف بعد")} /></Field>
          <div className="sm:col-span-2 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setLocation("/projects")}>{text("Cancel", "إلغاء")}</Button>
            <Button type="submit" disabled={create.isPending} className="gap-2">{create.isPending ? text("Creating draft…", "جارٍ إنشاء المسودة…") : text("Create draft", "إنشاء المسودة")}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Button>
          </div>
        </CardContent></Card>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-primary" /><h2 className="font-semibold">{text("What happens next", "ماذا يحدث بعد ذلك")}</h2></div><ol className="mt-5 space-y-4 text-sm text-muted-foreground">{(locale === "ar" ? ["يُحفظ مشروعك كمسودة.", "تفصل قائمة الجاهزية بين المعلومات الناقصة والافتراضات.", "تؤكد المدخلات قبل التقييم."] : ["Your project is saved as a draft.", "A readiness checklist separates missing facts from assumptions.", "You confirm the inputs before evaluation."]).map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-foreground">{index + 1}</span><span className="pt-0.5">{item}</span></li>)}</ol></div>
          <div className="rounded-xl bg-secondary p-5"><div className="flex gap-3"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-sm leading-6 text-muted-foreground">Leaving budget unknown will not create a zero-value forecast. MIYAR will ask for it before evaluation.</p></div></div>
          <Button type="button" variant="outline" className="w-full gap-2 sm:hidden" onClick={() => setDetailed(true)}><SlidersHorizontal className="h-4 w-4" /> {text("Use detailed setup", "استخدام الإعداد التفصيلي")}</Button>
        </aside>
      </form>
    </div>
  );
}

function Field({ label, hint, required, className = "", children }: { label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={className}><div className="mb-2 flex items-baseline justify-between gap-3"><Label>{label}{required && <span className="ml-1 text-destructive">*</span>}</Label>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>{children}</div>;
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (value: string) => void; placeholder: string; options: string[][] }) {
  return <select value={value} onChange={event => onChange(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"><option value="">{placeholder}</option>{options.map(([option, label]) => <option value={option} key={option}>{label}</option>)}</select>;
}
