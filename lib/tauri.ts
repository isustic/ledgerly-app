import { getLanguage, translate } from "@/lib/i18n";

/**
 * Safe Tauri API wrappers that handle both Tauri and browser contexts.
 * Use these instead of importing directly from Tauri packages.
 */

// Cache for loaded modules
let invokeCache: any = null;
let openCache: any = null;
let listenCache: any = null;
let confirmCache: any = null;

/**
 * Safe invoke wrapper for calling Tauri commands
 */
export async function safeInvoke<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T> {
    if (!invokeCache) {
        try {
            const tauri = await import('@tauri-apps/api/core');
            invokeCache = tauri.invoke;
        } catch {
            throw new Error('Not running in Tauri context');
        }
    }
    const localizedArgs = ["export_report", "export_all_epp_reports", "export_ty_report"].includes(command)
        ? { ...args, language: getLanguage() }
        : args;
    return invokeCache(command, localizedArgs) as Promise<T>;
}

/**
 * Safe open wrapper for file dialogs
 */
export async function safeOpen(
    options?: Record<string, unknown>
): Promise<string | string[] | null> {
    if (!openCache) {
        try {
            const dialog = await import('@tauri-apps/plugin-dialog');
            openCache = dialog.open;
        } catch {
            throw new Error('Not running in Tauri context');
        }
    }
    const localizedOptions = options ? { ...options,
        ...(typeof options.title === "string" ? { title: translate(options.title) } : {}),
        ...(Array.isArray(options.filters) ? { filters: options.filters.map((filter: { name: string; extensions: string[] }) => ({ ...filter, name: translate(filter.name) })) } : {}),
    } : options;
    return openCache(localizedOptions as any) as Promise<string | string[] | null>;
}

/**
 * Safe listen wrapper for event listeners
 */
export async function safeListen<T>(
    event: string,
    handler: (event: { payload: T }) => void
): Promise<() => void> {
    if (!listenCache) {
        try {
            const tauriEvent = await import('@tauri-apps/api/event');
            listenCache = tauriEvent.listen;
        } catch {
            throw new Error('Not running in Tauri context');
        }
    }
    return listenCache(event, handler);
}

/**
 * Safe confirm wrapper using Tauri dialog
 */
export async function safeConfirm(
    message: string,
    title?: string
): Promise<boolean> {
    if (!confirmCache) {
        try {
            const dialog = await import('@tauri-apps/plugin-dialog');
            confirmCache = dialog.confirm;
        } catch {
            return window.confirm(message);
        }
    }
    return confirmCache(message, { title: title || translate('Confirm'), kind: 'warning', okLabel: translate('Yes'), cancelLabel: translate('Cancel') });
}

/**
 * Check if we're running in Tauri context
 */
export async function isTauri(): Promise<boolean> {
    try {
        await import('@tauri-apps/api/core');
        return true;
    } catch {
        return false;
    }
}
