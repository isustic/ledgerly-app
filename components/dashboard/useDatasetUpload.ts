"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { safeInvoke, safeOpen, safeListen } from "@/lib/tauri";
import { setLastOpenedDataset } from "@/lib/dataset-tracking";

type UnlistenFn = () => void;

interface IngestProgress {
    pct: number;
    rows_done: number;
}

export function useDatasetUpload() {
    const router = useRouter();
    const [isIngesting, setIsIngesting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [rowsDone, setRowsDone] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    const ingestPath = useCallback(async (path: string) => {
        setError(null);
        setIsIngesting(true);
        setProgress(0);
        setRowsDone(0);

        unlistenRef.current = await safeListen<IngestProgress>("ingest_progress", (ev) => {
            setProgress(ev.payload.pct);
            setRowsDone(ev.payload.rows_done);
        });

        try {
            const datasetName = path.split("/").pop()?.replace(".xlsx", "") ?? "Dataset";
            const result = await safeInvoke<{ id: number }>("ingest_file", {
                path,
                datasetName,
            });
            setProgress(100);
            setLastOpenedDataset(result.id);
            router.push(`/upload?dataset=${result.id}`);
        } catch (err) {
            setError(String(err));
            setIsIngesting(false);
        } finally {
            unlistenRef.current?.();
            unlistenRef.current = null;
        }
    }, [router]);

    const pickAndUpload = useCallback(async () => {
        const selected = await safeOpen({
            filters: [{ name: "Excel File", extensions: ["xlsx"] }],
            multiple: false,
        });
        if (typeof selected === "string") {
            await ingestPath(selected);
        }
    }, [ingestPath]);

    const clearError = useCallback(() => setError(null), []);

    return { pickAndUpload, ingestPath, isIngesting, progress, rowsDone, error, clearError };
}
