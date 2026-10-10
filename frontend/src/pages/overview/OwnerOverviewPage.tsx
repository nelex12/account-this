// OwnerOverviewPage.tsx
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import StatusBadge from '../../shared/ui/StatusBadge';
import type { Condition } from '../../entities/journalModel';
import {
  BuildIcon,
  WarningAmberIcon,
  PersonAddIcon,
  OutputIcon,
  InputIcon,
  HourglassEmptyIcon,
} from '../../shared/Icons';

/* ----------------------------------- Types ---------------------------------- */

interface SummaryCardData {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string | number;
  caption?: string;
}

interface HistoryRow {
  id: string;
  time: string;
  toolName: string;
  toolNumber: string;
  action: string;
  employee: string;
  condition: Condition;
}

/* ----------------------------------- Data ----------------------------------- */

const summaryCards: SummaryCardData[] = [
  { id: 'registry', icon: <BuildIcon />,           label: 'Инструментов в реестре', value: 25, caption: '8 на руках' },
  { id: 'broken',   icon: <WarningAmberIcon />,    label: 'Неисправны',             value: 7,  caption: '4 повреждены · 3 сломаны' },
  { id: 'requests', icon: <PersonAddIcon />,       label: 'Заявки на доступ',       value: 3,  caption: '3 новые' },
  { id: 'issued',   icon: <OutputIcon />,          label: 'Выдано сегодня',         value: 8 },
  { id: 'accepted', icon: <InputIcon />,           label: 'Принято сегодня',        value: 3 },
  { id: 'waiting',  icon: <HourglassEmptyIcon />,  label: 'Ожидают',                value: 8 },
];

const ok: Condition = { label: 'Исправен', color: 'success' };
const broken: Condition = { label: 'Сломан', color: 'error' };

const historyRows: HistoryRow[] = [
  { id: '1', time: '16:42', toolName: 'Перфоратор Bosch GBH 2-26',    toolNumber: '№0142', action: 'Возврат', employee: 'Иванов И. И.',    condition: ok },
  { id: '2', time: '16:10', toolName: 'Шуруповёрт Makita DDF485',     toolNumber: '№0087', action: 'Выдача',  employee: 'Смирнова Е. В.', condition: ok },
  { id: '3', time: '15:35', toolName: 'Болгарка DeWalt DWE4157',      toolNumber: '№0213', action: 'Возврат', employee: 'Кузнецов Д. А.', condition: ok },
  { id: '4', time: '14:58', toolName: 'Дрель Bosch SGB 235',          toolNumber: '№0001', action: 'Возврат', employee: 'Орлов М. К.',    condition: ok },
  { id: '5', time: '14:20', toolName: 'Лазерный уровень GLL 3-80',    toolNumber: '№0310', action: 'Выдача',  employee: 'Васильев П. Н.', condition: ok },
  { id: '6', time: '13:47', toolName: 'Рубанок Makita KP0800',        toolNumber: '№0054', action: 'Возврат', employee: 'Новиков С. Р.',  condition: broken },
];

/* --------------------------------- Columns ---------------------------------- */

const columns: DataTableColumn<HistoryRow>[] = [
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
    render: (row) => (
      <>
        <Typography sx={{ fontWeight: 500 }}>{row.toolName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {row.toolNumber}
        </Typography>
      </>
    ),
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

function SummaryCard({ icon, label, value, caption }: Omit<SummaryCardData, 'id'>) {
  return (
    <Card
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: '18px', py: 0, pl: '20px', pr: '24px', height: 110 }}
    >
      <Avatar sx={{ width: 56, height: 56, bgcolor: 'action.hover', color: 'text.secondary' }}>
        {icon}
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
 * Layout:
 *   - 30px padding, 28px vertical gap
 *   - 3 × 2 grid of summary cards (28px gap)
 *   - "История учета" header row (title left, "Все записи" right)
 *   - history table via shared <DataTable />
 */
export default function OwnerOverviewPage() {
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
        {summaryCards.map(({ id, ...card }) => (
          <SummaryCard key={id} {...card} />
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
        rows={historyRows}
        getRowId={(row) => row.id}
      />
    </Box>
  );
}