import { useEffect, useMemo, useState } from "react";
import type { BriefSectionContentV1Input } from "@shared/brief-section-content";
import { BRIEF_SECTION_CONTENT_SCHEMA_VERSION } from "@shared/brief-section-content";
import type { BriefSectionId } from "@shared/brief-contract";
import { AlertTriangle, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BriefStudioSection, BriefStudioView } from "./types";

const lines = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean);
const common = (sectionId: BriefSectionId, fields: Record<string, string>) => ({
  schemaVersion: BRIEF_SECTION_CONTENT_SCHEMA_VERSION,
  sectionId,
  summary: fields.summary?.trim(),
  requirements: [{
    ruleId: `${sectionId}.summary`,
    requirement: "required" as const,
    authority: "explicit_user_input" as const,
    impacts: ["coordination" as const],
  }],
  assumptions: lines(fields.assumptions ?? "").map((statement, index) => ({
    id: `${sectionId}-assumption-${index + 1}`,
    statement,
    impact: "coordination" as const,
    status: "open" as const,
  })),
});

export function buildBriefSectionContent(sectionId: BriefSectionId, fields: Record<string, string>): BriefSectionContentV1Input {
  const base = common(sectionId, fields);
  switch (sectionId) {
    case "intent": return { ...base, sectionId, objectives: lines(fields.primary), successCriteria: lines(fields.secondary), targetUsers: lines(fields.tertiary) };
    case "asset_context": return { ...base, sectionId, location: fields.primary, assetType: fields.secondary, developmentStage: fields.tertiary || undefined, constraints: lines(fields.extra) };
    case "space_programme": return { ...base, sectionId, spaces: lines(fields.primary).map(name => ({ name, quantity: 1 })), adjacencyNotes: fields.secondary || undefined };
    case "design_direction": return { ...base, sectionId, concept: fields.primary, styleKeywords: lines(fields.secondary), palette: lines(fields.tertiary), avoid: lines(fields.extra) };
    case "specification_intent": return { ...base, sectionId, performanceGoals: lines(fields.primary), materialPriorities: lines(fields.secondary), maintenanceRequirements: lines(fields.tertiary) };
    case "supply": return { ...base, sectionId, procurementStrategy: fields.primary, availabilityRequirements: lines(fields.secondary), leadTimeConstraints: lines(fields.tertiary), approvedAlternativesRequired: fields.extra !== "no" };
    case "risk_compliance": return { ...base, sectionId, risks: lines(fields.primary).map(title => ({ title, impact: "medium", mitigation: fields.secondary || "Qualified review and mitigation required." })), preliminaryChecks: lines(fields.tertiary), professionalReviewRequired: true };
    case "concept_media": return { ...base, sectionId, moodKeywords: lines(fields.primary), visualObjectives: lines(fields.secondary), negativeConstraints: lines(fields.tertiary), nonContractual: true };
    case "governance": return { ...base, sectionId, decisionOwners: lines(fields.primary).map(role => ({ role, responsibility: fields.secondary || "Review and record the decision." })), reviewCadence: fields.tertiary, approvalNotes: fields.extra || undefined };
    case "cost_quantities": {
      const metadata = {
        areaSource: fields.areaSource,
        areaSourceVersion: fields.areaSourceVersion,
        costBaseDate: fields.costBaseDate,
        inclusions: lines(fields.inclusions),
        exclusions: lines(fields.exclusions),
        feesIncluded: fields.feesIncluded === "yes",
        vatIncluded: fields.vatIncluded === "yes",
        contingencyIncluded: fields.contingencyIncluded === "yes",
        escalationIncluded: fields.escalationIncluded === "yes",
      };
      const budget = fields.budgetMode === "total_aed"
        ? { mode: "total_aed" as const, enteredTotalAed: fields.amount, metadata }
        : fields.budgetMode === "legacy_basis_unspecified"
          ? { mode: "legacy_basis_unspecified" as const, originalValue: fields.amount, note: fields.legacyNote }
          : { mode: "unit_rate" as const, enteredRate: fields.amount, rateUnit: (fields.rateUnit || "aed_per_m2") as "aed_per_m2" | "aed_per_ft2", areaBasis: (fields.areaBasis || "fitout") as "gifa" | "nia" | "saleable" | "fitout", enteredArea: fields.enteredArea, areaUnit: (fields.areaUnit || "m2") as "m2" | "ft2", metadata };
      return { ...base, sectionId, budget, costCategories: [] };
    }
  }
}

