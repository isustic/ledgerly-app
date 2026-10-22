"use client";

import { translate, translateMessage, getLocale } from "@/lib/i18n";
import { useLanguage } from "@/components/LanguageProvider";
import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Play, Trash2, Plus, LoaderIcon, AlertCircleIcon, CheckCircle2Icon, Calculator } from "lucide-react";
import { FunctionReference } from "./FunctionReference";
import { FormulaAutocomplete, AutocompleteItem } from "./FormulaAutocomplete";
import { FormulaTemplates } from "./FormulaTemplates";
import { FormulaBuilder } from "./FormulaBuilder";
import { useFormulaValidation } from "./useFormulaValidation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FormulaEditorProps {
    datasetId: number;
    columns: string[];
}

interface SavedFormula {
    id: number;
    name: string;
    formula_sql: string;
}

type FormulaPreview =
    | { type: "scalar"; value: number | null; formula: string }
    | { type: "rows"; values: (string | number | null)[]; formula: string }
    | null;

export function FormulaEditor({ datasetId, columns }: FormulaEditorProps) {
    useLanguage();
    const [name, setName] = useState("");
    const [formula, setFormula] = useState("");
    const [mode, setMode] = useState<"code" | "builder">("code");
    const [formulas, setFormulas] = useState<SavedFormula[]>([]);
    const [preview, setPreview] = useState<FormulaPreview>(null);
    const [selectedFormula, setSelectedFormula] = useState<SavedFormula | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingFormulas, setIsLoadingFormulas] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Live syntax validation
    const { validation, isValidating } = useFormulaValidation(datasetId, formula);

    // Autocomplete state
    const [autocomplete, setAutocomplete] = useState<{
        show: boolean;
        query: string;
        position: { top: number; left: number };
    }>({ show: false, query: "", position: { top: 0, left: 0 } });

    const loadFormulas = async () => {
        setIsLoadingFormulas(true);
        try {
            const res = await invoke<SavedFormula[]>("list_formulas", { datasetId });
            setFormulas(res);
        } catch (_err) {
            setError("Failed to load saved formulas.");
        } finally {
            setIsLoadingFormulas(false);
        }
    };

    useEffect(() => {
        loadFormulas();
    }, [datasetId]);

    const handleTest = async () => {
        if (!formula.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const res = await invoke<FormulaPreview>("test_formula", {
                datasetId,
                formulaSql: formula,
            });
            setPreview(res);
            setSuccessMessage("Formula test successful!");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Formula test failed: ${errorMessage}. Please check your syntax and try again.`);
            setPreview(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !formula.trim()) return;

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await invoke("save_formula", {
                datasetId,
                name: name.trim(),
                formulaSql: formula.trim(),
            });
            setName("");
            setFormula("");
            setPreview(null);
            setSuccessMessage("Formula saved successfully!");
            setTimeout(() => setSuccessMessage(null), 3000);
            loadFormulas();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(`Failed to save formula: ${errorMessage}. Please try again.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await invoke("delete_formula", { formulaId: id });
            loadFormulas();
            if (selectedFormula?.id === id) {
                setSelectedFormula(null);
                setName("");
                setFormula("");
                setPreview(null);
            }
        } catch (_err) {
            setError("Failed to delete formula.");
        }
    };

    const insertColumn = (col: string) => {
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newFormula = formula.substring(0, start) + col + formula.substring(end);
            setFormula(newFormula);
            // Restore focus and set cursor after inserted column
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + col.length, start + col.length);
            }, 0);
        } else {
            setFormula((f) => f + col);
        }
    };

    const insertFunction = (fn: string) => {
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = formula.substring(start, end);

            let newFormula: string;
            let cursorPos: number;

            if (selectedText) {
                // Wrap selected text with the function
                newFormula = formula.substring(0, start) + `${fn}(${selectedText})` + formula.substring(end);
                cursorPos = start + fn.length + selectedText.length + 2; // Position after closing parenthesis
            } else {
                // Insert function with placeholder at cursor position
                newFormula = formula.substring(0, start) + `${fn}()` + formula.substring(end);
                cursorPos = start + fn.length + 1; // Position between parentheses
            }

            setFormula(newFormula);
            // Restore focus and set cursor position
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(cursorPos, cursorPos);
            }, 0);
        } else {
            setFormula((f) => f + fn + "()");
        }
    };

    const handleTemplateSelect = (templateFormula: string) => {
        setFormula(templateFormula);
        // Highlight first placeholder for replacement (lowercase words in the formula)
        setTimeout(() => {
            const textarea = textareaRef.current;
            if (textarea) {
                // Match lowercase words/underscores (placeholders) but not function names (uppercase)
                const match = templateFormula.match(/\b[a-z_][a-z0-9_]*\b/);
                if (match) {
                    const start = templateFormula.indexOf(match[0]);
                    textarea.focus();
                    textarea.setSelectionRange(start, start + match[0].length);
                }
            }
        }, 0);
    };

    const handleAutocompleteTrigger = () => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const text = formula.substring(0, start);

        // Find the word being typed
        const match = text.match(/(\w+)$/);
        if (match && match[1].length >= 1) {
            const rect = textarea.getBoundingClientRect();
            setAutocomplete({
                show: true,
                query: match[1],
                position: {
                    top: rect.bottom,
                    left: rect.left
                }
            });
        } else {
            setAutocomplete(prev => ({ ...prev, show: false }));
        }
    };

    const handleAutocompleteSelect = (item: AutocompleteItem) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const text = formula.substring(0, start);

        // Find and replace the word being typed
        const beforeCursor = text.replace(/\w+$/, "");
        const afterCursor = formula.substring(start);
        const newFormula = beforeCursor + item.name + afterCursor;

        setFormula(newFormula);
        setAutocomplete({ show: false, query: "", position: { top: 0, left: 0 } });

        // Focus textarea
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(beforeCursor.length + item.name.length, beforeCursor.length + item.name.length);
        }, 0);
    };

    // Global keydown listener for keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Space: Autocomplete
            if (e.ctrlKey && e.key === " ") {
                e.preventDefault();
                handleAutocompleteTrigger();
            }
            // Ctrl+Enter: Test formula
            if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                if (formula.trim() && validation.isValid && !isValidating) {
                    handleTest();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [formula, validation.isValid, isValidating]);

    const card = "rounded-xl border border-border/60 bg-card p-4 shadow-sm";
    const label = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

    return (
        <div className="space-y-5">
            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertDescription>{translateMessage(error)}</AlertDescription>
                </Alert>
            )}

            {/* Success Display */}
            {successMessage && (
                <Alert className="border-primary/40 bg-accent text-primary">
                    <CheckCircle2Icon className="h-4 w-4" />
                    <AlertDescription>{translateMessage(successMessage)}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
                {/* Main column */}
                <div className="min-w-0 space-y-5">
                    {/* Editor card */}
                    <div className={`${card} space-y-4`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <label className={label}>{translate("Name")}</label>
                                <Input
                                    placeholder={translate("Formula name (e.g., Net Profit)")}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isLoading}
                                    className="h-9"
                                />
                            </div>

                            {/* Mode Toggle */}
                            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1 sm:w-56">
                                <button
                                    onClick={() => setMode("code")}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "code" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {translate("⚡ Code")}
                                </button>
                                <button
                                    onClick={() => setMode("builder")}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === "builder" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {translate("🧩 Builder")}
                                </button>
                            </div>
                        </div>

                        {mode === "code" ? (
                            <div className="space-y-2">
                                <label className={label}>{translate("Formula")}</label>
                                <textarea
                                    ref={textareaRef}
                                    placeholder={translate("Enter formula (e.g., AVG(Sales) - SUM(Expenses))")}
                                    value={formula}
                                    onChange={(e) => setFormula(e.target.value)}
                                    disabled={isLoading}
                                    spellCheck={false}
                                    className="font-data min-h-[160px] w-full resize-y rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-primary focus:bg-background disabled:opacity-50"
                                />
                            </div>
                        ) : (
                            <FormulaBuilder
                                columns={columns}
                                onFormulaChange={setFormula}
                                currentFormula={formula}
                            />
                        )}

                        {/* Validation status + shortcuts */}
                        <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                {!formula.trim() ? (
                                    <span>{translate("Write a formula to check its syntax.")}</span>
                                ) : isValidating ? (
                                    <>
                                        <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                                        <span>{translate("Checking syntax...")}</span>
                                    </>
                                ) : validation.isValid ? (
                                    <span className="flex items-center gap-1.5 font-medium text-primary">
                                        <CheckCircle2Icon className="h-3.5 w-3.5" />
                                        {translate("Syntax OK")}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                                        <AlertCircleIcon className="h-3.5 w-3.5" />
                                        <span className="truncate">{translateMessage(validation.error ?? "").substring(0, 80)}...</span>
                                    </span>
                                )}
                            </div>
                            <p className="text-muted-foreground">
                                {translate("Ctrl+Space: Autocomplete • Ctrl+Enter: Test Formula")}
                            </p>
                        </div>

                        {mode === "code" && (
                            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                {translate("💡 Tip: Select text and click a function to wrap it, or click function then insert columns inside parentheses.")}
                            </p>
                        )}

                        <div className="flex gap-2 border-t border-border/60 pt-4">
                            <Button onClick={handleTest} disabled={!formula.trim() || isLoading || !validation.isValid || isValidating}>
                                {isLoading ? (
                                    <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="mr-1.5 h-4 w-4" />
                                )}
                                {isLoading ? translate("Testing...") : translate("Test formula")}
                            </Button>
                            <Button variant="outline" onClick={handleSave} disabled={!name.trim() || !formula.trim() || isLoading}>
                                {isLoading ? (
                                    <LoaderIcon className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-1.5 h-4 w-4" />
                                )}
                                {isLoading ? translate("Saving...") : translate("Save")}
                            </Button>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview && (
                        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                            {preview.type === "scalar" ? (
                                <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                                                <Calculator className="h-3.5 w-3.5" />
                                            </span>
                                            <span className={label}>{translate("Result")}</span>
                                        </div>
                                        <p className="font-data text-4xl font-bold tracking-tight">
                                            {preview.value !== null ? Number(preview.value).toLocaleString(getLocale(), {
                                                maximumFractionDigits: 2,
                                            }) : "NULL"}
                                        </p>
                                    </div>
                                    <code className="font-data max-w-full truncate rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:max-w-xs">
                                        {preview.formula}
                                    </code>
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                                        <span className="text-sm font-semibold">{translate("Preview (first 10 rows)")}</span>
                                        <code className="font-data max-w-xs truncate text-xs text-muted-foreground">{preview.formula}</code>
                                    </div>
                                    <div className="max-h-72 overflow-auto">
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {preview.values.map((val, i) => (
                                                    <tr key={i} className="border-t border-border/50 transition-colors first:border-t-0 hover:bg-muted/40">
                                                        <td className="font-data w-14 px-4 py-2 text-xs text-muted-foreground">{i + 1}</td>
                                                        <td className="px-4 py-2">
                                                            {val !== null ? String(val) : <span className="text-muted-foreground/60">NULL</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <aside className="min-w-0 space-y-5">
                    {/* Functions */}
                    <FunctionReference onInsert={insertFunction} />

                    {/* Columns */}
                    <div className={card}>
                        <h4 className={`${label} mb-3`}>{translate("Columns")}</h4>
                        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                            {columns.map((col) => (
                                <button
                                    key={col}
                                    onClick={() => insertColumn(col)}
                                    disabled={isLoading}
                                    className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary disabled:opacity-50"
                                >
                                    {col}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quick Templates */}
                    <FormulaTemplates onSelect={handleTemplateSelect} />

                    {/* Saved Formulas */}
                    <div className={card}>
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className={label}>{translate("Saved")}</h4>
                            <Button size="icon-xs" variant="ghost" onClick={() => { setName(""); setFormula(""); }} disabled={isLoading} aria-label={translate("New formula")}>
                                <Plus size={12} />
                            </Button>
                        </div>
                        {isLoadingFormulas ? (
                            <div className="flex items-center justify-center py-4">
                                <LoaderIcon className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {formulas.map((f) => (
                                    <div
                                        key={f.id}
                                        className="group flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border/60 hover:bg-muted/40"
                                    >
                                        <button
                                            onClick={() => {
                                                setSelectedFormula(f);
                                                setName(f.name);
                                                setFormula(f.formula_sql);
                                            }}
                                            disabled={isLoading}
                                            className="min-w-0 flex-1 truncate text-left text-sm font-medium disabled:opacity-50"
                                        >
                                            {f.name}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(f.id)}
                                            aria-label={translate("Delete")}
                                            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {formulas.length === 0 && (
                                    <p className="rounded-lg border-2 border-dashed border-border/70 py-4 text-center text-xs text-muted-foreground">
                                        {translate("No saved formulas")}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {/* Autocomplete */}
            {autocomplete.show && (
                <FormulaAutocomplete
                    query={autocomplete.query}
                    columns={columns}
                    onSelect={handleAutocompleteSelect}
                    onClose={() => setAutocomplete(prev => ({ ...prev, show: false }))}
                    position={autocomplete.position}
                />
            )}
        </div>
    );
}
