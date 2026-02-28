import DldAreaSelect from "@/components/DldAreaSelect";

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
  Plus,
  Trash2,
  AlertTriangle,
  Layers,
  Home,
} from "lucide-react";
import { useState, useMemo } from "react";
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

// ─── V4: Archetype Mapping ─────────────────────────────────────────────────

type ProjectArchetype = "residential_multi" | "office" | "single_villa" | "hospitality" | "community";

function getArchetype(typology: string): ProjectArchetype {
  switch (typology) {
    case "Residential":
    case "Mixed-use":
      return "residential_multi";
    case "Villa":
    case "Villa Development":
      return "single_villa";
    case "Office":
      return "office";
    case "Hospitality":
      return "hospitality";
    case "Gated Community":
      return "community";
    default:
      return "residential_multi";
  }
}

/** Benchmark fitout efficiency ratios by archetype */
const ARCHETYPE_EFFICIENCY: Record<string, { low: number; mid: number; high: number }> = {
  residential_multi: { low: 0.70, mid: 0.75, high: 0.80 },
  office: { low: 0.65, mid: 0.70, high: 0.75 },
  single_villa: { low: 0.85, mid: 0.90, high: 0.95 },
  hospitality: { low: 0.55, mid: 0.62, high: 0.70 },
  community: { low: 0.72, mid: 0.78, high: 0.85 },
};

// ─── V4: Unit Mix Types ────────────────────────────────────────────────────

type UnitMixRow = {
  unitType: string;
  areaSqm: number;
  count: number;
  includeInFitout: boolean;
};

const DEFAULT_UNIT_TYPES = ["Studio", "1 BR", "2 BR", "3 BR", "Penthouse", "Duplex"];

