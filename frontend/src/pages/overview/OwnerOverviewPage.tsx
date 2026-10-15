// OwnerOverviewPage.tsx
import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
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
 *   - "История учета" header row (title left, "Все записи" right)
 *   - history table via shared <DataTable />
 */
export default function OwnerOverviewPage() {
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

      {/* History header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" component="h2">
          История учета
        </Typography>
        <Button variant="text" size="large">
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
  );
}