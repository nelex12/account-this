import type { ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ReactIcon from '../../assets/react.svg';

interface SummaryCardData {
  id: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  caption?: string;
}

type StatusColor = 'success' | 'error' | 'warning';

interface HistoryRow {
  id: string;
  time: string;
  toolName: string;
  toolNumber: string;
  action: string;
  employee: string;
  condition: { label: string; color: StatusColor };
  sync: { label: string; color: StatusColor };
}

const summaryCards: SummaryCardData[] = [
  {
    id: 'registry',
    icon: ReactIcon,
    label: 'Инструментов в реестре',
    value: 25,
    caption: '8 на руках',
  },
  {
    id: 'broken',
    icon: ReactIcon,
    label: 'Неисправны',
    value: 7,
    caption: '4 повреждены · 3 сломаны',
  },
  {
    id: 'requests',
    icon: ReactIcon,
    label: 'Заявки на доступ',
    value: 3,
    caption: '3 новые',
  },
  {
    id: 'issued',
    icon: ReactIcon,
    label: 'Выдано сегодня',
    value: 8,
  },
  {
    id: 'accepted',
    icon: ReactIcon,
    label: 'Принято сегодня',
    value: 3,
  },
  {
    id: 'waiting',
    icon: ReactIcon,
    label: 'Ожидают',
    value: 8,
  },
];

const ok: HistoryRow['condition'] = { label: 'Исправен', color: 'success' };
const sent: HistoryRow['sync'] = { label: 'Отправлена', color: 'success' };
const notSent: HistoryRow['sync'] = { label: 'Не отправлена', color: 'warning' };

const historyRows: HistoryRow[] = [
  { id: '1', time: '16:42', toolName: 'Перфоратор Bosch GBH 2-26', toolNumber: '№0142', action: 'Возврат', employee: 'Иванов И. И.', condition: ok, sync: notSent },
  { id: '2', time: '16:10', toolName: 'Шуруповёрт Makita DDF485', toolNumber: '№0087', action: 'Выдача', employee: 'Смирнова Е. В.', condition: ok, sync: notSent },
  { id: '3', time: '15:35', toolName: 'Болгарка DeWalt DWE4157', toolNumber: '№0213', action: 'Возврат', employee: 'Кузнецов Д. А.', condition: ok, sync: sent },
  { id: '4', time: '14:58', toolName: 'Дрель Bosch SGB 235', toolNumber: '№0001', action: 'Возврат', employee: 'Орлов М. К.', condition: ok, sync: sent },
  { id: '5', time: '14:20', toolName: 'Лазерный уровень GLL 3-80', toolNumber: '№0310', action: 'Выдача', employee: 'Васильев П. Н.', condition: ok, sync: sent },
  { id: '6', time: '13:47', toolName: 'Рубанок Makita KP0800', toolNumber: '№0054', action: 'Возврат', employee: 'Новиков С. Р.', condition: { label: 'Сломан', color: 'error' }, sync: sent },
];

// Column widths from the design (140 / 400 / 180 / 300 / 200 / 271 px), as % of the table
const columns = [
  { label: 'ВРЕМЯ', width: '9.4%' },
  { label: 'ИНСТРУМЕНТ', width: '26.8%' },
  { label: 'ДЕЙСТВИЕ', width: '12.1%' },
  { label: 'СОТРУДНИК', width: '20.1%' },
  { label: 'СОСТОЯНИЕ', width: '13.4%' },
  { label: 'СИНХРОНИЗАЦИЯ', width: '18.2%' },
];

/* -------------------------------- Components -------------------------------- */

function SummaryCard({ icon, label, value, caption }: Omit<SummaryCardData, 'id'>) {
  return (
    <Card
      variant="outlined"
      sx={{ display: 'flex', alignItems: 'center', gap: '18px', py: 0, pl: '20px', pr: '24px', height: 110 }}
    >
      <Avatar sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>{icon}</Avatar>

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

function StatusChip({ label, color }: { label: string; color: StatusColor }) {
  return <Chip size="small" color={color} variant="outlined" label={label}/>;
}

/* ----------------------------------- Page ----------------------------------- */

/**
 * Owner "Обзор" page body (Penpot: Overview Board → Content Board → Board).
 *
 * Layout:
 *   - 30px padding, 28px vertical gap
 *   - 3 × 2 grid of summary cards (28px gap)
 *   - "История учета" header row (title left, "Все записи" right)
 *   - history table in an outlined, rounded container
 *
 * The top app bar from the same Content Board is NOT included here; render
 * <TopAppBarDesktop /> above this (see AppLayout) with:
 *   title="Обзор", supportingText="Пятница, 2 октября", statusLabel="В сети"
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

      {/* History table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '16px' }}>
        <Table sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              {columns.map((column) => (
                <TableCell key={column.label} sx={{ width: column.width }}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {historyRows.map((row) => (
              <TableRow key={row.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell>
                  <Typography color="text.secondary">{row.time}</Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{fontWeight: '500'}} >{row.toolName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {row.toolNumber}
                  </Typography>
                </TableCell>
                <TableCell>{row.action}</TableCell>
                <TableCell>{row.employee}</TableCell>
                <TableCell>
                  <StatusChip {...row.condition} />
                </TableCell>
                <TableCell>
                  <StatusChip {...row.sync} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}