function UnitMixBuilder({
  units,
  onChange,
}: {
  units: UnitMixRow[];
  onChange: (units: UnitMixRow[]) => void;
}) {
  const addRow = () => {
    const nextType = DEFAULT_UNIT_TYPES.find(
      (t) => !units.some((u) => u.unitType === t)
    ) || `Unit ${units.length + 1}`;
    onChange([...units, { unitType: nextType, areaSqm: 80, count: 1, includeInFitout: true }]);
  };

  const removeRow = (idx: number) => {
    onChange(units.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof UnitMixRow, value: any) => {
    const next = [...units];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const totalFitout = units
    .filter((u) => u.includeInFitout)
    .reduce((sum, u) => sum + u.areaSqm * u.count, 0);
  const totalUnits = units.reduce((sum, u) => sum + u.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Unit Mix Builder</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1 h-7 text-xs">
          <Plus className="h-3 w-3" /> Add Unit
        </Button>
      </div>

      {units.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_90px_70px_70px_32px] gap-1 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
            <span>Type</span>
            <span>Area (sqm)</span>
            <span>Count</span>
            <span>Fitout</span>
            <span></span>
          </div>
          {/* Rows */}
          {units.map((u, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_70px_70px_32px] gap-1 px-3 py-1.5 border-t border-border items-center">
              <Select value={u.unitType} onValueChange={(v) => updateRow(i, "unitType", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_UNIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  <SelectItem value={`Custom ${i + 1}`}>Custom</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                className="h-8 text-xs"
                value={u.areaSqm || ""}
                onChange={(e) => updateRow(i, "areaSqm", Number(e.target.value) || 0)}
              />
              <Input
                type="number"
                className="h-8 text-xs"
                value={u.count || ""}
                onChange={(e) => updateRow(i, "count", Math.max(1, parseInt(e.target.value) || 1))}
              />
              <div className="flex justify-center">
                <Switch
                  checked={u.includeInFitout}
                  onCheckedChange={(v) => updateRow(i, "includeInFitout", v)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {/* Summary */}
          <div className="grid grid-cols-[1fr_90px_70px_70px_32px] gap-1 px-3 py-2 bg-primary/5 border-t border-border text-xs font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">{totalFitout.toLocaleString()} sqm</span>
            <span className="text-muted-foreground">{totalUnits} units</span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      {units.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">Add unit types to build the project mix</p>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="mt-2 gap-1">
            <Plus className="h-3 w-3" /> Add First Unit
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── V4: Room List Builder ─────────────────────────────────────────────────

type VillaRoom = { name: string; areaSqm: number };
type VillaFloor = { floor: string; rooms: VillaRoom[] };

const VILLA_PRESETS: Record<string, VillaRoom[]> = {
  Ground: [
    { name: "Majlis", areaSqm: 45 },
    { name: "Show Kitchen", areaSqm: 25 },
    { name: "Living Room", areaSqm: 40 },
    { name: "Guest Suite", areaSqm: 30 },
    { name: "Powder Room", areaSqm: 5 },
  ],
  First: [
    { name: "Master Suite", areaSqm: 55 },
    { name: "Bedroom 2", areaSqm: 25 },
    { name: "Bedroom 3", areaSqm: 22 },
    { name: "Family Lounge", areaSqm: 30 },
  ],
  Basement: [
    { name: "Cinema Room", areaSqm: 35 },
    { name: "Gym", areaSqm: 30 },
    { name: "Maid's Room", areaSqm: 12 },
    { name: "Storage", areaSqm: 15 },
  ],
};

function RoomListBuilder({
  floors,
  onChange,
}: {
  floors: VillaFloor[];
  onChange: (floors: VillaFloor[]) => void;
}) {
  const addFloor = () => {
    const floorNames = ["Ground", "First", "Second", "Basement", "Roof", "Mezzanine"];
    const next = floorNames.find((f) => !floors.some((fl) => fl.floor === f)) || `Floor ${floors.length + 1}`;
    const presetRooms = VILLA_PRESETS[next] || [{ name: "Room 1", areaSqm: 20 }];
    onChange([...floors, { floor: next, rooms: presetRooms }]);
  };

  const removeFloor = (idx: number) => {
    onChange(floors.filter((_, i) => i !== idx));
  };

  const addRoom = (floorIdx: number) => {
    const next = [...floors];
    next[floorIdx] = {
      ...next[floorIdx],
      rooms: [...next[floorIdx].rooms, { name: `Room ${next[floorIdx].rooms.length + 1}`, areaSqm: 20 }],
    };
    onChange(next);
  };

  const removeRoom = (floorIdx: number, roomIdx: number) => {
    const next = [...floors];
    next[floorIdx] = {
      ...next[floorIdx],
      rooms: next[floorIdx].rooms.filter((_, i) => i !== roomIdx),
    };
    onChange(next);
  };

  const updateRoom = (floorIdx: number, roomIdx: number, field: keyof VillaRoom, value: any) => {
    const next = [...floors];
    const rooms = [...next[floorIdx].rooms];
    rooms[roomIdx] = { ...rooms[roomIdx], [field]: value };
    next[floorIdx] = { ...next[floorIdx], rooms };
    onChange(next);
  };

  const totalArea = floors.reduce(
    (sum, fl) => sum + fl.rooms.reduce((s, r) => s + r.areaSqm, 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Villa Room List</Label>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addFloor} className="gap-1 h-7 text-xs">
          <Plus className="h-3 w-3" /> Add Floor
        </Button>
      </div>

      {floors.map((fl, fi) => (
        <div key={fi} className="border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
            <span className="text-xs font-semibold text-foreground">{fl.floor} Floor</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {fl.rooms.reduce((s, r) => s + r.areaSqm, 0).toLocaleString()} sqm
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFloor(fi)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          {fl.rooms.map((r, ri) => (
            <div key={ri} className="grid grid-cols-[1fr_90px_32px] gap-2 px-3 py-1.5 border-t border-border items-center">
              <Input
                className="h-8 text-xs"
                value={r.name}
                onChange={(e) => updateRoom(fi, ri, "name", e.target.value)}
              />
              <Input
                type="number"
                className="h-8 text-xs"
                value={r.areaSqm || ""}
                onChange={(e) => updateRoom(fi, ri, "areaSqm", Number(e.target.value) || 0)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => removeRoom(fi, ri)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <div className="px-3 py-1.5 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={() => addRoom(fi)} className="gap-1 h-7 text-xs text-muted-foreground hover:text-primary">
              <Plus className="h-3 w-3" /> Add Room
            </Button>
          </div>
        </div>
      ))}

      {floors.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">Add floors and rooms to define the villa layout</p>
          <Button type="button" variant="outline" size="sm" onClick={addFloor} className="mt-2 gap-1">
            <Plus className="h-3 w-3" /> Add Ground Floor
          </Button>
        </div>
      )}

      {floors.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 rounded-lg text-xs font-semibold">
          <span>Total Interior Area</span>
          <span className="text-primary">{totalArea.toLocaleString()} sqm</span>
        </div>
      )}
    </div>
  );
}

// ─── V4: Shell & Core Toggle (Office) ──────────────────────────────────────

function ShellCoreToggle({
  fitoutCategory,
  customRatio,
  gfa,
  onCategoryChange,
  onRatioChange,
}: {
  fitoutCategory: "cat_a" | "cat_b";
  customRatio: number;
  gfa: number;
  onCategoryChange: (cat: "cat_a" | "cat_b") => void;
  onRatioChange: (ratio: number) => void;
}) {
  const defaultRatios = { cat_a: 0.35, cat_b: 0.70 };
  const activeRatio = customRatio || defaultRatios[fitoutCategory];
  const fitoutArea = Math.round(gfa * activeRatio);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">Fitout Category</Label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onCategoryChange("cat_a");
            onRatioChange(defaultRatios.cat_a);
          }}
          className={`rounded-lg border-2 p-3 text-left transition-all ${fitoutCategory === "cat_a"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
            }`}
        >
          <span className="text-sm font-semibold text-foreground">Cat A — Shell & Core</span>
          <p className="text-xs text-muted-foreground mt-1">
            Lobbies, washrooms, lift lobbies only (~35% of GFA)
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            onCategoryChange("cat_b");
            onRatioChange(defaultRatios.cat_b);
          }}
          className={`rounded-lg border-2 p-3 text-left transition-all ${fitoutCategory === "cat_b"
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
            }`}
        >
          <span className="text-sm font-semibold text-foreground">Cat B — Full Fitout</span>
          <p className="text-xs text-muted-foreground mt-1">
            Complete tenant fitout including floor, ceiling, partitions (~70% of GFA)
          </p>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Custom Ratio Override</Label>
          <span className="text-xs font-medium text-primary">{Math.round(activeRatio * 100)}%</span>
        </div>
        <Slider
          min={20}
          max={95}
          step={5}
          value={[Math.round(activeRatio * 100)]}
          onValueChange={([v]) => onRatioChange(v / 100)}
        />
        <p className="text-xs text-muted-foreground">
          Estimated fitout area: <span className="font-medium text-foreground">{fitoutArea.toLocaleString()} sqm</span> of {gfa.toLocaleString()} sqm GFA
        </p>
      </div>
    </div>
  );
}

// ─── V4: Fitout Area Summary Badge ─────────────────────────────────────────

function FitoutAreaSummary({
  gfa,
  fitoutArea,
  archetype,
}: {
  gfa: number;
  fitoutArea: number;
  archetype: ProjectArchetype;
}) {
  if (!fitoutArea || !gfa) return null;

  const ratio = fitoutArea / gfa;
  const benchmark = ARCHETYPE_EFFICIENCY[archetype];
  const isLow = benchmark && ratio < benchmark.low;
  const isHigh = benchmark && ratio > benchmark.high;
  const isOk = !isLow && !isHigh;

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isOk ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"
      }`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Area Breakdown</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOk ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
          }`}>
          {Math.round(ratio * 100)}% efficiency
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">GFA</span>
          <p className="font-semibold text-foreground">{gfa.toLocaleString()} sqm</p>
        </div>
        <div>
          <span className="text-muted-foreground">Fitout Area</span>
          <p className="font-semibold text-primary">{fitoutArea.toLocaleString()} sqm</p>
        </div>
        <div>
          <span className="text-muted-foreground">Non-Finish</span>
          <p className="font-semibold text-foreground">{(gfa - fitoutArea).toLocaleString()} sqm</p>
        </div>
      </div>
      {(isLow || isHigh) && benchmark && (
        <div className="flex items-start gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {isLow
              ? `Fitout ratio is below expected range (${(benchmark.low * 100).toFixed(0)}-${(benchmark.high * 100).toFixed(0)}%). Verify GFA includes all structural areas.`
              : `Fitout ratio exceeds expected range (${(benchmark.low * 100).toFixed(0)}-${(benchmark.high * 100).toFixed(0)}%). Verify fit-out scope.`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Form Types ────────────────────────────────────────────────────────────

export type FormData = {
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
  // V4 — structured area inputs
  unitMixRows: UnitMixRow[];
  villaFloors: VillaFloor[];
  officeFitoutCategory: "cat_a" | "cat_b";
  officeCustomRatio: number;
  developerGuidelines?: string;
  city: string;
  sustainCertTarget: string;

  // V5 — Concrete Analytics Inputs
  developerType?: string;
  targetDemographic?: string;
  salesStrategy?: string;
  competitiveDensity?: string;
  projectUsp?: string;
  targetYield?: string;
  procurementStrategy?: string;
  amenityFocus?: string;
  techIntegration?: string;
  materialSourcing?: string;
};

export type ProjectFormProps = {
  initialData?: Partial<FormData>;
  onSubmit: (data: any) => Promise<void>;
  isPending?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
};

export function ProjectForm({ initialData, onSubmit, isPending = false, submitLabel = "Create Project", onCancel }: ProjectFormProps) {
  const [step, setStep] = useState(0);

  const [form, setForm] = useState<FormData>(() => ({
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
    // V4 defaults
    unitMixRows: [],
    villaFloors: [],
    officeFitoutCategory: "cat_b",
    officeCustomRatio: 0.70,
    developerGuidelines: "",
    city: "Dubai",
    sustainCertTarget: "silver",
    ...initialData
  }));

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // V4: Derive archetype from typology
  const archetype = useMemo(() => getArchetype(form.ctx01Typology), [form.ctx01Typology]);

  // V4: Auto-calculate totalFitoutArea based on archetype
  const computedFitoutArea = useMemo<number>(() => {
    switch (archetype) {
      case "residential_multi":
      case "community": {
        // Sum of included units
        const unitTotal = form.unitMixRows
          .filter((u) => u.includeInFitout)
          .reduce((sum, u) => sum + u.areaSqm * u.count, 0);
        return unitTotal > 0 ? unitTotal : 0;
      }
      case "single_villa": {
        // Sum of all rooms across floors
        return form.villaFloors.reduce(
          (sum, fl) => sum + fl.rooms.reduce((s, r) => s + r.areaSqm, 0),
          0
        );
      }
      case "office": {
        // GFA × fitout ratio
        return Math.round((form.ctx03Gfa || 0) * form.officeCustomRatio);
      }
      case "hospitality": {
        // Same as residential (unit-based) or fallback to GFA × mid ratio
        const unitTotal = form.unitMixRows
          .filter((u) => u.includeInFitout)
          .reduce((sum, u) => sum + u.areaSqm * u.count, 0);
        if (unitTotal > 0) return unitTotal;
        const eff = ARCHETYPE_EFFICIENCY.hospitality;
        return Math.round((form.ctx03Gfa || 0) * eff.mid);
      }
      default:
        return 0;
    }
  }, [archetype, form.unitMixRows, form.villaFloors, form.ctx03Gfa, form.officeCustomRatio]);

  const canProceed = step === 0 ? form.name.trim().length > 0 : true;

  async function handleCreate() {
    try {
      // Build submission payload
      const payload: any = { ...form };

      // V4: Add computed area fields
      payload.totalFitoutArea = computedFitoutArea > 0 ? computedFitoutArea : null;
      payload.totalNonFinishArea = (form.ctx03Gfa && computedFitoutArea > 0)
        ? form.ctx03Gfa - computedFitoutArea
        : null;
      payload.projectArchetype = archetype;

      // Serialize structured data to JSON arrays for the router
      payload.unitMix = form.unitMixRows.length > 0 ? form.unitMixRows : undefined;
      payload.villaSpaces = form.villaFloors.length > 0 ? form.villaFloors : undefined;

      // Remove internal-only fields
      delete payload.unitMixRows;
      delete payload.villaFloors;
      delete payload.officeFitoutCategory;
      delete payload.officeCustomRatio;

      await onSubmit(payload);
    } catch (e: any) {
      toast.error(e.message || "Failed to submit project data");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
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

              {/* ─── V4: Archetype-specific sub-forms ─── */}

              {/* Residential / Mixed-use / Gated Community / Hospitality → Unit Mix */}
              {["residential_multi", "community", "hospitality"].includes(archetype) && (
                <UnitMixBuilder
                  units={form.unitMixRows}
                  onChange={(rows) => set("unitMixRows", rows)}
                />
              )}

              {/* Villa / Villa Development → Room List */}
              {archetype === "single_villa" && (
                <RoomListBuilder
                  floors={form.villaFloors}
                  onChange={(floors) => set("villaFloors", floors)}
                />
              )}

              {/* Office → Shell & Core Toggle */}
              {archetype === "office" && (
                <ShellCoreToggle
                  fitoutCategory={form.officeFitoutCategory}
                  customRatio={form.officeCustomRatio}
                  gfa={form.ctx03Gfa || 0}
                  onCategoryChange={(cat) => set("officeFitoutCategory", cat)}
                  onRatioChange={(ratio) => set("officeCustomRatio", ratio)}
                />
              )}

              {/* V4: Fitout Area Summary (shows whenever we have GFA + computed area) */}
              {form.ctx03Gfa && computedFitoutArea > 0 && (
                <FitoutAreaSummary
                  gfa={form.ctx03Gfa}
                  fitoutArea={computedFitoutArea}
                  archetype={archetype}
                />
              )}
            </>
          )}

          {/* Step 1: Strategy */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Target Demographic</Label>
                  <Select value={form.targetDemographic} onValueChange={(v) => set("targetDemographic", v)}>
                    <SelectTrigger><SelectValue placeholder="Select demographic..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HNWI">HNWI (High Net Worth)</SelectItem>
                      <SelectItem value="Families">Families</SelectItem>
                      <SelectItem value="Young Professionals">Young Professionals</SelectItem>
                      <SelectItem value="Investors">Yield Investors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sales Strategy</Label>
                  <Select value={form.salesStrategy} onValueChange={(v) => set("salesStrategy", v)}>
                    <SelectTrigger><SelectValue placeholder="Select strategy..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sell Off-Plan">Sell Off-Plan</SelectItem>
                      <SelectItem value="Sell on Completion">Sell on Completion (Ready)</SelectItem>
                      <SelectItem value="Build-to-Rent">Build-to-Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Competitive Density</Label>
                  <Select value={form.competitiveDensity} onValueChange={(v) => set("competitiveDensity", v)}>
                    <SelectTrigger><SelectValue placeholder="Select density..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low (Blue Ocean)</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Saturated">Saturated (Highly Competitive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Primary USP</Label>
                  <Select value={form.projectUsp} onValueChange={(v) => set("projectUsp", v)}>
                    <SelectTrigger><SelectValue placeholder="Select USP..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Location/Views">Location & Views</SelectItem>
                      <SelectItem value="Amenities/Facilities">Amenities & Facilities</SelectItem>
                      <SelectItem value="Price/Value">Price / Value for Money</SelectItem>
                      <SelectItem value="Design/Architecture">Design & Architecture</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Developer Type</Label>
                  <Select value={form.developerType} onValueChange={(v) => set("developerType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Master Developer">Master Developer</SelectItem>
                      <SelectItem value="Private/Boutique">Private / Boutique</SelectItem>
                      <SelectItem value="Institutional Investor">Institutional Investor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Yield</Label>
                  <Select value={form.targetYield} onValueChange={(v) => set("targetYield", v)}>
                    <SelectTrigger><SelectValue placeholder="Select yield..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="< 5%">Under 5%</SelectItem>
                      <SelectItem value="5-7%">5% - 7%</SelectItem>
                      <SelectItem value="7-9%">7% - 9%</SelectItem>
                      <SelectItem value="> 9%">Above 9%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                  {computedFitoutArea > 0 && form.fin01BudgetCap && (
                    <span className="ml-1 text-primary font-medium">
                      — Est. total: {(computedFitoutArea * form.fin01BudgetCap).toLocaleString()} AED
                    </span>
                  )}
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
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Amenity Focus</Label>
                  <Select value={form.amenityFocus} onValueChange={(v) => set("amenityFocus", v)}>
                    <SelectTrigger><SelectValue placeholder="Select focus..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wellness/Spa">Wellness & Spa</SelectItem>
                      <SelectItem value="F&B/Social">F&B and Social</SelectItem>
                      <SelectItem value="Business/Co-working">Business & Co-working</SelectItem>
                      <SelectItem value="Minimal/Essential">Minimal / Essential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tech Integration</Label>
                  <Select value={form.techIntegration} onValueChange={(v) => set("techIntegration", v)}>
                    <SelectTrigger><SelectValue placeholder="Select tech..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic Provisions</SelectItem>
                      <SelectItem value="Smart Home Ready">Smart Home Ready</SelectItem>
                      <SelectItem value="Fully Integrated">Fully Integrated (AI/IoT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-2">
                  <Label>Procurement Strategy</Label>
                  <Select value={form.procurementStrategy} onValueChange={(v) => set("procurementStrategy", v)}>
                    <SelectTrigger><SelectValue placeholder="Select strategy..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Turnkey">Turnkey (Design & Build)</SelectItem>
                      <SelectItem value="Traditional">Traditional (Design-Bid-Build)</SelectItem>
                      <SelectItem value="Construction Management">Construction Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Material Sourcing Mix</Label>
                  <Select value={form.materialSourcing} onValueChange={(v) => set("materialSourcing", v)}>
                    <SelectTrigger><SelectValue placeholder="Select sourcing..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Local">Predominantly Local (UAE/GCC)</SelectItem>
                      <SelectItem value="European">Predominantly European</SelectItem>
                      <SelectItem value="Asian">Predominantly Asian</SelectItem>
                      <SelectItem value="Global Mix">Balanced Global Mix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                      <span className="text-muted-foreground">Archetype:</span>{" "}
                      <span className="text-foreground capitalize">
                        {archetype.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scale:</span>{" "}
                      <span className="text-foreground">{form.ctx02Scale}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">GFA:</span>{" "}
                      <span className="text-foreground">
                        {form.ctx03Gfa ? `${form.ctx03Gfa.toLocaleString()} sqm` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fitout Area:</span>{" "}
                      <span className="text-primary font-medium">
                        {computedFitoutArea > 0 ? `${computedFitoutArea.toLocaleString()} sqm` : "—"}
                      </span>
                    </div>
                    {form.ctx03Gfa && computedFitoutArea > 0 && (
                      <div>
                        <span className="text-muted-foreground">Fitout Ratio:</span>{" "}
                        <span className="text-foreground">
                          {Math.round((computedFitoutArea / form.ctx03Gfa) * 100)}%
                        </span>
                      </div>
                    )}
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
                    {/* V5 Fields */}
                    {form.developerType && (
                      <div><span className="text-muted-foreground">Dev Type:</span> <span className="text-foreground">{form.developerType}</span></div>
                    )}
                    {form.targetDemographic && (
                      <div><span className="text-muted-foreground">Demographic:</span> <span className="text-foreground">{form.targetDemographic}</span></div>
                    )}
                    {form.salesStrategy && (
                      <div><span className="text-muted-foreground">Sales Strategy:</span> <span className="text-foreground">{form.salesStrategy}</span></div>
                    )}
                    {form.competitiveDensity && (
                      <div><span className="text-muted-foreground">Comp Density:</span> <span className="text-foreground">{form.competitiveDensity}</span></div>
                    )}
                    {form.projectUsp && (
                      <div><span className="text-muted-foreground">Project USP:</span> <span className="text-foreground">{form.projectUsp}</span></div>
                    )}
                    {form.targetYield && (
                      <div><span className="text-muted-foreground">Target Yield:</span> <span className="text-foreground">{form.targetYield}</span></div>
                    )}
                    {form.amenityFocus && (
                      <div><span className="text-muted-foreground">Amenity Focus:</span> <span className="text-foreground">{form.amenityFocus}</span></div>
                    )}
                    {form.techIntegration && (
                      <div><span className="text-muted-foreground">Tech:</span> <span className="text-foreground">{form.techIntegration}</span></div>
                    )}
                    {form.procurementStrategy && (
                      <div><span className="text-muted-foreground">Procurement:</span> <span className="text-foreground">{form.procurementStrategy}</span></div>
                    )}
                    {form.materialSourcing && (
                      <div><span className="text-muted-foreground">Sourcing:</span> <span className="text-foreground">{form.materialSourcing}</span></div>
                    )}
                    {form.fin01BudgetCap && computedFitoutArea > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Est. Total Budget:</span>{" "}
                        <span className="text-primary font-semibold">
                          {(computedFitoutArea * form.fin01BudgetCap).toLocaleString()} AED
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({form.fin01BudgetCap} AED/sqm × {computedFitoutArea.toLocaleString()} sqm)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* V4: Fitout area efficiency check in review */}
                {form.ctx03Gfa && computedFitoutArea > 0 && (
                  <FitoutAreaSummary
                    gfa={form.ctx03Gfa}
                    fitoutArea={computedFitoutArea}
                    archetype={archetype}
                  />
                )}

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
            disabled={isPending}
            className="gap-2"
          >
            {isPending ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> {submitLabel}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
