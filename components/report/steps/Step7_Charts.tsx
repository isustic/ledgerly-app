"use client";

import { useState, useEffect, useRef } from "react";
import { SERIES_COLORS } from "@/lib/chart-data";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Columns, TrendingUp, PieChart as PieChartIcon, AreaChart as AreaChartIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportResult, ChartConfig, Calculation } from "@/types/report";
import { transformDataForChart, getRecommendedChartType, isChartSupported, getChartTypeDescription } from "@/lib/chart-data";

interface Step7_ChartsProps {
  result: ReportResult | null;
  resultColumns: string[];
  groupBy: string[];
  calculations: Calculation[];
  chartConfig: ChartConfig | undefined;
  onChartConfigChange: (config: ChartConfig) => void;
  onBack: () => void;
  onExport?: () => void;
  chartRef?: React.RefObject<HTMLDivElement | null>;
  isVisible?: boolean;
}

const CHART_TYPES = [
  { type: "bar" as const, label: "Bar", icon: BarChart3, description: "Horizontal bars" },
  { type: "column" as const, label: "Column", icon: Columns, description: "Vertical bars" },
  { type: "line" as const, label: "Line", icon: TrendingUp, description: "Connected points" },
  { type: "pie" as const, label: "Pie", icon: PieChartIcon, description: "Circular slices" },
  { type: "area" as const, label: "Area", icon: AreaChartIcon, description: "Filled line" },
];

const COLORS = SERIES_COLORS;

export function Step7_Charts({
  result,
  resultColumns,
  groupBy,
  calculations,
  chartConfig,
  onChartConfigChange,
  onBack,
  onExport,
  chartRef: externalChartRef,
  isVisible = true,
}: Step7_ChartsProps) {
  const [enabled, setEnabled] = useState(chartConfig?.enabled ?? false);
  const [selectedType, setSelectedType] = useState(chartConfig?.type ?? "bar");
  const internalChartRef = useRef<HTMLDivElement>(null);
  const chartRef = externalChartRef || internalChartRef;

  // Update parent when config changes
  useEffect(() => {
    onChartConfigChange({
      enabled,
      type: selectedType,
    });
  }, [enabled, selectedType, onChartConfigChange]);

  // Check if chart is supported
  const chartCheck = result ? isChartSupported(result.rows, groupBy, calculations) : { supported: false };

  // Get recommended chart type
  const recommendedType = result
    ? getRecommendedChartType(groupBy.length, calculations.length, result.rowCount)
    : "bar";

  // Transform data for chart
  // IMPORTANT: Always transform when chartConfig is enabled, regardless of isVisible
  // This ensures the chart is available for export even when component is hidden
  const chartData = result && chartConfig?.enabled
    ? transformDataForChart(result.rows, groupBy, calculations, selectedType)
    : null;

  const handleTypeSelect = (type: typeof selectedType) => {
    setSelectedType(type);
  };

  const renderChart = () => {
    if (!chartData || !result) return null;

    const { data, xAxisKey, series } = chartData;

    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No data to display
        </div>
      );
    }

    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (selectedType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} name={s.name} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "column":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} className="text-xs" />
              <Tooltip />
              <Legend />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} name={s.name} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} name={s.name} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis />
              <Tooltip />
              <Legend />
              {series.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.6} name={s.name} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
        // For pie charts, we only use the first series
        const pieSeries = series[0];
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={120}
                fill={COLORS[0]}
                dataKey={pieSeries.key}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Hidden chart for export - rendered with opacity 0 so Recharts computes proper dimensions */}
      {!isVisible && chartConfig?.enabled && (
        <div
          ref={chartRef}
          className="fixed left-0 top-0 pointer-events-none bg-white p-6"
          style={{
            width: '800px',
            height: '600px',
            opacity: 0,
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          {renderChart()}
        </div>
      )}

      {/* Main visible chart */}
      <div className={cn("space-y-6", !isVisible && "hidden")}>
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Chart Visualization</h2>
          <p className="text-sm text-muted-foreground">
            Add a visual chart to complement your table data
          </p>
        </div>

        {!chartCheck.supported ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm font-medium mb-1">Chart not available</p>
            <p className="text-xs text-muted-foreground">{chartCheck.reason}</p>
          </div>
        ) : (
          <>
            {/* Enable Toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div className="space-y-0.5">
                <Label htmlFor="chart-toggle" className="text-base font-medium">
                  Enable chart
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show a visual chart alongside your table data
                </p>
              </div>
              <Switch
                id="chart-toggle"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            {enabled && (
              <>
                {/* Chart Type Selector */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Chart Type</Label>
                    {recommendedType === selectedType && (
                      <Badge variant="outline" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {CHART_TYPES.map((chart) => {
                      const Icon = chart.icon;
                      const isSelected = selectedType === chart.type;
                      return (
                        <button
                          key={chart.type}
                          onClick={() => handleTypeSelect(chart.type)}
                          className={`
                          flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all
                          ${isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30"
                            }
                        `}
                          title={chart.description}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                            {chart.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedType && (
                    <p className="text-xs text-muted-foreground">
                      {getChartTypeDescription(selectedType)}
                    </p>
                  )}
                </div>

                {/* Chart Preview */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview</Label>
                  <div ref={isVisible ? chartRef : undefined} className="rounded-lg border bg-white p-6">
                    {renderChart()}
                  </div>
                </div>

                {/* Data Info */}
                {chartData && (
                  <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                    <p className="text-xs font-medium">Chart Configuration</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">X-Axis:</span>{" "}
                        <span className="font-medium">{chartData.xAxisKey}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data Series:</span>{" "}
                        <span className="font-medium">{chartData.series.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data Points:</span>{" "}
                        <span className="font-medium">{chartData.data.length}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to results
          </Button>
          {onExport && (
            <Button onClick={onExport} className="gap-2">
              <Download className="w-4 h-4" />
              Export to Excel
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
