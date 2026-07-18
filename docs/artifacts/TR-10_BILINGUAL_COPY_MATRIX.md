# TR-10 Bilingual Issued-Copy Review Matrix

Status: **APPROVED**

Approval record: The task's product/report owner approved the exact bilingual legal and financial wording on 2026-07-18 for catalog version `tr10-report-copy-v1`, with no wording corrections requested.

This matrix is generated from the deterministic server-owned catalog in `server/engines/report-catalog.ts`. Approval applies to the exact Arabic legal, disclaimer, identity, evidence, and financial-qualifier wording below. English branding terms such as MIYAR and technical/version values remain unchanged. Dynamic customer/project/evidence content is escaped and direction-isolated but is not translated by this catalog.

The catalog is implementation evidence, not legal advice. Any requested wording change must preserve the English meaning and must not alter scoring, thresholds, financial policy, or report identity.

| Key | English | Arabic |
|---|---|---|
| `language` | Report language | لغة التقرير |
| `english` | English | الإنجليزية |
| `arabic` | Arabic | العربية |
| `generated` | Generated | تم الإنشاء |
| `generatedAt` | Generated at | تاريخ الإنشاء |
| `documentId` | Document ID | معرّف المستند |
| `renderInputFingerprint` | Render-input fingerprint | بصمة مدخلات العرض |
| `renderInputFingerprintHelp` | Debugging fingerprint of the documented render inputs; it is not an immutable issued snapshot or evidence-chain hash. | بصمة تصحيح أخطاء لمدخلات العرض الموثقة؛ وليست لقطة إصدار غير قابلة للتغيير أو تجزئة لسلسلة أدلة. |
| `artifactVersion` | Artifact version | إصدار المخرج |
| `rendererVersion` | Renderer version | إصدار محرك العرض |
| `modelVersion` | Model version | إصدار النموذج |
| `benchmarkVersion` | Benchmark version | إصدار المعيار المرجعي |
| `logicVersion` | Logic version | إصدار المنطق |
| `reportLocale` | Report language | لغة التقرير |
| `readOnly` | Read-only | للعرض فقط |
| `sharedBrief` | Shared brief | موجز مشترك |
| `expires` | Expires | تنتهي الصلاحية |
| `linkUnavailable` | Link unavailable | الرابط غير متاح |
| `sharedLinkUnavailable` | This share link is invalid or has expired. | رابط المشاركة هذا غير صالح أو انتهت صلاحيته. |
| `loadingSharedBrief` | Loading shared brief… | جارٍ تحميل الموجز المشترك… |
| `noData` | No data available. | لا توجد بيانات متاحة. |
| `noContentGenerated` | No content generated. | لم يتم إنشاء محتوى. |
| `noAllocations` | No allocations available. | لا توجد تخصيصات متاحة. |
| `notAvailable` | — | — |
| `confidentialInternalOnly` | Confidential — For Internal Use Only | سري — للاستخدام الداخلي فقط |
| `executiveDecisionPack` | Executive Decision Pack | حزمة القرار التنفيذي |
| `validationSummarySubtitle` | Interior Design Direction Assessment | تقييم توجه التصميم الداخلي |
| `designBriefTitle` | Interior Design Instruction Brief | موجز تعليمات التصميم الداخلي |
| `designBriefSubtitle` | Technical Specification & Execution Workflows | المواصفات الفنية وإجراءات التنفيذ |
| `fullReport` | Full Evaluation Report | تقرير التقييم الكامل |
| `fullReportSubtitle` | Comprehensive Decision Intelligence Analysis | تحليل شامل لذكاء القرار |
| `autonomousDesignBrief` | Autonomous Design Brief | موجز التصميم المستقل |
| `autonomousDesignBriefSubtitle` | AI-Generated Concept & Technical Specification | مواصفات مفاهيمية وفنية مولّدة بالذكاء الاصطناعي |
| `scenarioComparisonPack` | Scenario Comparison Pack | حزمة مقارنة السيناريوهات |
| `scenarioComparisonSubtitle` | Decision Trade-off Analysis | تحليل المفاضلات في القرار |
| `portfolioReport` | Portfolio Intelligence Report | تقرير ذكاء المحفظة |
| `materialBoard` | Material Board | لوحة المواد |
| `investorSummary` | Investor Summary | ملخص المستثمر |
| `executiveSummary` | Executive Summary | الملخص التنفيذي |
| `dimensionScores` | Dimension Scores | درجات الأبعاد |
| `radarProfile` | Radar Profile | ملف الرادار |
| `riskAssessment` | Risk Assessment | تقييم المخاطر |
| `sensitivityAnalysis` | Sensitivity Analysis | تحليل الحساسية |
| `conditionalActions` | Conditional Actions | الإجراءات المشروطة |
| `designDirectionParameters` | Design Direction Parameters | معايير توجه التصميم |
| `variableContributions` | Variable Contributions | مساهمات المتغيرات |
| `roiAnalysis` | ROI Analysis | تحليل العائد على الاستثمار |
| `evidenceReferences` | Evidence References | مراجع الأدلة |
| `evidenceReferenceDescription` | The following evidence records were linked to this project at the time of report generation. | تم ربط سجلات الأدلة التالية بهذا المشروع عند إنشاء التقرير. |
| `evidenceTrace` | Evidence Trace & Render Context | سياق الأدلة والعرض |
| `inputSummary` | Input Summary | ملخص المدخلات |
| `materialBoardAnnex` | Material Board Annex | ملحق لوحة المواد |
| `scenarioScoreComparison` | Scenario Score Comparison | مقارنة درجات السيناريوهات |
| `roiComparison` | ROI Comparison | مقارنة العائد على الاستثمار |
| `tradeoffAnalysis` | Trade-off Analysis | تحليل المفاضلات |
| `decisionNote` | Decision Note | ملاحظة القرار |
| `baseline` | Baseline | خط الأساس |
| `scenario` | Scenario | السيناريو |
| `dimension` | Dimension | البعد |
| `compositeScore` | Composite Score | الدرجة المركبة |
| `roiMetric` | ROI Metric | مؤشر العائد على الاستثمار |
| `totalValueCreated` | Total Value Created | إجمالي القيمة المتحققة |
| `reworkAvoided` | Rework Avoided | إعادة العمل المتجنبة |
| `procurementSavings` | Procurement Savings | وفورات الشراء |
| `timeValueGain` | Time-Value Gain | مكسب قيمة الوقت |
| `projectIdentity` | Project Identity | هوية المشروع |
| `designNarrative` | Design Narrative | السرد التصميمي |
| `materialSpecifications` | Material Specifications | مواصفات المواد |
| `targetBoqFramework` | Target BOQ Framework | إطار جدول الكميات المستهدف |
| `detailedBudgetGuardrails` | Detailed Budget Guardrails | ضوابط الميزانية التفصيلية |
| `workflowExecutionInstructions` | Workflow and Execution Instructions | تعليمات سير العمل والتنفيذ |
| `phasedDeliverables` | Phased Deliverables | المخرجات المرحلية |
| `parameter` | Parameter | المعيار |
| `value` | Value | القيمة |
| `category` | Category | الفئة |
| `allocation` | Allocation | التخصيص |
| `estimatedBudget` | Estimated Budget | الميزانية التقديرية |
| `notes` | Notes | ملاحظات |
| `source` | Source | المصدر |
| `captured` | Captured | تاريخ الالتقاط |
| `grade` | Grade | الدرجة |
| `reference` | Reference | المرجع |
| `validated` | Validated | تم التحقق |
| `conditionallyValidated` | Conditionally validated | تم التحقق بشروط |
| `notValidated` | Not validated | لم يتم التحقق |
| `importantDisclaimer` | Important disclaimer | إخلاء مسؤولية مهم |
| `disclaimer` | This document is a concept-level assessment generated by the MIYAR Decision Intelligence Platform. Scores, recommendations, specifications, cost estimates, and procurement guidance are advisory only. They require detailed design, engineering review, professional validation, and formal tender confirmation where applicable. MIYAR does not warrant third-party benchmark data or market intelligence. This document is not professional design, financial, or legal advice. | هذا المستند تقييم على مستوى المفهوم أُنشئ بواسطة منصة MIYAR لذكاء القرار. الدرجات والتوصيات والمواصفات وتقديرات التكلفة وإرشادات الشراء استشارية فقط. وهي تتطلب تصميماً تفصيلياً ومراجعة هندسية وتحققاً مهنياً وتأكيداً من خلال مناقصة رسمية عند الاقتضاء. لا تضمن MIYAR بيانات المعايير المرجعية أو معلومات السوق المقدمة من أطراف ثالثة. هذا المستند ليس مشورة مهنية في التصميم أو الشؤون المالية أو القانونية. |
| `investorFallbackAssumption` | Ungoverned MIYAR fallback assumption | افتراض احتياطي غير محكوم من MIYAR |
| `investorFallbackAssumptionHelp` | This calculation uses hardcoded MIYAR tier mappings and the AED 25,000 per m² baseline unconditionally, regardless of available project evidence. It is indicative only and must not be treated as a market valuation or investment recommendation. | يستخدم هذا الحساب تعيينات شرائح MIYAR مُشفّرة مسبقاً وأساساً قدره 25,000 درهم لكل م² دون قيد، بصرف النظر عن توفر أدلة المشروع. وهو استرشادي فقط ولا يجوز اعتباره تقييماً سوقياً أو توصية استثمارية. |
| `roiNarrativeFallbackDenominator` | ROI multiple is calculated as total value divided by the ungoverned MIYAR fallback denominator of AED 150,000. It is indicative only and is not a market valuation or investment recommendation. | يُحسب مضاعف العائد على الاستثمار بقسمة إجمالي القيمة على مقام احتياطي غير محكوم من MIYAR قدره 150,000 درهم. وهو استرشادي فقط ولا يمثل تقييماً سوقياً أو توصية استثمارية. |
| `scoresAdvisory` | Scores are advisory and do not constitute professional design or financial advice. | الدرجات استشارية ولا تشكل مشورة مهنية في التصميم أو الشؤون المالية. |
| `allSpaces` | All spaces | جميع المساحات |
| `costPerSquareMetre` | Cost / m² | التكلفة / م² |
| `totalFitout` | Total fit-out | إجمالي التجهيز الداخلي |
| `designPremium` | Design premium | العلاوة التصميمية |

## Required approval record

Approved by the task's product/report owner on 2026-07-18 for catalog version `tr10-report-copy-v1`. Exact wording corrections: none.

Approval applies uniformly to every row, including the high-risk disclaimer, fallback-assumption, fingerprint-help, scores-advisory, read-only, and share-link failure wording. Any later row change requires a new catalog version and approval record.
