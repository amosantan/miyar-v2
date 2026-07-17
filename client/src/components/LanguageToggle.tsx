import { Languages } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useTranslation();
  const next = locale === "en" ? "ar" : "en";
  return (
    <button type="button" onClick={() => setLocale(next)} aria-label={next === "ar" ? "استخدام العربية" : "Use English"} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Languages className="h-4 w-4" />{!compact && <span>{next === "ar" ? "العربية" : "English"}</span>}
    </button>
  );
}
