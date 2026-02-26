/**
 * i18n / Localization Support (P3-6)
 *
 * Lightweight client-side translation system.
 * No external dependencies — uses a simple key-value map.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   t("dashboard.title")  → "Dashboard" | "لوحة القيادة"
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ─── Translation Dictionaries ───────────────────────────────────────────────

type TranslationMap = Record<string, string>;

const translations: Record<string, TranslationMap> = {
    en: {
        // Navigation
        "nav.dashboard": "Dashboard",
        "nav.projects": "Projects",
        "nav.newProject": "New Project",
        "nav.results": "Results",
        "nav.scenarios": "Scenarios",
        "nav.reports": "Reports",
        "nav.portfolio": "Portfolio",
        "nav.riskHeatmap": "Risk Heatmap",
        "nav.biasInsights": "Bias Insights",
        "nav.simulations": "Simulations",
        "nav.customerSuccess": "Customer Success",
        "nav.sustainability": "Sustainability",
        "nav.admin": "Administration",
        // Common actions
        "action.save": "Save",
        "action.cancel": "Cancel",
        "action.delete": "Delete",
        "action.edit": "Edit",
        "action.export": "Export",
        "action.search": "Search",
        "action.filter": "Filter",
        "action.signIn": "Sign in",
        "action.signOut": "Sign out",
        "action.next": "Next",
        "action.back": "Back",
        "action.create": "Create",
        // Dashboard
        "dashboard.title": "Dashboard",
        "dashboard.totalProjects": "Total Projects",
        "dashboard.avgScore": "Average Score",
        "dashboard.pendingEvals": "Pending Evaluations",
        "dashboard.recentActivity": "Recent Activity",
        // Project
        "project.name": "Project Name",
        "project.location": "Location",
        "project.area": "Gross Floor Area (m²)",
        "project.status": "Status",
        "project.score": "Composite Score",
        "project.evaluated": "Evaluated",
        "project.draft": "Draft",
        // Scoring dimensions
        "score.sa": "Scoring Accuracy",
        "score.ff": "Forecast Fidelity",
        "score.mp": "Market Position",
        "score.ds": "Data Strength",
        "score.er": "Evidence Reliability",
        // Sustainability
        "sustainability.carbonFootprint": "Carbon Footprint",
        "sustainability.energyRating": "Energy Rating",
        "sustainability.lifecycleCost": "Lifecycle Cost (30yr)",
        "sustainability.grade": "Sustainability Grade",
        // Common
        "common.loading": "Loading...",
        "common.noData": "No data available",
        "common.error": "Something went wrong",
        "common.confirm": "Are you sure?",
    },

    ar: {
        // Navigation
        "nav.dashboard": "لوحة القيادة",
        "nav.projects": "المشاريع",
        "nav.newProject": "مشروع جديد",
        "nav.results": "النتائج",
        "nav.scenarios": "السيناريوهات",
        "nav.reports": "التقارير",
        "nav.portfolio": "المحفظة",
        "nav.riskHeatmap": "خريطة المخاطر",
        "nav.biasInsights": "رؤى التحيز",
        "nav.simulations": "المحاكاة",
        "nav.customerSuccess": "نجاح العملاء",
        "nav.sustainability": "الاستدامة",
        "nav.admin": "الإدارة",
        // Common actions
        "action.save": "حفظ",
        "action.cancel": "إلغاء",
        "action.delete": "حذف",
        "action.edit": "تعديل",
        "action.export": "تصدير",
        "action.search": "بحث",
        "action.filter": "تصفية",
        "action.signIn": "تسجيل الدخول",
        "action.signOut": "تسجيل الخروج",
        "action.next": "التالي",
        "action.back": "رجوع",
        "action.create": "إنشاء",
        // Dashboard
        "dashboard.title": "لوحة القيادة",
        "dashboard.totalProjects": "إجمالي المشاريع",
        "dashboard.avgScore": "متوسط التقييم",
        "dashboard.pendingEvals": "التقييمات المعلقة",
        "dashboard.recentActivity": "النشاط الأخير",
        // Project
        "project.name": "اسم المشروع",
        "project.location": "الموقع",
        "project.area": "المساحة الإجمالية (م²)",
        "project.status": "الحالة",
        "project.score": "التقييم الشامل",
        "project.evaluated": "تم التقييم",
        "project.draft": "مسودة",
        // Scoring dimensions
        "score.sa": "دقة التسجيل",
        "score.ff": "دقة التنبؤ",
        "score.mp": "وضع السوق",
        "score.ds": "قوة البيانات",
        "score.er": "موثوقية الأدلة",
        // Sustainability
        "sustainability.carbonFootprint": "البصمة الكربونية",
        "sustainability.energyRating": "تصنيف الطاقة",
        "sustainability.lifecycleCost": "تكلفة دورة الحياة (30 سنة)",
        "sustainability.grade": "درجة الاستدامة",
        // Common
        "common.loading": "جارٍ التحميل...",
        "common.noData": "لا توجد بيانات",
        "common.error": "حدث خطأ ما",
        "common.confirm": "هل أنت متأكد؟",
    },
};

// ─── Context ────────────────────────────────────────────────────────────────

type Locale = "en" | "ar";
const LOCALE_KEY = "miyar-locale";

interface I18nContext {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, fallback?: string) => string;
    dir: "ltr" | "rtl";
}

const I18nCtx = createContext<I18nContext>({
    locale: "en",
    setLocale: () => { },
    t: (key) => key,
    dir: "ltr",
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(() => {
        const saved = localStorage.getItem(LOCALE_KEY);
        return (saved === "ar" ? "ar" : "en") as Locale;
    });

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem(LOCALE_KEY, newLocale);
        document.documentElement.dir = newLocale === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = newLocale;
    }, []);

    const t = useCallback(
        (key: string, fallback?: string): string => {
            return translations[locale]?.[key] || translations.en[key] || fallback || key;
        },
        [locale],
    );

    const dir = locale === "ar" ? "rtl" : "ltr";

    return (
        <I18nCtx.Provider value={{ locale, setLocale, t, dir }}>
            {children}
        </I18nCtx.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTranslation() {
    return useContext(I18nCtx);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
    { code: "en", label: "English", dir: "ltr" },
    { code: "ar", label: "العربية", dir: "rtl" },
];