const fieldCopy: Record<BriefSectionId, { primary: string; secondary: string; tertiary: string; extra?: string }> = {
  intent: { primary: "Objectives (one per line)", secondary: "Success criteria (one per line)", tertiary: "Target users (one per line)" },
  asset_context: { primary: "Project location", secondary: "Asset type", tertiary: "Development stage", extra: "Constraints (one per line)" },
  space_programme: { primary: "Spaces (one per line)", secondary: "Adjacency and zoning notes", tertiary: "" },
  design_direction: { primary: "Design concept", secondary: "Style keywords (one per line)", tertiary: "Palette (one per line)", extra: "What to avoid (one per line)" },
  specification_intent: { primary: "Performance goals (one per line)", secondary: "Material priorities (one per line)", tertiary: "Maintenance requirements (one per line)" },
  cost_quantities: { primary: "", secondary: "", tertiary: "" },
  supply: { primary: "Procurement strategy", secondary: "Availability requirements (one per line)", tertiary: "Lead-time constraints (one per line)" },
  risk_compliance: { primary: "Risks (one per line)", secondary: "Mitigation approach", tertiary: "Preliminary compliance checks (one per line)" },
  concept_media: { primary: "Mood keywords (one per line)", secondary: "Visual objectives (one per line)", tertiary: "Negative constraints (one per line)" },
  governance: { primary: "Decision-owner roles (one per line)", secondary: "Responsibilities", tertiary: "Review cadence", extra: "Approval notes" },
};

