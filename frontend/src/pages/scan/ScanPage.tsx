// ScanPage.tsx — QR scanner for Worker and Issuer (route: /scan).
//
// Worker scans a TOOL sticker  -> parseToolSticker -> /operation.
// Issuer scans a WORKER's QR   -> offline checks (offline/issuerScan.ts) -> confirm dialog
//   -> "Подтвердить" writes the journal record + updates the local registry (works without internet).
//
// The camera, torch and decoding live in <QrCamera>; this page only decides
// what a decoded text means for the current role.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import { useAuth } from '../../app/providers/AuthProvider';
import { parseToolSticker, type ScannedTool } from '../../entities/operationModel';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { notifyJournalChanged } from '../../offline/events';
import { confirmOperation, DuplicateQrError } from '../../offline/journal';
import { checkWorkerQr, type AcceptedScan } from '../../offline/issuerScan';
import QrCamera from './QrCamera';
import WorkerQrConfirm from './WorkerQrConfirm';

/** How long a "wrong QR" message stays on screen. */
const ERROR_MS = 2500;

export interface ScanPageProps {
  /** Worker: called with a parsed tool sticker. Default: go to /operation. */
  onScanned?: (tool: ScannedTool) => void;
}

function bestEffortVibrate() {
  try {
    navigator.vibrate?.(60);
  } catch {
    /* not supported */
  }
}

export default function ScanPage({ onScanned }: ScanPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isIssuer = user?.role === 'Issuer';

  const [error, setError] = useState<string>();
  const [scan, setScan] = useState<AcceptedScan>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string>();
  const queryClient = useQueryClient();
  const issuerId = user?.id;
  // true while a QR is being checked: frames decoded meanwhile are ignored
  const checking = useRef(false);

  const finishIssuerScan = useCallback(() => setScan(undefined), []);

  const confirm = useCallback(async () => {
    if (!scan || !issuerId) return;
    setBusy(true);
    try {
      await confirmOperation({ userId: issuerId, payload: scan.payload, scannedAt: scan.scannedAt });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview });
      notifyJournalChanged(); // the provider sends it right away when there is a network
      setSaved(`${scan.payload.operation.action === 'TAKE' ? 'Выдано' : 'Принято'}: ${scan.payload.operation.toolName}`);
      setScan(undefined);
    } catch (e) {
      setScan(undefined);
      setError(e instanceof DuplicateQrError ? 'Этот QR уже был принят' : 'Не удалось сохранить запись');
    } finally {
      setBusy(false);
    }
  }, [scan, issuerId, queryClient]);

  // Hide the message after a moment so the hint comes back.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(undefined), ERROR_MS);
    return () => clearTimeout(t);
  }, [error]);

  const handleDetected = useCallback(
    (text: string) => {
      if (isIssuer) {
        if (!issuerId || checking.current) return;
        checking.current = true;
        void checkWorkerQr(text, issuerId)
          .then((outcome) => {
            switch (outcome.kind) {
              case 'foreign':
                setError('Это не QR сотрудника');
                return;
              case 'noKey':
                setError('Нет ключа сервера. Один раз подключитесь к интернету');
                return;
              case 'rejected':
                setError(outcome.message);
                return;
              case 'accepted':
                setError(undefined);
                bestEffortVibrate();
                setScan(outcome);
            }
          })
          .catch(() => setError('Не удалось проверить QR'))
          .finally(() => {
            checking.current = false;
          });
        return;
      }

      const tool = parseToolSticker(text);
      if (!tool) {
        setError('Это не наклейка инструмента');
        return;
      }
      setError(undefined);
      bestEffortVibrate();
      if (onScanned) onScanned(tool);
      else navigate('/operation', { state: { tool } });
    },
    [isIssuer, issuerId, navigate, onScanned],
  );

  return (
    <Box
      sx={{
        // viewport minus the 64px mobile top bar; the Issuer also has the bottom
        // navigation (64px padding in MobileLayout + safe area)
        height: isIssuer ? 'calc(100dvh - 65px - 64px - env(safe-area-inset-bottom))' : 'calc(100dvh - 65px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <QrCamera
        onDetected={handleDetected}
        paused={scan !== undefined}
        error={error}
        hint={isIssuer ? 'Наведите камеру на QR сотрудника' : 'Наведите камеру на наклейку'}
      />

      <WorkerQrConfirm scan={scan} busy={busy} onConfirm={() => void confirm()} onDecline={finishIssuerScan} />
      <Snackbar
        open={saved !== undefined}
        autoHideDuration={3000}
        onClose={() => setSaved(undefined)}
        message={saved}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
}
