// WorkerOverviewPage.tsx
// "Overview Board / Worker" (Mobile Light): who is signed in, last sync, QR scan button,
// tools currently on hand and a short how-to.
//
// The top app bar ("Account This!" + status badge + profile button) is NOT part of the page:
// the bar comes from the route's `handle.topBar` and the profile button from SimpleLayout.
// Worker has no bottom navigation.
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { QrCodeScannerIcon } from '../../shared/Icons';
import { useAuth } from '../../app/providers/AuthProvider';
import { useProfile } from '../../api';
import { useHeldTools } from '../../api/heldTools';
import { useWorkerCertificate, type CertificateView } from '../../app/providers/WorkerCertificateProvider';
import { formatUnix } from '../../entities/toolsModel';
import HeldToolCard, { type HeldToolCardProps } from './HeldToolCard';

/* ----------------------------------- Data ----------------------------------- */

type HeldTool = HeldToolCardProps['tool'];

const howToSteps = [
  'Отсканируйте QR-наклейку на инструменте.',
  'Создайте QR-код.',
  'Покажите QR-код на экране заведующему.',
];

/* -------------------------------- Certificate -------------------------------- */

/** "18:42", or "22.10.2026 18:42" when it is not today. */
function formatExpiry(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${formatUnix(unixSeconds)}`;
}

function CertificateCard({ view, onRetry }: { view: CertificateView; onRetry: () => void }) {
  switch (view.status) {
    case 'loading':
      return (
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1">Проверка сертификата…</Typography>
        </Card>
      );
    case 'ready':
      return (
        <Card variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1">QR-коды без интернета: можно до {formatExpiry(view.cert.expiresAt)}</Typography>
        </Card>
      );
    case 'missing':
      return (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onRetry}>Повторить</Button>}>
          Нет сертификата. Подключитесь к интернету, чтобы работать без сети.
        </Alert>
      );
    case 'forbidden':
      return <Alert severity="error">Доступ закрыт: {view.message}</Alert>;
    case 'error':
      return (
        <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onRetry}>Повторить</Button>}>
          {view.message}
        </Alert>
      );
  }
}

/* ----------------------------------- Page ----------------------------------- */

export interface WorkerOverviewPageProps {
  /** Overrides the signed-in user's name. */
  workerName?: string;
  /** Tools the worker currently holds. Defaults to the ones this device signed and the worker confirmed. */
  tools?: HeldTool[];
  /** Opens the QR scanner. Defaults to navigating to /scan. */
  onScan?: () => void;
  /** Opens the details of a held tool. */
  onToolClick?: (tool: HeldTool) => void;
}

export default function WorkerOverviewPage({
  workerName,
  tools: toolsProp,
  onScan,
  onToolClick,
}: WorkerOverviewPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // The JWT has no name; useProfile reads it from the worker certificate
  // (same cached query as the profile page).
  const { data: profile } = useProfile();
  const name = workerName ?? user?.fullName ?? profile?.fullName ?? '';

  const { view, ensure } = useWorkerCertificate();
  const held = useHeldTools();
  const tools: HeldTool[] =
    toolsProp ??
    (held.data ?? []).map((t) => ({ id: t.toolId, name: t.toolName, number: `Взят ${formatUnix(t.since)}` }));
  // tapping a held tool = return it: the QR flow starts with "Возвращаю" selected
  const openTool =
    onToolClick ??
    ((tool: HeldTool) => navigate('/operation', { state: { tool: { id: tool.id, name: tool.name }, action: 'GIVE' } }));

  return (
    <Stack spacing={2} sx={{ p: 2.5, pb: 4, width: '100%', maxWidth: 560, mx: 'auto' }}>
      {/* Who is signed in */}
      <Box>
        <Typography variant="caption" component="div">
          Сотрудник
        </Typography>
        {name && (
          <Typography variant="h6" component="h2" sx={{ mt: 1 }}>
            {name}
          </Typography>
        )}
      </Box>

      {/* Offline readiness: the certificate lets the worker make QR codes without internet */}
      <CertificateCard view={view} onRetry={() => void ensure(true)} />

      {/* Main action */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<QrCodeScannerIcon />}
        onClick={onScan ?? (() => navigate('/scan'))}
      >
        Сканировать QR-код
      </Button>

      {/* Tools on hand */}
      <Typography variant="subtitle1" component="h3" sx={{ pt: 1 }}>
        Инструменты на руках
      </Typography>

      {tools.length > 0 ? (
        <Stack spacing={1.5}>
          {tools.map((tool) => (
            <HeldToolCard key={tool.id} tool={tool} onClick={openTool} />
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          У вас нет инструментов на руках
        </Typography>
      )}

      {/* How to take or return a tool */}
      <Stack spacing={1} sx={{ pt: 2 }}>
        <Typography variant="subtitle2" component="h3">
          Как взять или вернуть инструмент
        </Typography>
        {howToSteps.map((step) => (
          <Typography key={step} variant="body2">
            {step}
          </Typography>
        ))}
      </Stack>
    </Stack>
  );
}