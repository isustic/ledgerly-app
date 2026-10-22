"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Settings2, Database, History, PanelLeftClose, PanelLeft, FileSpreadsheet, Home, List, GitCompare, Table2, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/upload", label: "Raw data", icon: Database },
    { href: "/analysis", label: "Analysis", icon: GitCompare },
    { href: "/report", label: "Report builder", icon: BarChart3 },
    { href: "/epp", label: "EPro", icon: FileSpreadsheet },
    { href: "/ty-reports", label: "TY Reports", icon: Table2 },
    { href: "/clients", label: "Clients", icon: Users },
    { href: "/subgroups", label: "Subgroups", icon: List },
    { href: "/istoric", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [appVersion, setAppVersion] = useState("");

    useEffect(() => {
        import("@tauri-apps/api/app")
            .then((m) => m.getVersion())
            .then(setAppVersion)
            .catch(() => {});
    }, []);

    // Load collapsed state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem("sidebar-collapsed");
            if (stored !== null) setCollapsed(stored === "true");
        } catch {
            // Storage unavailable: keep the default expanded state.
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("sidebar-collapsed", String(next));
            } catch {
                // Ignore: the toggle still works for this session.
            }
            return next;
        });
    };

    return (
        <aside
            className={cn(
                "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
                collapsed ? "w-16" : "w-60"
            )}
        >
            {/* Brand: the icon tile is the only brand moment in the chrome */}
            <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-3")}>
                <Link href="/" className={cn("flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "hidden")}>
                    <img src="/logo.png" alt="" width={28} height={28} className="size-7 shrink-0 rounded-md" />
                    <span className="truncate text-sm font-semibold tracking-tight text-foreground">Ledgerly</span>
                </Link>

                <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={collapsed ? label : undefined}
                            aria-label={collapsed ? label : undefined}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                                "relative flex h-9 items-center rounded-md text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                                collapsed ? "justify-center" : "gap-3 px-3",
                                active
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                            <Icon size={18} className="shrink-0" />
                            {!collapsed && <span className="truncate">{label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className={cn("shrink-0 border-t border-sidebar-border px-3 py-3", collapsed && "flex justify-center px-2")}>
                {collapsed ? (
                    <span className="font-data text-[10px] text-muted-foreground">{appVersion && `v${appVersion}`}</span>
                ) : (
                    <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Version</p>
                        <p className="font-data text-xs text-foreground">{appVersion && `v${appVersion}`}</p>
                    </div>
                )}
            </div>
        </aside>
    );
}