function initialFields(section: BriefStudioSection) {
  const structured = section.contentState?.kind === "structured" ? section.contentState.content as Record<string, unknown> : undefined;
  const value = {
    summary: typeof structured?.summary === "string" ? structured.summary : "",
    primary: "",
    secondary: "",
    tertiary: "",
    extra: "",
    assumptions: section.assumptions.map(item => item.statement).join("\n"),
    budgetMode: "unit_rate",
    amount: "",
    rateUnit: "aed_per_m2",
    areaBasis: "fitout",
    enteredArea: "",
    areaUnit: "m2",
    areaSource: "",
    areaSourceVersion: "",
    costBaseDate: new Date().toISOString().slice(0, 10),
    inclusions: "",
    exclusions: "",
    feesIncluded: "no",
    vatIncluded: "no",
    contingencyIncluded: "no",
    escalationIncluded: "no",
    legacyNote: "",
  };
  if (!structured) return value;
  const join = (items: unknown) => Array.isArray(items) ? items.map(item => typeof item === "string" ? item : String((item as Record<string, unknown>)?.name ?? (item as Record<string, unknown>)?.title ?? (item as Record<string, unknown>)?.role ?? "")).filter(Boolean).join("\n") : "";
  if (section.sectionId === "intent") Object.assign(value, { primary: join(structured.objectives), secondary: join(structured.successCriteria), tertiary: join(structured.targetUsers) });
  if (section.sectionId === "asset_context") Object.assign(value, { primary: String(structured.location ?? ""), secondary: String(structured.assetType ?? ""), tertiary: String(structured.developmentStage ?? ""), extra: join(structured.constraints) });
  if (section.sectionId === "space_programme") Object.assign(value, { primary: join(structured.spaces), secondary: String(structured.adjacencyNotes ?? "") });
  if (section.sectionId === "design_direction") Object.assign(value, { primary: String(structured.concept ?? ""), secondary: join(structured.styleKeywords), tertiary: join(structured.palette), extra: join(structured.avoid) });
  if (section.sectionId === "specification_intent") Object.assign(value, { primary: join(structured.performanceGoals), secondary: join(structured.materialPriorities), tertiary: join(structured.maintenanceRequirements) });
  if (section.sectionId === "supply") Object.assign(value, { primary: String(structured.procurementStrategy ?? ""), secondary: join(structured.availabilityRequirements), tertiary: join(structured.leadTimeConstraints), extra: structured.approvedAlternativesRequired === false ? "no" : "yes" });
  if (section.sectionId === "risk_compliance") Object.assign(value, { primary: join(structured.risks), secondary: Array.isArray(structured.risks) ? String((structured.risks[0] as Record<string, unknown>)?.mitigation ?? "") : "", tertiary: join(structured.preliminaryChecks) });
  if (section.sectionId === "concept_media") Object.assign(value, { primary: join(structured.moodKeywords), secondary: join(structured.visualObjectives), tertiary: join(structured.negativeConstraints) });
  if (section.sectionId === "governance") Object.assign(value, { primary: join(structured.decisionOwners), secondary: Array.isArray(structured.decisionOwners) ? String((structured.decisionOwners[0] as Record<string, unknown>)?.responsibility ?? "") : "", tertiary: String(structured.reviewCadence ?? ""), extra: String(structured.approvalNotes ?? "") });
  if (section.sectionId === "cost_quantities" && structured.budget && typeof structured.budget === "object") {
    const budget = structured.budget as Record<string, unknown>;
    const metadata = budget.metadata && typeof budget.metadata === "object" ? budget.metadata as Record<string, unknown> : {};
    Object.assign(value, {
      budgetMode: String(budget.mode ?? "unit_rate"),
      amount: String(budget.enteredRate ?? budget.enteredTotalAed ?? budget.originalValue ?? ""),
      rateUnit: String(budget.rateUnit ?? "aed_per_m2"),
      areaBasis: String(budget.areaBasis ?? "fitout"),
      enteredArea: String(budget.enteredArea ?? ""),
      areaUnit: String(budget.areaUnit ?? "m2"),
      areaSource: String(metadata.areaSource ?? ""),
      areaSourceVersion: String(metadata.areaSourceVersion ?? ""),
      costBaseDate: String(metadata.costBaseDate ?? value.costBaseDate),
      inclusions: join(metadata.inclusions),
      exclusions: join(metadata.exclusions),
      feesIncluded: metadata.feesIncluded ? "yes" : "no",
      vatIncluded: metadata.vatIncluded ? "yes" : "no",
      contingencyIncluded: metadata.contingencyIncluded ? "yes" : "no",
      escalationIncluded: metadata.escalationIncluded ? "yes" : "no",
      legacyNote: String(budget.note ?? ""),
    });
  }
  return value;
}

