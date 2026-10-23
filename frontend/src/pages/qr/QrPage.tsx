// QrPage.tsx — "Показать QR завхозу" (Worker). Route: /qr
//
// Signs the chosen operation with the temporary key and shows the AT1 QR code. Works with no internet:
// the certificate and the key are already on the device (see WorkerCertificateProvider).
//
// The QR is valid for a short time (the Issuer rejects timestamps more than 60 s off), so the screen
// counts down and then asks for a new one. It never regenerates by itself: two different valid QR codes
// for one handover could both be accepted. The operation is remembered ("tools on hand") only after the
// Worker taps "Завхоз принял".
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { heldToolsKey } from '../../api/heldTools';
import { useAuth } from '../../app/providers/AuthProvider';
import { useWorkerCertificate } from '../../app/providers/WorkerCertificateProvider';
import type { ApiToolCondition, OperationChoice, RentalAction } from '../../entities/operationModel';
import type { RentalOperation } from '../../offline/at1';
import { getServerNowSec, loadClockOffset } from '../../offline/meta';
import { recordOwnOperation } from '../../offline/operations';
import { qrSecondsLeft } from '../../offline/qrValidity';
import { serverNowSec, type ClockOffset } from '../../offline/serverTime';
import { createOperationQr } from '../../offline/workerSigner';
import { RefreshIcon } from '../../shared/Icons';
import QrCodeView from '../../shared/ui/QrCodeView';
import { useWakeLock } from '../../shared/useWakeLock';

const ACTION_LABEL: Record<RentalAction, string> = { TAKE: 'Беру', GIVE: 'Возвращаю' };
const CONDITION_LABEL: Record<ApiToolCondition, string> = {
  Good: 'Исправен',
  Damaged: 'Поврежден',
  Broken: 'Сломан',
};
const WARN_WHEN_LEFT_SEC = 15;

type Unavailable =
  | { reason: 'missing' }
  | { reason: 'forbidden'; message: string }
  | { reason: 'error'; message: string };

type View =
  | { kind: 'creating' }
  | { kind: 'unavailable'; problem: Unavailable }
  | {
      kind: 'shown';
      qr: string;
      workerSignature: string;
      operation: RentalOperation;
      offset: ClockOffset | null;
    };

function unavailableText(p: Unavailable): string {
  switch (p.reason) {
    case 'missing':
      return 'Нет сертификата для работы без интернета. Подключитесь к сети и повторите.';
    case 'forbidden':
      return `Доступ закрыт: ${p.message}`;
    case 'error':
      return p.message;
  }
}

export interface QrPageProps {
  /** Overrides the choice from router state (stories, tests). */
  choice?: OperationChoice;
}

