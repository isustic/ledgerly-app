'use client';

import { useEffect, useState } from 'react';
import { safeInvoke, safeListen } from '@/lib/tauri';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface UpdateInfo {
  version: string;
  notes?: string | null;
}

interface UpdateDialogProps {
  open: boolean;
  update: UpdateInfo | null;
  onClose: () => void;
}

type Phase = 'idle' | 'downloading' | 'installed' | 'error';

export function UpdateDialog({ open, update, onClose }: UpdateDialogProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPhase('idle');
    setPercent(null);
    setError('');
  }, [open]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    safeListen<{ downloaded: number; total: number | null }>('update-progress', (e) => {
      const { downloaded, total } = e.payload;
      setPercent(total ? Math.min(100, Math.round((downloaded / total) * 100)) : null);
    })
      .then((fn) => (unlisten = fn))
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  const handleInstall = async () => {
    setPhase('downloading');
    setPercent(0);
    try {
      // On Windows the installer closes the app itself; elsewhere we get control back.
      await safeInvoke('install_update');
      setPhase('installed');
    } catch (e) {
      setError(typeof e === 'string' ? e : 'The update could not be installed.');
      setPhase('error');
    }
  };

  const handleRestart = async () => {
    try {
      await safeInvoke('restart_app');
    } catch {
      /* app is closing */
    }
  };

  const busy = phase === 'downloading';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            {phase === 'installed'
              ? 'The update is installed. Restart Ledgerly to finish.'
              : `Ledgerly ${update?.version ?? ''} is available.`}
          </DialogDescription>
        </DialogHeader>
        {update?.notes && phase === 'idle' && (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {update.notes}
          </p>
        )}
        {busy && (
          <div className="space-y-2">
            <Progress value={percent ?? 0} />
            <p className="text-xs text-muted-foreground">
              {percent === null ? 'Downloading…' : `Downloading… ${percent}%`}
            </p>
          </div>
        )}
        {phase === 'error' && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          {phase === 'installed' ? (
            <Button onClick={handleRestart}>Restart Now</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Later
              </Button>
              <Button onClick={handleInstall} disabled={busy}>
                {busy ? 'Installing…' : phase === 'error' ? 'Retry' : 'Update Now'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
