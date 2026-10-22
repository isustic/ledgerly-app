"use client";

import { useId, type ReactElement, type RefObject } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AreaChart as AreaIcon,
  BarChart3 as BarsIcon,
  Columns3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  type LucideIcon,
} from "lucide-react";
import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SERIES_COLORS,
  getChartTypeDescription,
  getRecommendedChartType,
  isChartSupported,
  transformDataForChart,
} from "@/lib/chart-data";
import type { Calculation, ChartConfig, ChartType, ReportResult } from "@/types/report";
import { SectionHint } from "./SectionCard";

const CHART_TYPES: Array<{ type: ChartType; label: string; icon: LucideIcon }> = [
  { type: "bar", label: "Bars", icon: BarsIcon },
  { type: "column", label: "Columns", icon: Columns3 },
  { type: "line", label: "Line", icon: LineIcon },
  { type: "area", label: "Area", icon: AreaIcon },
  { type: "pie", label: "Pie", icon: PieIcon },
];

// SVG attributes cannot read CSS variables, so preview colours are applied through selectors instead.
const THEMED_CHART = [
  "[&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground",
  "[&_.recharts-cartesian-grid_line]:stroke-border",
  "[&_.recharts-pie-label-text]:fill-foreground",
].join(" ");

// Exports always render on white, so they use fixed light colours.
const EXPORT_INK = { axis: "#5b6661", grid: "#e4e8e6", text: "#0e1512", surface: "#ffffff", hover: "#f4f6f5" };

const PREVIEW_TOOLTIP = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

interface ChartPaneProps {
  result: ReportResult | null;
  groupBy: string[];
  calculations: Calculation[];
  config: ChartConfig | undefined;
  onChange: (update: Partial<ChartConfig>) => void;
  /** The chart's DOM node, which export rasterises. */
  containerRef?: RefObject<HTMLDivElement | null>;
  variant?: "preview" | "export";
}

export function ChartPane({ result, groupBy, calculations, config, onChange, containerRef, variant = "preview" }: ChartPaneProps) {
  useLanguage();
  const switchId = useId();

  const recommended = result
    ? getRecommendedChartType(groupBy.length, calculations.length, result.rowCount)
    : "column";
  const type = config?.type ?? recommended;
  const support = result
    ? isChartSupported(result.rows, groupBy, calculations)
    : { supported: false, reason: "No data to display" };
  const chart = result && support.supported ? transformDataForChart(result.rows, groupBy, calculations, type) : null;

  if (variant === "export") {
    return (
      <div
        ref={containerRef}
        className="p-6"
        style={{ width: 800, height: 500, backgroundColor: EXPORT_INK.surface, color: EXPORT_INK.text }}
        aria-hidden="true"
      >
        {chart && <ChartCanvas type={type} chart={chart} exporting />}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted/60 p-1">
          {CHART_TYPES.map(({ type: option, label, icon: Icon }) => {
            const active = option === type;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ type: option })}
                aria-pressed={active}
                title={translate(getChartTypeDescription(option))}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", active && "text-primary")} />
                {translate(label)}
              </button>
            );
          })}
        </div>
        {type === recommended && (
          <Badge variant="secondary" className="text-xs">
            {translate("Recommended")}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor={switchId} className="text-xs text-muted-foreground">
            {translate("Include in export")}
          </label>
          <Switch
            id={switchId}
            checked={config?.enabled ?? false}
            onCheckedChange={(enabled) => onChange({ enabled })}
            disabled={!chart}
          />
        </div>
      </div>

      {!chart ? (
        <SectionHint icon={BarsIcon}>{translate(support.reason ?? "No data to display")}</SectionHint>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{translate(getChartTypeDescription(type))}</p>
          <div ref={containerRef} className="min-h-[360px] flex-1 rounded-lg border border-border/60 bg-card p-4">
            <div className={cn("h-full", THEMED_CHART)}>
              <ChartCanvas type={type} chart={chart} exporting={false} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type ChartData = NonNullable<ReturnType<typeof transformDataForChart>>;

function ChartCanvas({ type, chart, exporting }: { type: ChartType; chart: ChartData; exporting: boolean }) {
  const { data, series } = chart;
  if (data.length === 0 || series.length === 0) {
    return <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{translate("No data to display")}</p>;
  }

  const tick = exporting ? { fill: EXPORT_INK.axis, fontSize: 12 } : { fontSize: 12 };
  const grid = <CartesianGrid strokeDasharray="3 3" stroke={exporting ? EXPORT_INK.grid : undefined} vertical={false} />;
  const tooltip = (
    <Tooltip contentStyle={exporting ? undefined : PREVIEW_TOOLTIP} cursor={exporting ? { fill: EXPORT_INK.hover } : undefined} />
  );
  const legend = <Legend wrapperStyle={{ color: exporting ? EXPORT_INK.text : "var(--muted-foreground)" }} />;
  const margin = { top: 12, right: 16, left: 4, bottom: 4 };
  const longestLabel = Math.max(...data.map((d) => d.name.length));
  const labelWidth = Math.min(200, Math.max(72, longestLabel * 7));

  let chartElement: ReactElement;

  switch (type) {
    case "bar":
      chartElement = (
        <BarChart data={data} layout="vertical" margin={margin}>
          {grid}
          <XAxis type="number" tick={tick} />
          <YAxis type="category" dataKey="name" width={labelWidth} tick={tick} />
          {tooltip}
          {legend}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[0, 4, 4, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      );
      break;

    case "column":
      chartElement = (
        <BarChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="name" tick={tick} interval="preserveStartEnd" />
          <YAxis tick={tick} />
          {tooltip}
          {legend}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
          ))}
        </BarChart>
      );
      break;

    case "line":
      chartElement = (
        <LineChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="name" tick={tick} interval="preserveStartEnd" />
          <YAxis tick={tick} />
          {tooltip}
          {legend}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      );
      break;

    case "area":
      chartElement = (
        <AreaChart data={data} margin={margin}>
          {grid}
          <XAxis dataKey="name" tick={tick} interval="preserveStartEnd" />
          <YAxis tick={tick} />
          {tooltip}
          {legend}
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.2} strokeWidth={2} />
          ))}
        </AreaChart>
      );
      break;

    case "pie":
      chartElement = (
        <PieChart>
          <Pie
            data={data}
            dataKey={series[0].key}
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="75%"
            innerRadius="40%"
            paddingAngle={1}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`slice-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </Pie>
          {tooltip}
          {legend}
        </PieChart>
      );
      break;
  }

  return <ResponsiveContainer width="100%" height="100%">{chartElement}</ResponsiveContainer>;
}