export function BriefSectionEditor({
  section,
  identity,
  evidenceChoices,
  isSaving,
  onSave,
}: {
  section: BriefStudioSection;
  identity: BriefStudioView["identity"];
  evidenceChoices: BriefStudioView["choices"]["evidence"];
  isSaving?: boolean;
  onSave: (content: BriefSectionContentV1Input, evidenceIds: number[]) => void;
}) {
  const [fields, setFields] = useState(() => initialFields(section));
  const [evidenceIds, setEvidenceIds] = useState<number[]>([]);
  const copy = fieldCopy[section.sectionId];
  useEffect(() => {
    setFields(initialFields(section));
    setEvidenceIds([]);
  }, [section.id, section.revisionId]);
  const update = (name: string, value: string) => setFields(current => ({ ...current, [name]: value }));
  const specialistUrl = useMemo(() => {
    const target = section.sectionId === "space_programme" ? "spaceProgram" : section.sectionId === "concept_media" ? "boards" : "evidence";
    const params = new URLSearchParams({
      section: "design",
      view: target,
      briefId: identity.briefId,
      versionId: identity.versionId,
      sectionId: section.sectionId,
      returnTo: window.location.pathname + window.location.search,
    });
    return `${window.location.pathname}?${params}`;
  }, [identity.briefId, identity.versionId, section.sectionId]);
  if (!section.permittedActions.includes("revise")) {
    return <section className="space-y-3" aria-label="Current section content"><p className="whitespace-pre-wrap text-sm">{section.contentState?.kind === "structured" ? section.contentState.content.summary : section.contentState?.kind === "legacy" ? "Legacy content remains available in history and cannot be edited through the structured studio." : "No structured content has been saved."}</p><Button asChild type="button" variant="outline"><a href={specialistUrl}>Open specialist tool</a></Button></section>;
  }
  return <form className="space-y-5" onSubmit={event => {
    event.preventDefault();
    let content = buildBriefSectionContent(section.sectionId, fields) as BriefSectionContentV1Input & Record<string, unknown>;
    const previous = section.contentState?.kind === "structured" ? section.contentState.content as BriefSectionContentV1Input & Record<string, unknown> : undefined;
    if (previous) {
      content = { ...content, requirements: previous.requirements } as typeof content;
      if (section.sectionId === "space_programme" && Array.isArray(content.spaces) && Array.isArray(previous.spaces)) {
        const previousSpaces = previous.spaces as Array<Record<string, unknown>>;
        content.spaces = content.spaces.map((space: Record<string, unknown>) => previousSpaces.find(prior => prior.name === space.name) ?? space);
      }
      if (section.sectionId === "risk_compliance" && Array.isArray(content.risks) && Array.isArray(previous.risks)) {
        const previousRisks = previous.risks as Array<Record<string, unknown>>;
        content.risks = content.risks.map((risk: Record<string, unknown>) => previousRisks.find(prior => prior.title === risk.title) ?? risk);
      }
      if (section.sectionId === "governance" && Array.isArray(content.decisionOwners) && Array.isArray(previous.decisionOwners)) {
        const previousOwners = previous.decisionOwners as Array<Record<string, unknown>>;
        content.decisionOwners = content.decisionOwners.map((owner: Record<string, unknown>) => previousOwners.find(prior => prior.role === owner.role) ?? owner);
      }
      if (section.sectionId === "cost_quantities" && Array.isArray(previous.costCategories)) content.costCategories = previous.costCategories;
    }
    onSave(content, evidenceIds);
  }}>
    {section.contentState?.kind && section.contentState.kind !== "structured" && <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Legacy content is read-only</AlertTitle>
      <AlertDescription>The previous JSON remains available in history. Saving this form creates a new validated revision; it does not silently promote the old value.</AlertDescription>
    </Alert>}
    <div className="space-y-2"><Label htmlFor={`${section.sectionId}-summary`}>Section summary</Label><Textarea id={`${section.sectionId}-summary`} value={fields.summary} onChange={event => update("summary", event.target.value)} required aria-describedby={`${section.sectionId}-summary-help`} /><p id={`${section.sectionId}-summary-help`} className="text-xs text-muted-foreground">State the decision-ready conclusion in plain language.</p></div>
    {section.sectionId === "cost_quantities" ? <CostFields fields={fields} update={update} /> : <>
      <GuidedField id="primary" label={copy.primary} value={fields.primary} update={update} multiline required />
      {copy.secondary && <GuidedField id="secondary" label={copy.secondary} value={fields.secondary} update={update} multiline required={section.sectionId === "asset_context" || section.sectionId === "design_direction"} />}
      {copy.tertiary && <GuidedField id="tertiary" label={copy.tertiary} value={fields.tertiary} update={update} multiline={section.sectionId !== "asset_context" && section.sectionId !== "governance"} required={section.sectionId === "governance"} />}
      {copy.extra && <GuidedField id="extra" label={copy.extra} value={fields.extra} update={update} multiline />}
    </>}
    <GuidedField id="assumptions" label="Declared assumptions (one per line)" value={fields.assumptions} update={update} multiline />
    <div className="space-y-2"><Label htmlFor={`${section.sectionId}-evidence`}>Governed evidence</Label><select id={`${section.sectionId}-evidence`} className="min-h-24 w-full rounded-md border bg-background p-2" multiple value={evidenceIds.map(String)} onChange={event => setEvidenceIds(Array.from(event.currentTarget.selectedOptions).map(option => Number(option.value)))}>{evidenceChoices.map(choice => <option key={choice.id} value={choice.id}>{choice.label} · Grade {choice.reliabilityGrade} · {choice.scope}</option>)}</select><p className="text-xs text-muted-foreground">Only evidence authorized for this project and organization is available.</p></div>
    <div className="flex flex-wrap items-center gap-2">{section.permittedActions.includes("revise") && <Button type="submit" disabled={isSaving}><Save className="me-2 h-4 w-4" />Save new revision</Button>}<Button asChild type="button" variant="outline"><a href={specialistUrl}>Open specialist tool</a></Button></div>
  </form>;
}

