import { useMemo, useState } from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DataTable, { type DataTableColumn } from '../../components/DataTable';

/* ----------------------------------- Data ----------------------------------- */

type JournalAction = 'issue' | 'return';
type JournalFilter = 'all' | JournalAction;

interface JournalRow {
  id: string;
  time: string;
  action: JournalAction;
  toolName: string;
  toolNumber: string;
  employee: string;
  /** Condition declared by the employee */
  declared: string;
  /** Who accepted the operation ("—" if nobody yet) */
  acceptedBy: string;
}

const actionLabel: Record<JournalAction, string> = {
  issue: 'Выдача',
  return: 'Возврат',
};

const filters: { value: JournalFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'issue', label: 'Выдача' },
  { value: 'return', label: 'Возврат' },
];

const journalRows: JournalRow[] = [
  { id: '1', time: '02.10.2026 16:42', action: 'return', toolName: 'Перфоратор Bosch GBH 2-26', toolNumber: '№0142', employee: 'Иванов И. И.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '2', time: '02.10.2026 16:10', action: 'issue', toolName: 'Шуруповёрт Makita DDF485', toolNumber: '№0087', employee: 'Смирнова Е. В.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '3', time: '02.10.2026 15:35', action: 'return', toolName: 'Болгарка DeWalt DWE4157', toolNumber: '№0213', employee: 'Кузнецов Д. А.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
  { id: '4', time: '02.10.2026 14:58', action: 'return', toolName: 'Дрель Bosch SGB 235', toolNumber: '№0001', employee: 'Орлов М. К.', declared: 'Царапины корпуса', acceptedBy: 'Петров А. С.' },
  { id: '5', time: '02.10.2026 14:20', action: 'issue', toolName: 'Лазерный уровень GLL 3-80', toolNumber: '№0310', employee: 'Васильев П. Н.', declared: 'Исправен', acceptedBy: '—' },
  { id: '6', time: '02.10.2026 13:47', action: 'return', toolName: 'Рубанок Makita KP0800', toolNumber: '№0054', employee: 'Новиков С. Р.', declared: 'Не включается', acceptedBy: 'Петров А. С.' },
  { id: '7', time: '02.10.2026 12:30', action: 'issue', toolName: 'Набор свёрл Bosch, 19 шт.', toolNumber: '№0420', employee: 'Смирнова Е. В.', declared: 'Комплект полный', acceptedBy: 'Петров А. С.' },
  { id: '8', time: '02.10.2026 11:05', action: 'return', toolName: 'Лобзик Bosch PST 700', toolNumber: '№0166', employee: 'Козлов Т. Е.', declared: 'Исправен', acceptedBy: 'Петров А. С.' },
];

// Column widths from the design (190 / 150 / 350 / 190 / 200 / 130 px), as % of the visible columns
const columns: DataTableColumn<JournalRow>[] = [
  {
    key: 'time',
    label: 'ВРЕМЯ ОПЕРАЦИИ',
    width: '16%',
    render: (row) => <Typography color="text.secondary">{row.time}</Typography>,
  },
  {
    key: 'action',
    label: 'ДЕЙСТВИЕ',
    width: '12%',
    render: (row) => actionLabel[row.action],
  },
  {
    key: 'tool',
    label: 'ИНСТРУМЕНТ',
    width: '29%',
    render: (row) => (
      <>
        <Typography>{row.toolName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {row.toolNumber}
        </Typography>
      </>
    ),
  },
  { key: 'employee', label: 'СОТРУДНИК', width: '16%', render: (row) => row.employee },
  { key: 'declared', label: 'ЗАЯВЛЕНО', width: '17%', render: (row) => row.declared },
  { key: 'acceptedBy', label: 'ПРИНЯЛ', width: '10%', render: (row) => row.acceptedBy },
];

const filterPredicates: Record<JournalFilter, (row: JournalRow) => boolean> = {
  all: () => true,
  issue: (row) => row.action === 'issue',
  return: (row) => row.action === 'return',
};

const ROWS_PER_PAGE = 8;

/** "1 операция", "2 операции", "5 операций" */
function pluralizeOperations(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} операция`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} операции`;
  return `${n} операций`;
}

/* ----------------------------------- Page ----------------------------------- */

/**
 * "Журнал" page body (Penpot: Journal Board → Table Board → List 1),
 * built from default MUI components only.
 *
 * Layout (24px vertical gap):
 *   - Filters row: search field + filter chips
 *   - Summary line ("Сводка по проверке · N операций")
 *   - Journal table with pagination
 *
 * The top app bar is NOT included; render <TopAppBarDesktop /> above this with
 *   title="Журнал операций", supportingText="Выдача, возврат и проверка инструмента", statusLabel="В сети",
 *   secondaryAction={{ label: 'Печать/загрузка наклеек' }}, primaryAction={{ label: 'Добавить инструмент' }}
 *
 * Hidden in the design and therefore not implemented: summary cards
 * (Подтверждено / Расхождение / Ожидает проверки), the "Таблица / Стенд" switch,
 * the "Расхождения" filter chip and the "Проверка" / "Местоположение" columns.
 */
export default function JournalPage() {
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return journalRows.filter(
      (row) =>
        filterPredicates[filter](row) &&
        (!q ||
          row.toolName.toLowerCase().includes(q) ||
          row.toolNumber.toLowerCase().includes(q) ||
          row.employee.toLowerCase().includes(q)),
    );
  }, [filter, query]);

  const pageRows = filteredRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleFilterChange = (value: JournalFilter) => {
    setFilter(value);
    setPage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      {/* Filters: search + chips */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label="Инструмент или сотрудник"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          sx={{ minWidth: 320 }}
        />

        <Stack direction="row" spacing={1}>
          {filters.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              clickable
              color={filter === value ? 'primary' : 'default'}
              variant={filter === value ? 'filled' : 'outlined'}
              onClick={() => handleFilterChange(value)}
            />
          ))}
        </Stack>
      </Stack>

      {/* Summary line */}
      <Typography variant="body1" color="text.secondary">
        Сводка по проверке · {pluralizeOperations(filteredRows.length)}
      </Typography>

      {/* Journal table */}
      <DataTable
        columns={columns}
        rows={pageRows}
        getRowId={(row) => row.id}
        pagination={{
          count: filteredRows.length,
          page,
          rowsPerPage: ROWS_PER_PAGE,
          onPageChange: setPage,
        }}
      />
    </Stack>
  );
}