export default function QrPage({ choice: choiceProp }: QrPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { ensure } = useWorkerCertificate();
  const choice = choiceProp ?? (location.state as { choice?: OperationChoice } | null)?.choice;

  const [view, setView] = useState<View>({ kind: 'creating' });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const request = useRef(0);

  const create = useCallback(async () => {
    if (!choice) return;
    const mine = ++request.current; // only the latest request may change the screen (StrictMode runs effects twice)
    setView({ kind: 'creating' });
    try {
      const cert = await ensure();
      if (mine !== request.current) return;
      if (cert.status !== 'ready') {
        const problem: Unavailable =
          cert.status === 'forbidden'
            ? { reason: 'forbidden', message: cert.message }
            : cert.status === 'error'
              ? { reason: 'error', message: cert.message }
              : { reason: 'missing' };
        setView({ kind: 'unavailable', problem });
        return;
      }
      const timestamp = await getServerNowSec();
      const signed = await createOperationQr(
        cert.cert,
        {
          action: choice.action,
          toolCondition: choice.toolCondition,
          toolId: choice.tool.id,
          toolName: choice.tool.name,
        },
        timestamp,
      );
      const offset = await loadClockOffset();
      if (mine !== request.current) return;
      setSecondsLeft(qrSecondsLeft(signed.operation.timestamp, serverNowSec(offset)));
      setView({ kind: 'shown', ...signed, offset });
    } catch {
      if (mine === request.current) {
        setView({ kind: 'unavailable', problem: { reason: 'error', message: 'Не удалось создать QR-код' } });
      }
    }
  }, [choice, ensure]);

  useEffect(() => {
    const counter = request;
    void create();
    return () => {
      counter.current++; // leaving the page cancels a request in flight
    };
  }, [create]);

  // countdown, in server time
  useEffect(() => {
    if (view.kind !== 'shown') return;
    const tick = () => setSecondsLeft(qrSecondsLeft(view.operation.timestamp, serverNowSec(view.offset)));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [view]);

  const stale = view.kind === 'shown' && secondsLeft <= 0;
  useWakeLock(view.kind === 'shown' && !stale);

  // Opened directly (reload / deep link): nothing to sign, start over.
  if (!choice) return <Navigate to="/scan" replace />;

  const accept = async () => {
    if (view.kind !== 'shown' || !user) return;
    await recordOwnOperation({
      workerSignature: view.workerSignature,
      userId: user.id,
      qr: view.qr,
      toolId: view.operation.toolId,
      toolName: view.operation.toolName,
      action: view.operation.action,
      toolCondition: view.operation.toolCondition,
      timestamp: view.operation.timestamp,
      createdAt: Date.now(),
    });
    await queryClient.invalidateQueries({ queryKey: heldToolsKey(user.id) });
    navigate('/overview', { replace: true });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 65px)',
        p: 2.5,
        pb: 3,
        width: '100%',
        maxWidth: 560,
        mx: 'auto',
      }}
    >
      <Stack spacing={2.5} sx={{ flexGrow: 1 }}>
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ wordBreak: 'break-word' }}>
            {choice.tool.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ACTION_LABEL[choice.action]} · {CONDITION_LABEL[choice.toolCondition]}
          </Typography>
        </Card>

        {view.kind === 'creating' && (
          <Stack sx={{ alignItems: 'center', py: 6 }}>
            <CircularProgress aria-label="Создание QR-кода" />
          </Stack>
        )}

        {view.kind === 'unavailable' && <Alert severity="warning">{unavailableText(view.problem)}</Alert>}

        {view.kind === 'shown' && (
          <>
            <Typography variant="body1" align="center">
              Покажите QR-код завхозу. Яркость экрана лучше увеличить.
            </Typography>

            <Box sx={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
              <Box sx={{ opacity: stale ? 0.12 : 1, transition: 'opacity .2s' }}>
                <QrCodeView value={view.qr} label="QR-код операции для завхоза" />
              </Box>
              {stale && (
                <Box
                  role="status"
                  sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Typography variant="h6" sx={{ color: '#000' }}>
                    QR-код устарел
                  </Typography>
                </Box>
              )}
            </Box>

            <Typography
              variant="subtitle1"
              align="center"
              role="timer"
              color={stale || secondsLeft <= WARN_WHEN_LEFT_SEC ? 'error' : 'text.secondary'}
            >
              {stale ? 'Создайте новый QR-код' : `Действителен ещё ${secondsLeft} с`}
            </Typography>
          </>
        )}
      </Stack>

      <Stack spacing={1.5} sx={{ mt: 3 }}>
        {view.kind === 'shown' && !stale && (
          <Button variant="contained" size="large" fullWidth onClick={() => void accept()}>
            Завхоз принял
          </Button>
        )}
        {(stale || view.kind === 'unavailable') && (
          <Button variant="contained" size="large" fullWidth startIcon={<RefreshIcon />} onClick={() => void create()}>
            {stale ? 'Создать заново' : 'Повторить'}
          </Button>
        )}
        <Button size="large" fullWidth onClick={() => navigate('/overview', { replace: true })}>
          Отмена
        </Button>
      </Stack>
    </Box>
  );
}