function GuidedField({ id, label, value, update, multiline, required }: { id: string; label: string; value: string; update: (name: string, value: string) => void; multiline?: boolean; required?: boolean }) {
  if (!label) return null;
  return <div className="space-y-2"><Label htmlFor={`brief-${id}`}>{label}</Label>{multiline ? <Textarea id={`brief-${id}`} value={value} onChange={event => update(id, event.target.value)} required={required} /> : <Input id={`brief-${id}`} value={value} onChange={event => update(id, event.target.value)} required={required} />}</div>;
}

function CostFields({ fields, update }: { fields: Record<string, string>; update: (name: string, value: string) => void }) {
  const unitRate = fields.budgetMode === "unit_rate";
  const legacy = fields.budgetMode === "legacy_basis_unspecified";
  return <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-2 font-medium">Budget and area basis</legend>
    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="budget-mode">Budget entry</Label><select id="budget-mode" className="h-10 w-full rounded-md border bg-background px-3" value={fields.budgetMode} onChange={event => update("budgetMode", event.target.value)}><option value="unit_rate">Unit rate</option><option value="total_aed">Total AED</option><option value="legacy_basis_unspecified">Legacy basis unspecified</option></select></div><GuidedField id="amount" label={unitRate ? "Entered rate" : legacy ? "Original legacy value" : "Total AED"} value={fields.amount} update={update} required /></div>
    {unitRate && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField id="rateUnit" label="Rate unit" value={fields.rateUnit} update={update} options={[['aed_per_m2','AED/m²'],['aed_per_ft2','AED/ft²']]} /><SelectField id="areaBasis" label="Named area basis" value={fields.areaBasis} update={update} options={[["gifa","GIFA"],["nia","NIA"],["saleable","Saleable"],["fitout","Fit-out"]]} /><GuidedField id="enteredArea" label="Area quantity" value={fields.enteredArea} update={update} required /><SelectField id="areaUnit" label="Area unit" value={fields.areaUnit} update={update} options={[["m2","m²"],["ft2","ft²"]]} /></div>}
    {legacy ? <GuidedField id="legacyNote" label="Why the basis is unknown" value={fields.legacyNote} update={update} multiline required /> : <><div className="grid gap-4 sm:grid-cols-3"><GuidedField id="areaSource" label="Area source" value={fields.areaSource} update={update} required /><GuidedField id="areaSourceVersion" label="Area source version" value={fields.areaSourceVersion} update={update} required /><GuidedField id="costBaseDate" label="Cost base date" value={fields.costBaseDate} update={update} required /></div><div className="grid gap-4 sm:grid-cols-2"><GuidedField id="inclusions" label="Scope inclusions" value={fields.inclusions} update={update} multiline /><GuidedField id="exclusions" label="Scope exclusions" value={fields.exclusions} update={update} multiline /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["feesIncluded","Fees"],["vatIncluded","VAT"],["contingencyIncluded","Contingency"],["escalationIncluded","Escalation"]].map(([id,label]) => <SelectField key={id} id={id} label={`${label} included?`} value={fields[id]} update={update} options={[["no","No"],["yes","Yes"]]} />)}</div></>}
  </fieldset>;
}

function SelectField({ id, label, value, update, options }: { id: string; label: string; value: string; update: (name: string, value: string) => void; options: string[][] }) {
  return <div className="space-y-2"><Label htmlFor={`brief-${id}`}>{label}</Label><select id={`brief-${id}`} className="h-10 w-full rounded-md border bg-background px-3" value={value} onChange={event => update(id, event.target.value)}>{options.map(([option,label]) => <option key={option} value={option}>{label}</option>)}</select></div>;
}
