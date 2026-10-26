// OwnerOverviewPage.tsx
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import StatusBadge from '../../shared/ui/StatusBadge';
import {
  BuildIcon,
  WarningAmberIcon,
  PersonAddIcon,
  OutputIcon,
  InputIcon,
  HourglassEmptyIcon,
} from '../../shared/Icons';
import {
  countFlaggedRecords,
  getNotificationSubject,
  notificationTitles,
  type Notification,
} from '../../entities/notificationsModel';
import { formatUnix } from '../../entities/journalModel';
import {
  useMarkNotificationRead,
  useNotifications,
  useOverview,
  type OverviewHistoryRow,
  type OverviewSummary,
  type SummaryId,
} from '../../api';

/* ----------------------------------- Types ---------------------------------- */

/** Icons stay in the UI layer — the API returns only `id`, `label`, `value`, `caption`. */
const SUMMARY_ICONS: Record<SummaryId, ReactNode> = {
  registry: <BuildIcon />,
  broken:   <WarningAmberIcon />,
  requests: <PersonAddIcon />,
  issued:   <OutputIcon />,
  accepted: <InputIcon />,
  waiting:  <HourglassEmptyIcon />,
};

/* --------------------------------- Columns ---------------------------------- */

const columns: DataTableColumn<OverviewHistoryRow>[] = [
  {
    key: 'time',
    label: 'ВРЕМЯ',
    width: '10%',
    render: (row) => <Typography color="text.secondary">{row.time}</Typography>,
  },
  {
    key: 'tool',
    label: 'ИНСТРУМЕНТ',
    width: '32%',
    render: (row) => <Typography sx={{ fontWeight: 500 }}>{row.toolName}</Typography>,
  },
  { key: 'action',    label: 'ДЕЙСТВИЕ',  width: '14%', render: (row) => row.action },
  { key: 'employee',  label: 'СОТРУДНИК', width: '24%', render: (row) => row.employee },
  {
    key: 'condition',
    label: 'СОСТОЯНИЕ',
    width: '20%',
    render: (row) => <StatusBadge {...row.condition} />,
  },
];

/* -------------------------------- Components -------------------------------- */

function SummaryCard({ id, label, value, caption }: OverviewSummary) {
  return (
    <Card
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: '18px', py: 0, pl: '20px', pr: '24px', height: 110 }}
    >
      <Avatar sx={{ width: 56, height: 56, bgcolor: 'action.hover', color: 'text.secondary' }}>
        {SUMMARY_ICONS[id]}
      </Avatar>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1" color="text.secondary" noWrap>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
          {caption && (
            <Typography variant="body1" color="text.secondary" noWrap>
              {caption}
            </Typography>
          )}
        </Box>
      </Box>
    </Card>
  );
}

interface NotificationItemProps {
  notification: Notification;
  /** This item's "mark as read" request is in flight. */
  isMarking: boolean;
  onMarkRead: (id: number) => void;
}

function NotificationItem({ notification, isMarking, onMarkRead }: NotificationItemProps) {
  const { type, isRead, occurredAt } = notification;
  const flagged = type === 'SuspiciousSync' ? countFlaggedRecords(notification) : 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
      {/* Unread dot; keeps the space for read items so text stays aligned */}
      <Box
        aria-label={isRead ? undefined : 'Не прочитано'}
        sx={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: isRead ? 'transparent' : 'primary.main',
        }}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: isRead ? 400 : 600 }}>
          {notificationTitles[type]}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
          {getNotificationSubject(notification)}
          {flagged > 0 && ` · записей: ${flagged}`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatUnix(occurredAt)}
        </Typography>
      </Box>

      {/* Only unread items have the button; read ones keep the row clean */}
      {!isRead && (
        <Button
          size="small"
          sx={{ flexShrink: 0 }}
          disabled={isMarking}
          onClick={() => onMarkRead(notification.id)}
        >
          Прочитано
        </Button>
      )}
    </Box>
  );
}

/** Loads its own data: a failing notifications request must not break the whole page. */
function NotificationsList() {
  const { data: notifications, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();

  // Card gives the same rounded outlined container as the summary cards
  return (
    <Card variant="outlined">
      {markRead.error && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => markRead.reset()}>
          {markRead.error instanceof Error
            ? markRead.error.message
            : 'Не удалось отметить уведомление прочитанным'}
        </Alert>
      )}
      {isLoading ? (
        <Stack sx={{ alignItems: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : error || !notifications ? (
        <Alert severity="error" sx={{ m: 2 }}>
          {error instanceof Error ? error.message : 'Не удалось загрузить уведомления'}
        </Alert>
      ) : notifications.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Уведомлений нет
        </Typography>
      ) : (
        notifications.map((notification, index) => (
          <Box key={notification.id}>
            {index > 0 && <Divider />}
            <NotificationItem
              notification={notification}
              isMarking={markRead.isPending && markRead.variables === notification.id}
              onMarkRead={markRead.mutate}
            />
          </Box>
        ))
      )}
    </Card>
  );
}

/* ----------------------------------- Page ----------------------------------- */

/**
 * Owner "Обзор" page body.
 *
 * Data comes from `useOverview()` (react-query → `src/api/overview.ts`).
 * No mocks or types live in this file; only the icon map, which is UI concern.
 *
 * Layout:
 *   - 30px padding, 28px vertical gap
 *   - 3 × 2 grid of summary cards (28px gap)
 *   - below: two columns side by side (2fr / 1fr), stacked on narrow screens:
 *       left  — "История учета" header row + history table via shared <DataTable />
 *       right — "Уведомления" list with a "Подробнее" button per item
 *               (GET /api/notifications; "Прочитано" -> POST /api/notifications/{id}/read)
 */
export default function OwnerOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useOverview();

  if (isLoading) {
    return (
      <Stack sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isError || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          Не удалось загрузить обзор
          {error instanceof Error ? `: ${error.message}` : ''}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '28px', p: '30px' }}>
      {/* Summary cards: 3 columns × 2 rows */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '28px',
        }}
      >
        {data.summary.map((card) => (
          <SummaryCard key={card.id} {...card} />
        ))}
      </Box>

      {/* History (left, wider) + notifications (right) */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(0, 1fr)' },
          gap: '28px',
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '28px', minWidth: 0 }}>
          {/* History header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
            <Typography variant="h5" component="h2">
              История учета
            </Typography>
            <Button variant="text" size="large" onClick={() => navigate('/journal')}>
              Все записи
            </Button>
          </Box>

          {/* History table (shared DataTable) */}
          <DataTable
            columns={columns}
            rows={data.history}
            getRowId={(row) => row.id}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '28px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 48 }}>
            <Typography variant="h5" component="h2">
              Уведомления
            </Typography>
          </Box>

          <NotificationsList />
        </Box>
      </Box>
    </Box>
  );
}