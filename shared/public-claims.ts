export type PublicClaimSurface = "home" | "methodology" | "public_share" | "customer";

export type BilingualClaim = Readonly<{
  en: string;
  ar: string;
}>;

export type PublicClaimEntry = Readonly<{
  id: string;
  surface: PublicClaimSurface;
  copy: BilingualClaim;
  evidence: "runtime_dld_snapshot" | "versioned_deterministic_contract" | "explicit_project_input" | "labelled_assumption";
  qualification: string;
}>;

export const DLD_PUBLIC_SOURCE = Object.freeze({
  nameEn: "Dubai Land Department",
  nameAr: "دائرة الأراضي والأملاك في دبي",
  url: "https://dubailand.gov.ae/en/open-data/real-estate-data/",
} as const);

export const PUBLIC_CLAIMS = Object.freeze({
  homeEvidenceTitle: {
    id: "home.dld.indexed_subset",
    surface: "home",
    copy: {
      en: "Official-source market evidence",
      ar: "أدلة سوق من مصدر رسمي",
    },
    evidence: "runtime_dld_snapshot",
    qualification: "Always identify this as MIYAR's indexed subset, never complete DLD coverage.",
  },
  observedThrough: {
    id: "market.observed_through",
    surface: "home",
    copy: { en: "Observed through", ar: "تغطي السجلات حتى" },
    evidence: "runtime_dld_snapshot",
    qualification: "Record coverage date only; not a refresh or ingestion-success timestamp.",
  },
  indexedSubset: {
    id: "market.indexed_subset",
    surface: "home",
    copy: { en: "MIYAR indexed subset", ar: "مجموعة فرعية مفهرسة لدى مِعيار" },
    evidence: "runtime_dld_snapshot",
    qualification: "No completeness, live, daily, current, or weekly claim.",
  },
  evidenceUnavailable: {
    id: "market.unavailable",
    surface: "home",
    copy: {
      en: "The indexed market-evidence snapshot is currently unavailable.",
      ar: "لقطة أدلة السوق المفهرسة غير متاحة حالياً.",
    },
    evidence: "runtime_dld_snapshot",
    qualification: "Fail closed; do not reuse a stale success after an evidence failure.",
  },
  scoreDimensions: {
    id: "methodology.score_dimensions",
    surface: "methodology",
    copy: {
      en: "MIYAR evaluates five deterministic scoring dimensions.",
      ar: "يقيّم مِعيار خمسة أبعاد تسجيل حتمية.",
    },
    evidence: "versioned_deterministic_contract",
    qualification: "Weights may be shown only from an approved versioned scoring contract.",
  },
  certificationTarget: {
    id: "share.certification_target",
    surface: "public_share",
    copy: { en: "Project target — not certification", ar: "هدف للمشروع — وليس شهادة" },
    evidence: "explicit_project_input",
    qualification: "Never infer an achieved certification from a default or proxy.",
  },
  marketTierProxy: {
    id: "share.market_tier_proxy",
    surface: "public_share",
    copy: { en: "Market-tier proxy", ar: "مؤشر تقريبي لفئة السوق" },
    evidence: "labelled_assumption",
    qualification: "A proxy is not a sustainability grade, compliance finding, or certification.",
  },
  estimateAssumption: {
    id: "share.estimate_assumption",
    surface: "public_share",
    copy: { en: "Indicative estimate based on stated assumptions", ar: "تقدير استرشادي مبني على افتراضات معلنة" },
    evidence: "labelled_assumption",
    qualification: "Place adjacent to cost, premium, yield, and uplift values.",
  },
  approvedBenchmarkObservation: {
    id: "customer.approved_benchmark_observation",
    surface: "customer",
    copy: { en: "Approved benchmark observation", ar: "مشاهدة معيارية معتمدة" },
    evidence: "versioned_deterministic_contract",
    qualification: "Approved does not mean live, complete, or professionally verified; show available provenance.",
  },
  freshnessUnknown: {
    id: "customer.freshness_unknown",
    surface: "customer",
    copy: { en: "Freshness unknown", ar: "حداثة البيانات غير معروفة" },
    evidence: "runtime_dld_snapshot",
    qualification: "Required when no governed source has a known observation date.",
  },
} satisfies Record<string, PublicClaimEntry>);

export const PUBLIC_CLAIM_REGISTRY = Object.freeze(Object.values(PUBLIC_CLAIMS));
