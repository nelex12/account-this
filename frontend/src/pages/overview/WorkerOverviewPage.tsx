// WorkerOverviewPage.tsx
// "Overview Board / Worker" (Mobile Light): who is signed in, last sync, QR scan button,
// tools currently on hand and a short how-to.
//
// The top app bar ("Account This!" + status badge + profile button) is NOT part of the page:
// the bar comes from the route's `handle.topBar` and the profile button from SimpleLayout.
// Worker has no bottom navigation.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { QrCodeScannerIcon } from '../../shared/Icons';
import { useAuth } from '../../app/providers/AuthProvider';
import { useProfile } from '../../api';
import HeldToolCard, { type HeldToolCardProps } from './HeldToolCard';

/* ----------------------------------- Data ----------------------------------- */

type HeldTool = HeldToolCardProps['tool'];

/** Placeholder until there is an API for "tools on hand of the current worker". */
const defaultTools: HeldTool[] = [{ id: '2', name: 'Перфоратор Bosch GBH 2-26', number: '№ 0142' }];

const howToSteps = [
  'Отсканируйте QR-наклейку на инструменте.',
  'Создайте QR-код.',
  'Покажите QR-код на экране заведующему.',
];

/* ----------------------------------- Page ----------------------------------- */

export interface WorkerOverviewPageProps {
  /** Overrides the signed-in user's name. */
  workerName?: string;
  /** Text of the sync card, e.g. "Последняя синхронизация была 2 часа назад". */
  lastSyncText?: string;
  /** Tools the worker currently holds. Defaults to the built-in placeholder. */
  tools?: HeldTool[];
  /** Opens the QR scanner. */
  onScan?: () => void;
  /** Opens the details of a held tool. */
  onToolClick?: (tool: HeldTool) => void;
}

export default function WorkerOverviewPage({
  workerName,
  lastSyncText = 'Последняя синхронизация была 2 часа назад',
  tools = defaultTools,
  onScan,
  onToolClick,
}: WorkerOverviewPageProps) {
  const { user } = useAuth();
  // The JWT has no name; useProfile reads it from the worker certificate
  // (same cached query as the profile page).
  const { data: profile } = useProfile();
  const name = workerName ?? user?.fullName ?? profile?.fullName ?? '';

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

      {/* Sync state */}
      <Card variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1">{lastSyncText}</Typography>
      </Card>

      {/* Main action */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<QrCodeScannerIcon />}
        onClick={onScan}
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
            <HeldToolCard key={tool.id} tool={tool} onClick={onToolClick} />
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