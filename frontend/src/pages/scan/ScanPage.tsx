// ScanPage.tsx — QR scanner for Worker and Issuer (route: /scan).
//
// Worker scans a TOOL sticker  -> parseToolSticker -> /operation.
// Issuer scans a WORKER's QR   -> AT1 format check -> result dialog.
//   (Offline verification of the signatures is the next step: plug it into `onWorkerQr`.)
//
// The camera, torch and decoding live in <QrCamera>; this page only decides
// what a decoded text means for the current role.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useAuth } from '../../app/providers/AuthProvider';
import { parseToolSticker, type ScannedTool } from '../../entities/operationModel';
import QrCamera from './QrCamera';
import { looksLikeWorkerQr } from './workerQr';

/** How long a "wrong QR" message stays on screen. */
const ERROR_MS = 2500;

export interface ScanPageProps {
  /** Worker: called with a parsed tool sticker. Default: go to /operation. */
  onScanned?: (tool: ScannedTool) => void;
  /** Issuer: called with the raw worker QR string. Default: show a placeholder dialog. */
  onWorkerQr?: (qr: string) => void;
}

function bestEffortVibrate() {
  try {
    navigator.vibrate?.(60);
  } catch {
    /* not supported */
  }
}

export default function ScanPage({ onScanned, onWorkerQr }: ScanPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isIssuer = user?.role === 'Issuer';

  const [error, setError] = useState<string>();
  const [workerQr, setWorkerQr] = useState<string>();

  // Hide the message after a moment so the hint comes back.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(undefined), ERROR_MS);
    return () => clearTimeout(t);
  }, [error]);

  const handleDetected = useCallback(
    (text: string) => {
      if (isIssuer) {
        if (!looksLikeWorkerQr(text)) {
          setError('Это не QR сотрудника');
          return;
        }
        setError(undefined);
        bestEffortVibrate();
        if (onWorkerQr) onWorkerQr(text.trim());
        else setWorkerQr(text.trim());
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
    [isIssuer, navigate, onScanned, onWorkerQr],
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
        paused={workerQr !== undefined}
        error={error}
        hint={isIssuer ? 'Наведите камеру на QR сотрудника' : 'Наведите камеру на наклейку'}
      />

      {/* Placeholder until offline verification is wired in via `onWorkerQr` */}
      <Dialog open={workerQr !== undefined} onClose={() => setWorkerQr(undefined)} fullWidth maxWidth="xs">
        <DialogTitle>QR сотрудника считан</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Формат AT1, {workerQr?.length ?? 0} символов. Проверка подписей и выдача инструмента появятся на
            следующем шаге.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWorkerQr(undefined)} autoFocus>
            Сканировать ещё
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
