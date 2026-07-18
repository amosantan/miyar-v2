import { useId } from "react";
import {
  REPORT_LOCALE_OPTIONS,
  isReportLocale,
  type ReportLocale,
} from "@shared/report-locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ReportLocaleSelectProps {
  /** Controlled by the parent so every export control can use its app locale as the initial value. */
  value: ReportLocale;
  onValueChange: (locale: ReportLocale) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  label?: string;
}

/**
 * A controlled locale selector for report/export controls. It deliberately does
 * not read application i18n state or call an exporter: the owning screen sets
 * its initial value and passes the selected locale to its mutation.
 */
export function ReportLocaleSelect({
  value,
  onValueChange,
  disabled = false,
  id,
  className,
  label = "Report language",
}: ReportLocaleSelectProps) {
  const generatedId = useId();
  const selectId = id ?? `report-locale-${generatedId}`;

  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(candidate) => {
          if (isReportLocale(candidate)) onValueChange(candidate);
        }}
      >
        <SelectTrigger id={selectId} aria-label={label} className="min-w-[9rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_LOCALE_OPTIONS.map((option) => (
            <SelectItem key={option.code} value={option.code} dir={option.direction}>
              {option.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
