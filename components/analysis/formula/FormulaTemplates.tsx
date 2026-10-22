"use client";

import { translate } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useState } from "react";

interface FormulaTemplate {
    id: string;
    name: string;
    category: string;
    formula: string;
    description: string;
    placeholders: string[];
}

const templates: FormulaTemplate[] = [
    {
        id: "avg",
        name: "Average",
        category: "Metrics",
        formula: "AVG(column)",
        description: "Calculate the average of values",
        placeholders: ["column"]
    },
    {
        id: "sum",
        name: "Sum",
        category: "Metrics",
        formula: "SUM(column)",
        description: "Calculate the total sum of values",
        placeholders: ["column"]
    },
    {
        id: "count",
        name: "Count",
        category: "Metrics",
        formula: "COUNT(column)",
        description: "Count non-null values",
        placeholders: ["column"]
    },
    {
        id: "min",
        name: "Minimum",
        category: "Metrics",
        formula: "MIN(column)",
        description: "Find the minimum value",
        placeholders: ["column"]
    },
    {
        id: "max",
        name: "Maximum",
        category: "Metrics",
        formula: "MAX(column)",
        description: "Find the maximum value",
        placeholders: ["column"]
    },
    {
        id: "growth-rate",
        name: "Growth Rate",
        category: "Math",
        formula: "((current - previous) / previous) * 100",
        description: "Calculate percentage growth",
        placeholders: ["current", "previous"]
    },
    {
        id: "percent-change",
        name: "Percent Change",
        category: "Math",
        formula: "((new_value - old_value) / old_value) * 100",
        description: "Calculate percentage change between two values",
        placeholders: ["new_value", "old_value"]
    },
    {
        id: "ratio",
        name: "Ratio",
        category: "Math",
        formula: "(numerator / denominator)",
        description: "Calculate ratio between two values",
        placeholders: ["numerator", "denominator"]
    },
    {
        id: "year",
        name: "Year Extract",
        category: "Date",
        formula: "YEAR(date_column)",
        description: "Extract year from date",
        placeholders: ["date_column"]
    },
    {
        id: "month",
        name: "Month Extract",
        category: "Date",
        formula: "MONTH(date_column)",
        description: "Extract month from date",
        placeholders: ["date_column"]
    },
    {
        id: "day",
        name: "Day Extract",
        category: "Date",
        formula: "DAY(date_column)",
        description: "Extract day from date",
        placeholders: ["date_column"]
    },
    {
        id: "datediff",
        name: "Date Difference",
        category: "Date",
        formula: "DATEDIFF(end_date, start_date)",
        description: "Calculate days between dates",
        placeholders: ["end_date", "start_date"]
    },
    {
        id: "dateadd",
        name: "Date Add",
        category: "Date",
        formula: "DATEADD(date_column, interval, unit)",
        description: "Add interval to date",
        placeholders: ["date_column", "interval", "unit"]
    },
    {
        id: "concat",
        name: "Full Name",
        category: "Text",
        formula: "CONCAT(first_name, ' ', last_name)",
        description: "Combine text values",
        placeholders: ["first_name", "last_name"]
    },
    {
        id: "upper",
        name: "Uppercase",
        category: "Text",
        formula: "UPPER(text_column)",
        description: "Convert text to uppercase",
        placeholders: ["text_column"]
    },
    {
        id: "lower",
        name: "Lowercase",
        category: "Text",
        formula: "LOWER(text_column)",
        description: "Convert text to lowercase",
        placeholders: ["text_column"]
    },
    {
        id: "substring",
        name: "Substring",
        category: "Text",
        formula: "SUBSTRING(text_column, start, length)",
        description: "Extract portion of text",
        placeholders: ["text_column", "start", "length"]
    },
    {
        id: "trim",
        name: "Trim",
        category: "Text",
        formula: "TRIM(text_column)",
        description: "Remove leading/trailing spaces",
        placeholders: ["text_column"]
    },
    {
        id: "conditional",
        name: "Conditional Value",
        category: "Logic",
        formula: "IF(condition, value_if_true, value_if_false)",
        description: "Return different values based on condition",
        placeholders: ["condition", "value_if_true", "value_if_false"]
    },
    {
        id: "coalesce",
        name: "Coalesce",
        category: "Logic",
        formula: "COALESCE(value1, value2, default_value)",
        description: "Return first non-null value",
        placeholders: ["value1", "value2", "default_value"]
    },
    {
        id: "nullif",
        name: "Null If",
        category: "Logic",
        formula: "NULLIF(value1, value2)",
        description: "Return NULL if values are equal",
        placeholders: ["value1", "value2"]
    },
    {
        id: "case-when",
        name: "Case When",
        category: "Logic",
        formula: "CASE WHEN condition THEN result ELSE default END",
        description: "Conditional logic with multiple cases",
        placeholders: ["condition", "result", "default"]
    },
];

const categories = ["Metrics", "Math", "Date", "Text", "Logic"];

const categoryIcons: Record<string, string> = {
    Metrics: "📈",
    Math: "🧮",
    Date: "📅",
    Text: "📝",
    Logic: "🧠",
};

interface FormulaTemplatesProps {
    onSelect: (formula: string) => void;
}

export function FormulaTemplates({ onSelect }: FormulaTemplatesProps) {
    useLanguage();
    const [selectedCategory, setSelectedCategory] = useState<string>("Metrics");

    const filteredTemplates = selectedCategory
        ? templates.filter(t => t.category === selectedCategory)
        : templates;

    return (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {translate("Quick Templates")}</h4>

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-1 mb-3">
                {categories.map((category) => (
                    <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-2 py-1 text-[10px] rounded transition-colors ${
                            selectedCategory === category
                                ? "bg-primary text-primary-foreground font-medium"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted/70"
                        }`}
                    >
                        {categoryIcons[category]}{translate(category)}
                    </button>
                ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-2 gap-2">
                {filteredTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onSelect(template.formula)}
                        className="p-2 bg-background/50 rounded hover:bg-primary/10 transition-colors text-left group"
                        title={translate(template.description)}
                    >
                        <p className="text-xs font-medium group-hover:text-primary transition-colors">
                            {translate(template.name)}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {template.formula}
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}
