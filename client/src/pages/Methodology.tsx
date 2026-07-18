import { AlertTriangle, Brain, Database, Leaf, Scale, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { DLD_PUBLIC_SOURCE, PUBLIC_CLAIMS } from "@shared/public-claims";

const dimensions = [
  ["SA", "Strategic Alignment", "المواءمة الاستراتيجية"],
  ["FF", "Financial Feasibility", "الجدوى المالية"],
  ["MP", "Market Positioning", "التموضع السوقي"],
  ["DS", "Design Suitability", "ملاءمة التصميم"],
  ["ER", "Execution Risk", "مخاطر التنفيذ"],
] as const;

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

export default function Methodology() {
  const { locale } = useTranslation();
  const text = (en: string, ar: string) => locale === "ar" ? ar : en;
  const claim = (copy: { en: string; ar: string }) => locale === "ar" ? copy.ar : copy.en;

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center gap-3"><Scale className="h-7 w-7 text-primary" /><h1 className="text-3xl font-bold">{text("MIYAR Methodology", "منهجية مِعيار")}</h1></div>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{text("How MIYAR separates deterministic scoring, official market observations, assumptions and AI assistance.", "كيف يفصل مِعيار بين التسجيل الحتمي ومشاهدات السوق الرسمية والافتراضات ومساعدة الذكاء الاصطناعي.")}</p>
        <div className="mt-6 flex gap-2"><Badge variant="outline">{text("UAE focus", "تركيز إماراتي")}</Badge><Badge variant="outline">{text("Decision support", "دعم القرار")}</Badge></div>
      </div>
    </header>

    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <Section icon={Target} title={text("Deterministic score — five dimensions", "تسجيل حتمي — خمسة أبعاد")}>
        <p className="mb-4 text-sm text-muted-foreground">{claim(PUBLIC_CLAIMS.scoreDimensions.copy)} {text("The active engine applies its versioned contract; this page does not publish fixed weights without an approved contract.", "يطبق المحرك النشط عقده ذا الإصدار المحدد؛ ولا تنشر هذه الصفحة أوزاناً ثابتة دون عقد معتمد.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {dimensions.map(([code, en, ar]) => <div key={code} className="rounded-lg border border-border/60 p-3"><span className="font-mono text-xs text-primary">{code}</span><p className="mt-1 text-sm font-medium">{text(en, ar)}</p></div>)}
        </div>
      </Section>

      <Section icon={Database} title={text("Official observations and MIYAR assumptions", "المشاهدات الرسمية وافتراضات مِعيار")}>
        <p className="text-sm leading-6 text-muted-foreground">{text("MIYAR indexes a subset of official DLD open real-estate records for factual market context. DLD transaction and rent records do not validate MIYAR fit-out costs, design premiums or investment outcomes. Those values remain separately identified benchmarks, project inputs or assumptions with their available provenance.", "يفهرس مِعيار مجموعة فرعية من سجلات البيانات العقارية المفتوحة الرسمية لدى دائرة الأراضي والأملاك لتوفير سياق سوقي واقعي. لا تثبت معاملات الدائرة وعقود الإيجار تكاليف التجهيز أو علاوات التصميم أو النتائج الاستثمارية لدى مِعيار. وتبقى هذه القيم معرّفة بشكل منفصل كمعايير أو مدخلات مشروع أو افتراضات مع مصدرها المتاح.")}</p>
        <a className="mt-4 inline-block text-sm font-medium text-primary hover:underline" href={DLD_PUBLIC_SOURCE.url} target="_blank" rel="noreferrer">{locale === "ar" ? DLD_PUBLIC_SOURCE.nameAr : DLD_PUBLIC_SOURCE.nameEn}</a>
      </Section>

      <Section icon={Brain} title={text("AI boundaries", "حدود الذكاء الاصطناعي")}>
        <p className="text-sm leading-6 text-muted-foreground">{text("AI may extract, translate, suggest and draft narrative direction. It does not compute MIYAR scores, set prices, promote benchmarks or silently replace explicit developer inputs. Authoritative numerical calculations remain deterministic TypeScript.", "يمكن للذكاء الاصطناعي الاستخراج والترجمة والاقتراح وصياغة التوجه السردي. ولا يحسب درجات مِعيار أو يحدد الأسعار أو يعتمد المعايير أو يستبدل مدخلات المطور الصريحة دون إعلان. وتبقى الحسابات الرقمية المعتمدة حتمية في TypeScript.")}</p>
      </Section>

      <Section icon={Leaf} title={text("Sustainability targets and proxies", "أهداف ومؤشرات الاستدامة")}>
        <p className="text-sm leading-6 text-muted-foreground">{text("MIYAR can organize sustainability targets, checklists and indicative proxies. They are not achieved Al Sa'fat, Estidama or other professional certification, and they do not replace an authority or qualified assessor.", "يمكن لمِعيار تنظيم أهداف الاستدامة وقوائم التحقق والمؤشرات الاسترشادية. ولا تمثل هذه الأدوات شهادة الصافات أو استدامة أو أي اعتماد مهني محقق، ولا تحل محل جهة مختصة أو مقيّم مؤهل.")}</p>
      </Section>

      <Section icon={Scale} title={text("Classification mappings", "خرائط التصنيف")}>
        <p className="text-sm leading-6 text-muted-foreground">{text("Where MIYAR displays NRM or other information-standard codes, they are working mappings for comparison and handoff. They do not claim RICS endorsement, conformity, QS validation or institutional certification.", "عندما يعرض مِعيار رموز NRM أو معايير معلومات أخرى، فهي خرائط عمل للمقارنة والتسليم. ولا تعني اعتماد RICS أو المطابقة أو تصديق مسّاح كميات أو شهادة مؤسسية.")}</p>
      </Section>

      <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex gap-3 p-6"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><p className="font-semibold">{text("Important qualification", "تنبيه مهم")}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{text("MIYAR provides decision support, not investment advice or professional certification. Cost, premium and yield values are indicative unless an explicitly identified approved contract says otherwise. Users should perform independent due diligence.", "يوفر مِعيار دعماً للقرار وليس نصيحة استثمارية أو اعتماداً مهنياً. وتعد قيم التكلفة والعلاوة والعائد استرشادية ما لم ينص عقد معتمد ومحدد صراحة على غير ذلك. ينبغي للمستخدمين إجراء العناية الواجبة المستقلة.")}</p></div></CardContent></Card>
    </main>
  </div>;
}
