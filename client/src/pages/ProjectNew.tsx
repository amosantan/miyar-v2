import DldAreaSelect from "@/components/DldAreaSelect";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Building2,
  Target,
  TrendingUp,
  DollarSign,
  Palette,
  Wrench,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CITY_TIERS, DEFAULT_TIER, CERT_MULTIPLIERS, CERT_TO_DES05 } from "../../../server/engines/sustainability/sustainability-multipliers";

const STEPS = [
  { icon: Building2, label: "Context", desc: "Project fundamentals" },
  { icon: Target, label: "Strategy", desc: "Brand & positioning" },
  { icon: TrendingUp, label: "Market", desc: "Competitive landscape" },
  { icon: DollarSign, label: "Financial", desc: "Budget & flexibility" },
  { icon: Palette, label: "Design", desc: "Style & complexity" },
  { icon: Wrench, label: "Execution", desc: "Delivery capability" },
  { icon: Settings, label: "Review", desc: "Confirm & create" },
];

const ordinalLabels: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Very High",
};

function OrdinalSlider({
  label,
  tooltip,
  value,
  onChange,
}: {
  label: string;
  tooltip: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <span className="text-xs text-primary font-medium px-2 py-0.5 rounded bg-primary/10">
          {value} — {ordinalLabels[value]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{tooltip}</p>
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="mt-2"
      />
    </div>
  );
}

type FormData = {
  name: string;
  description: string;
  ctx01Typology: string;
  ctx02Scale: string;
  ctx03Gfa: number | null;
  ctx04Location: string;
  dldAreaId: number | null;
  dldAreaName: string;
  projectPurpose: string;
  ctx05Horizon: string;
  str01BrandClarity: number;
  str02Differentiation: number;
  str03BuyerMaturity: number;
  mkt01Tier: string;
  mkt02Competitor: number;
  mkt03Trend: number;
  fin01BudgetCap: number | null;
  fin02Flexibility: number;
  fin03ShockTolerance: number;
  fin04SalesPremium: number;
  des01Style: string;
  des02MaterialLevel: number;
  des03Complexity: number;
  des04Experience: number;
  des05Sustainability: number;
  exe01SupplyChain: number;
  exe02Contractor: number;
  exe03Approvals: number;
  exe04QaMaturity: number;
  add01SampleKit: boolean;
  add02PortfolioMode: boolean;
  add03DashboardExport: boolean;
  unitMix?: string;
  villaSpaces?: string;
  developerGuidelines?: string;
  city: string;
  sustainCertTarget: string;
};

function ProjectNewContent() {
  const [step, setStep] = useState(0);
  const [, setLocation] = useLocation();
  const createProject = trpc.project.create.useMutation();

  const [form, setForm] = useState<FormData>({
    name: "",
    description: "",
    ctx01Typology: "Residential",
    ctx02Scale: "Medium",
    ctx03Gfa: null,
    ctx04Location: "Secondary",
    dldAreaId: null,
    dldAreaName: "",
    projectPurpose: "sell_ready",
    ctx05Horizon: "12-24m",
    str01BrandClarity: 3,
    str02Differentiation: 3,
    str03BuyerMaturity: 3,
    mkt01Tier: "Upper-mid",
    mkt02Competitor: 3,
    mkt03Trend: 3,
    fin01BudgetCap: null,
    fin02Flexibility: 3,
    fin03ShockTolerance: 3,
    fin04SalesPremium: 3,
    des01Style: "Modern",
    des02MaterialLevel: 3,
    des03Complexity: 3,
    des04Experience: 3,
    des05Sustainability: 2,
    exe01SupplyChain: 3,
    exe02Contractor: 3,
    exe03Approvals: 2,
    exe04QaMaturity: 3,
    add01SampleKit: false,
    add02PortfolioMode: false,
    add03DashboardExport: true,
    unitMix: "",
    villaSpaces: "",
    developerGuidelines: "",
    city: "Dubai",
    sustainCertTarget: "silver",
  });

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canProceed = step === 0 ? form.name.trim().length > 0 : true;

  async function handleCreate() {
    try {
      const result = await createProject.mutateAsync(form as any);
      toast.success("Project created successfully");
      setLocation(`/projects/${result.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create project");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/projects")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            New Project
          </h1>
          <p className="text-sm text-muted-foreground">
            Guided intake — Step {step + 1} of {STEPS.length}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && setStep(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${i === step
              ? "bg-primary/15 text-primary"
              : i < step
                ? "text-miyar-teal cursor-pointer hover:bg-secondary"
                : "text-muted-foreground"
              }`}
          >
            {i < step ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <s.icon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {(() => {
              const Icon = STEPS[step].icon;
              return <Icon className="h-5 w-5 text-primary" />;
            })()}
            {STEPS[step].label}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{STEPS[step].desc}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Context */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input
                  placeholder="e.g., Marina Tower Phase 2"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief project description..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Typology</Label>
                  <Select
                    value={form.ctx01Typology}
                    onValueChange={(v) => set("ctx01Typology", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Residential">Residential</SelectItem>
                      <SelectItem value="Mixed-use">Mixed-use</SelectItem>
                      <SelectItem value="Hospitality">Hospitality</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="Villa">Villa</SelectItem>
                      <SelectItem value="Gated Community">Gated Community</SelectItem>
                      <SelectItem value="Villa Development">Villa Development</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scale</Label>
                  <Select
                    value={form.ctx02Scale}
                    onValueChange={(v) => set("ctx02Scale", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Small">Small (&lt;50 units)</SelectItem>
                      <SelectItem value="Medium">Medium (50-200)</SelectItem>
                      <SelectItem value="Large">Large (200+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GFA (sqm)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 500000"
                    value={form.ctx03Gfa ?? ""}
                    onChange={(e) =>
                      set(
                        "ctx03Gfa",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Tier</Label>
                  <Select
                    value={form.ctx04Location}
                    onValueChange={(v) => set("ctx04Location", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prime">Prime</SelectItem>
                      <SelectItem value="Secondary">Secondary</SelectItem>
                      <SelectItem value="Emerging">Emerging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Dubai Area (DLD)</Label>
                  <DldAreaSelect
                    value={form.dldAreaId}
                    onChange={(areaId, areaName) => {
                      set("dldAreaId", areaId);
                      set("dldAreaName", areaName);
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Select the DLD-registered area for competitor intelligence and market comparison
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select
                    value={form.city}
                    onValueChange={(v) => {
                      set("city", v);
                      // Auto-set default certification tier for city
                      const defaultTier = DEFAULT_TIER[v] || "silver";
                      set("sustainCertTarget", defaultTier);
                      set("des05Sustainability", CERT_TO_DES05[defaultTier] || 2);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Dubai">Dubai</SelectItem>
                      <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Determines certification system: Dubai → Al Sa'fat, Abu Dhabi → Estidama
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Project Purpose</Label>
                  <Select
                    value={form.projectPurpose}
                    onValueChange={(v) => set("projectPurpose", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sell_offplan">Sell Off-Plan — Showroom-quality finishes</SelectItem>
                      <SelectItem value="sell_ready">Sell Ready — Durable premium finishes</SelectItem>
                      <SelectItem value="rent">Rent — Durability-focused, cost-efficient</SelectItem>
                      <SelectItem value="mixed">Mixed — Balanced for sale + rental</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Affects material recommendations, fitout budget calibration, and ROI projections
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Project Horizon</Label>
                <Select
                  value={form.ctx05Horizon}
                  onValueChange={(v) => set("ctx05Horizon", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-12m">0–12 months</SelectItem>
                    <SelectItem value="12-24m">12–24 months</SelectItem>
                    <SelectItem value="24-36m">24–36 months</SelectItem>
                    <SelectItem value="36m+">36+ months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {["Villa", "Gated Community", "Villa Development"].includes(form.ctx01Typology) && (
                <div className="space-y-2">
                  <Label>Villa Spaces (e.g. Majlis, Show Kitchen)</Label>
                  <Textarea
                    placeholder="List expected spaces in the villas..."
                    value={form.villaSpaces || ""}
                    onChange={(e) => set("villaSpaces", e.target.value)}
                    rows={2}
                  />
                </div>
              )}

              {["Residential", "Gated Community", "Mixed-use", "Villa Development"].includes(form.ctx01Typology) && (
                <div className="space-y-2">
                  <Label>Unit Mix</Label>
                  <Textarea
                    placeholder="e.g. 20% 1BR, 50% 2BR, 30% 3BR..."
                    value={form.unitMix || ""}
                    onChange={(e) => set("unitMix", e.target.value)}
                    rows={2}
                  />
                </div>
              )}
            </>
          )}

          {/* Step 1: Strategy */}
          {step === 1 && (
            <>
              <div className="space-y-2 mb-6">
                <Label>Developer Guidelines & Target Audience</Label>
                <Textarea
                  placeholder="Describe developer brand guidelines, design briefs, or specific target demographic..."
                  value={form.developerGuidelines || ""}
                  onChange={(e) => set("developerGuidelines", e.target.value)}
                  rows={3}
                />
              </div>
              <OrdinalSlider
                label="Brand Clarity (STR-01)"
                tooltip="How clearly defined is the project's brand identity and narrative?"
                value={form.str01BrandClarity}
                onChange={(v) => set("str01BrandClarity", v)}
              />
              <OrdinalSlider
                label="Differentiation Strategy (STR-02)"
                tooltip="How distinct is the design direction from competing projects?"
                value={form.str02Differentiation}
                onChange={(v) => set("str02Differentiation", v)}
              />
              <OrdinalSlider
                label="Buyer Maturity (STR-03)"
                tooltip="How sophisticated is the target buyer in evaluating design quality?"
                value={form.str03BuyerMaturity}
                onChange={(v) => set("str03BuyerMaturity", v)}
              />
            </>
          )}

          {/* Step 2: Market */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Market Tier (MKT-01)</Label>
                <Select
                  value={form.mkt01Tier}
                  onValueChange={(v) => set("mkt01Tier", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mid">Mid-market</SelectItem>
                    <SelectItem value="Upper-mid">Upper-mid</SelectItem>
                    <SelectItem value="Luxury">Luxury</SelectItem>
                    <SelectItem value="Ultra-luxury">Ultra-luxury</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <OrdinalSlider
                label="Competitor Intensity (MKT-02)"
                tooltip="How many similar projects compete in the same segment and location?"
                value={form.mkt02Competitor}
                onChange={(v) => set("mkt02Competitor", v)}
              />
              <OrdinalSlider
                label="Trend Sensitivity (MKT-03)"
                tooltip="How aligned is the direction with current market and design trends?"
                value={form.mkt03Trend}
                onChange={(v) => set("mkt03Trend", v)}
              />
            </>
          )}

          {/* Step 3: Financial */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Budget Cap (AED per sqm)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 400"
                  value={form.fin01BudgetCap ?? ""}
                  onChange={(e) =>
                    set(
                      "fin01BudgetCap",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum interior fit-out cost per square meter
                </p>
              </div>
              <OrdinalSlider
                label="Budget Flexibility (FIN-02)"
                tooltip="How much room exists to adjust the budget if needed?"
                value={form.fin02Flexibility}
                onChange={(v) => set("fin02Flexibility", v)}
              />
              <OrdinalSlider
                label="Shock Tolerance (FIN-03)"
                tooltip="How well can the project absorb unexpected cost increases?"
                value={form.fin03ShockTolerance}
                onChange={(v) => set("fin03ShockTolerance", v)}
              />
              <OrdinalSlider
                label="Sales Premium Potential (FIN-04)"
                tooltip="Can the design direction command a price premium in the market?"
                value={form.fin04SalesPremium}
                onChange={(v) => set("fin04SalesPremium", v)}
              />
            </>
          )}

          {/* Step 4: Design */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Design Style (DES-01)</Label>
                <Select
                  value={form.des01Style}
                  onValueChange={(v) => set("des01Style", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Modern">Modern</SelectItem>
                    <SelectItem value="Contemporary">Contemporary</SelectItem>
                    <SelectItem value="Minimal">Minimal</SelectItem>
                    <SelectItem value="Classic">Classic</SelectItem>
                    <SelectItem value="Fusion">Fusion</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <OrdinalSlider
                label="Material Level (DES-02)"
                tooltip="Quality tier of specified materials (1=basic, 5=ultra-premium)"
                value={form.des02MaterialLevel}
                onChange={(v) => set("des02MaterialLevel", v)}
              />
              <OrdinalSlider
                label="Design Complexity (DES-03)"
                tooltip="Level of custom detailing, bespoke elements, and technical difficulty"
                value={form.des03Complexity}
                onChange={(v) => set("des03Complexity", v)}
              />
              <OrdinalSlider
                label="Experience Intensity (DES-04)"
                tooltip="How immersive and sensory-rich is the intended user experience?"
                value={form.des04Experience}
                onChange={(v) => set("des04Experience", v)}
              />
              <div className="space-y-3">
                <Label>Sustainability Certification Target</Label>
                <p className="text-xs text-muted-foreground">
                  {form.city === "Abu Dhabi" ? "Estidama Pearl Rating" : "Al Sa'fat Green Building"} — affects material costs and scoring
                </p>
                <Select
                  value={form.sustainCertTarget}
                  onValueChange={(v) => {
                    set("sustainCertTarget", v);
                    set("des05Sustainability", CERT_TO_DES05[v] || 2);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(CITY_TIERS[form.city] || CITY_TIERS["Dubai"]).map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>
                        {tier.label}
                        {tier.mandatory ? " ✱ (mandatory)" : ""}
                        {" — "}{tier.premium} material premium
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {CERT_MULTIPLIERS[form.sustainCertTarget] && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                    <span className="text-xs font-medium text-amber-600">
                      +{Math.round((CERT_MULTIPLIERS[form.sustainCertTarget] - 1) * 100)}% estimated material cost premium
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 5: Execution */}
          {step === 5 && (
            <>
              <OrdinalSlider
                label="Supply Chain Reliability (EXE-01)"
                tooltip="How reliable and diversified is the material supply chain?"
                value={form.exe01SupplyChain}
                onChange={(v) => set("exe01SupplyChain", v)}
              />
              <OrdinalSlider
                label="Contractor Capability (EXE-02)"
                tooltip="Can the contractor execute the specified design complexity?"
                value={form.exe02Contractor}
                onChange={(v) => set("exe02Contractor", v)}
              />
              <OrdinalSlider
                label="Approvals Risk (EXE-03)"
                tooltip="Likelihood of regulatory delays or compliance issues"
                value={form.exe03Approvals}
                onChange={(v) => set("exe03Approvals", v)}
              />
              <OrdinalSlider
                label="QA Maturity (EXE-04)"
                tooltip="Quality assurance processes and inspection readiness"
                value={form.exe04QaMaturity}
                onChange={(v) => set("exe04QaMaturity", v)}
              />
            </>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <>
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h3 className="font-semibold text-foreground">
                    {form.name || "Untitled Project"}
                  </h3>
                  {form.description && (
                    <p className="text-sm text-muted-foreground">
                      {form.description}
                    </p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Typology:</span>{" "}
                      <span className="text-foreground">
                        {form.ctx01Typology}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scale:</span>{" "}
                      <span className="text-foreground">{form.ctx02Scale}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span>{" "}
                      <span className="text-foreground">
                        {form.ctx04Location}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Market:</span>{" "}
                      <span className="text-foreground">{form.mkt01Tier}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Style:</span>{" "}
                      <span className="text-foreground">{form.des01Style}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horizon:</span>{" "}
                      <span className="text-foreground">
                        {form.ctx05Horizon}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">City:</span>{" "}
                      <span className="text-foreground">{form.city}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cert Target:</span>{" "}
                      <span className="text-foreground">
                        {(CITY_TIERS[form.city] || []).find(t => t.value === form.sustainCertTarget)?.label || form.sustainCertTarget}
                        <span className="text-xs text-amber-600 ml-1">
                          (+{Math.round(((CERT_MULTIPLIERS[form.sustainCertTarget] || 1) - 1) * 100)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Add-ons */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">
                    Add-ons
                  </h4>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Sample Kit Request</Label>
                    <Switch
                      checked={form.add01SampleKit}
                      onCheckedChange={(v) => set("add01SampleKit", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Portfolio Mode</Label>
                    <Switch
                      checked={form.add02PortfolioMode}
                      onCheckedChange={(v) => set("add02PortfolioMode", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Dashboard Export</Label>
                    <Switch
                      checked={form.add03DashboardExport}
                      onCheckedChange={(v) => set("add03DashboardExport", v)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed}
            className="gap-2"
          >
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={createProject.isPending}
            className="gap-2"
          >
            {createProject.isPending ? (
              "Creating..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Create Project
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProjectNew() {
  return (
    <DashboardLayout>
      <ProjectNewContent />
    </DashboardLayout>
  );
}
