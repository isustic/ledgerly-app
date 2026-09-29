'use client';

import { useEffect, useState } from "react";
import { UpdateDialog, type UpdateInfo } from '@/components/UpdateDialog';
import { safeInvoke } from '@/lib/tauri';

export function UpdateChecker() {
    const [update, setUpdate] = useState<UpdateInfo | null>(null);

    useEffect(() => {
        safeInvoke<UpdateInfo | null>('check_for_updates')
            .then((info) => setUpdate(info))
            .catch(() => {
                // Not running in Tauri, offline, or no release published yet
            });
    }, []);

    return <UpdateDialog open={update !== null} update={update} onClose={() => setUpdate(null)} />;
}
