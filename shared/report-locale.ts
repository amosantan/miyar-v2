/**
 * Report locale contract shared by browser controls and server-side renderers.
 *
 * This intentionally has no React or server dependency: router validators,
 * render engines, and export controls must agree on the same two issued
 * locales without importing one another's runtime.
 */
export const REPORT_LOCALES = ["en", "ar"] as const;

export type ReportLocale = (typeof REPORT_LOCALES)[number];

export type ReportDirection = "ltr" | "rtl";

export interface ReportLocaleOption {
  code: ReportLocale;
  label: string;
  nativeLabel: string;
  direction: ReportDirection;
}

export const REPORT_LOCALE_OPTIONS: readonly ReportLocaleOption[] = [
  { code: "en", label: "English", nativeLabel: "English", direction: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", direction: "rtl" },
] as const;

export function isReportLocale(value: unknown): value is ReportLocale {
  return typeof value === "string" && (REPORT_LOCALES as readonly string[]).includes(value);
}

/**
 * Normalize optional external input at a non-router boundary. Routers should
 * still use an explicit enum validator so malformed public query values fail
 * closed rather than silently changing the issued language.
 */
export function reportLocaleOrDefault(value: unknown, fallback: ReportLocale = "en"): ReportLocale {
  return isReportLocale(value) ? value : fallback;
}

export function reportDirection(locale: ReportLocale): ReportDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function reportLanguageTag(locale: ReportLocale): "en" | "ar" {
  return locale;
}
