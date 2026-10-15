// IssuerOverviewPage.tsx — "Overview Board / Issuer" (Mobile Light).
// Date, sync status (+ "send now"), today's counters, history of accounting with the
// sync state of each record, floating "Сканировать QR" button.
//
// Top bar ("Обзор" + "В сети") comes from the route's `handle.topBar`; the bottom
// navigation comes from MobileLayout. Data: useIssuerOverview() (src/api/issuerOverview.ts).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowForwardIcon, QrCodeScannerIcon, RefreshIcon } from '../../shared/Icons';
import StatusBadge, { type StatusBadgeColor } from '../../shared/ui/StatusBadge';
import {
  conditionFromApi,
  formatUnix,
  validationLabels,
} from '../../entities/journalModel';
import {
  useIssuerOverview,
  useSyncNow,
  type IssuerHistoryItem,
  type IssuerSyncState,
} from '../../api';

/* --------------------------------- Helpers ---------------------------------- */

/** Tracks navigator.onLine. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** "Вторник, 29 сентября" */
function todayTitle(): string {
  const text = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const formatted = text.replace(/^(\S+)\s/, '$1, ');
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** "2 часа назад", "только что" */
function relativeTime(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return 'только что';
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'always' });
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return rtf.format(-Math.floor(diff / 86400), 'day');
}

function timeOfDay(unixSeconds: number): string {
  return formatUnix(unixSeconds).split(' ')[1] ?? '';
}

function syncBadge(sync: IssuerSyncState): { label: string; color: StatusBadgeColor } {
  if (sync === 'pending') return { label: 'Не отправлена', color: 'warning' };
  if (sync === 'VALID') return { label: 'Отправлена', color: 'success' };
  return validationLabels[sync]; // the server flagged the record
}

/* -------------------------------- Components -------------------------------- */

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
      <Typography variant="h5" component="div">
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Card>
  );
}

function HistoryRow({ item }: { item: IssuerHistoryItem }) {
  const badge = syncBadge(item.sync);
  const condition = conditionFromApi[item.toolCondition].label.toLowerCase();
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 1.5, alignItems: 'flex-start' }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 44, flexShrink: 0, pt: 0.25 }}>
        {timeOfDay(item.time)}
      </Typography>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
          {item.toolName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
          {item.action === 'TAKE' ? 'Выдача' : 'Возврат'} · {item.workerName} · {condition}
        </Typography>
        <StatusBadge {...badge} />
      </Box>
    </Box>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export interface IssuerOverviewPageProps {
  /** Opens the QR scanner. Defaults to navigating to /scan. */
  onScan?: () => void;
}

export default function IssuerOverviewPage({ onScan }: IssuerOverviewPageProps) {
  const navigate = useNavigate();
  const online = useOnline();
  const { data, isLoading, isError, error } = useIssuerOverview();
  const sync = useSyncNow();

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isError || !data) {
    return (
      <Box sx={{ p: 2.5 }}>
        <Alert severity="error">
          Не удалось загрузить обзор{error instanceof Error ? `: ${error.message}` : ''}
        </Alert>
      </Box>
    );
  }

  const { lastSyncAt, pendingCount, issuedToday, acceptedToday, history } = data;
  const syncTitle = lastSyncAt
    ? `Последняя синхронизация ${relativeTime(lastSyncAt)}`
    : 'Синхронизации ещё не было';

  return (
    <Stack
      spacing={2.5}
      sx={{ p: 2.5, pb: 12, width: '100%', maxWidth: 720, mx: 'auto' }}
    >
      <Typography variant="h6" component="h2">
        {todayTitle()}
      </Typography>

      {/* Sync status */}
      <Card variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1">{syncTitle}</Typography>

          {pendingCount > 0 ? (
            <Typography variant="body2" color="text.secondary">
              Не отправлено на сервер: {pendingCount}. Данные хранятся на этом устройстве.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Все записи отправлены на сервер.
            </Typography>
          )}

          {!online && (
            <Alert severity="warning" sx={{ alignItems: 'center' }}>
              Нет сети. Сканируйте как обычно — записи отправятся позже.
            </Alert>
          )}
          {sync.isError && (
            <Alert severity="error">Не удалось синхронизировать. Попробуйте ещё раз.</Alert>
          )}

          {pendingCount > 0 && (
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={sync.isPending ? <CircularProgress size={18} /> : <RefreshIcon />}
              disabled={!online || sync.isPending}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? 'Отправка…' : 'Отправить сейчас'}
            </Button>
          )}
        </Stack>
      </Card>

      {/* Today's counters */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1.5, sm: 2 } }}>
        <StatCard value={issuedToday} label="Выдано сегодня" />
        <StatCard value={acceptedToday} label="Принято сегодня" />
        <StatCard value={pendingCount} label="Ожидают" />
      </Box>

      {/* History */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1 }}>
        <Typography variant="subtitle1" component="h3">
          История учета
        </Typography>
        <Button variant="text" endIcon={<ArrowForwardIcon />} onClick={() => navigate('/journal')}>
          Все записи
        </Button>
      </Box>

      {history.length > 0 ? (
        <Box>
          {history.map((item, index) => (
            <Box key={item.id}>
              {index > 0 && <Divider />}
              <HistoryRow item={item} />
            </Box>
          ))}
        </Box>
      ) : (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Сегодня операций ещё не было
        </Typography>
      )}

      {/* Floating scan button, above the bottom navigation */}
      <Fab
        variant="extended"
        color="primary"
        onClick={onScan ?? (() => navigate('/scan'))}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          zIndex: (theme) => theme.zIndex.appBar - 1,
        }}
      >
        <QrCodeScannerIcon sx={{ mr: 1 }} />
        Сканировать QR
      </Fab>
    </Stack>
  );
}