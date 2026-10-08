import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DataTable, { type DataTableColumn } from '../../components/DataTable';
import StatusBadge, { type StatusBadgeColor } from '../../components/StatusBadge';

/* ----------------------------------- Data ----------------------------------- */

type ToolCondition = 'ok' | 'broken' | 'inspection' | 'damaged';
type ToolFilter = 'all' | 'inStock' | 'issued' | 'faulty';

interface ToolRow {
  id: string;
  name: string;
  number: string;
  category: string;
  condition: ToolCondition;
  location: string;
  updated: string;
  /** true when the tool is currently with an employee */
  issued: boolean;
}

const conditionBadge: Record<ToolCondition, { label: string; color: StatusBadgeColor }> = {
  ok: { label: 'Исправен', color: 'success' },
  broken: { label: 'Сломан', color: 'error' },
  inspection: { label: 'На проверке', color: 'warning' },
  damaged: { label: 'Поврежден', color: 'error' },
};

const filters: { value: ToolFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'inStock', label: 'На месте' },
  { value: 'issued', label: 'На руках' },
  { value: 'faulty', label: 'Неисправные' },
];

const toolRows: ToolRow[] = [
  { id: '1', name: 'Дрель Bosch SGB 235', number: '№0001', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж A1', updated: '02.10.2026', issued: false },
  { id: '2', name: 'Перфоратор Bosch GBH 2-26', number: '№0142', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж A2', updated: '02.10.2026', issued: false },
  { id: '3', name: 'Шуруповёрт Makita DDF485', number: '№0087', category: 'Аккумуляторный', condition: 'ok', location: 'На руках · Смирнова Е. В.', updated: '02.10.2026', issued: true },
  { id: '4', name: 'Болгарка DeWalt DWE4157', number: '№0213', category: 'Электроинструмент', condition: 'ok', location: 'На месте · Стеллаж B3', updated: '02.10.2026', issued: false },
  { id: '5', name: 'Лазерный уровень GLL 3-80', number: '№0310', category: 'Измерительный', condition: 'ok', location: 'На руках · Васильев П. Н.', updated: '02.10.2026', issued: true },
  { id: '6', name: 'Рубанок Makita KP0800', number: '№0054', category: 'Электроинструмент', condition: 'broken', location: 'На месте · Зона ремонта', updated: '02.10.2026', issued: false },
  { id: '7', name: 'Набор свёрл Bosch, 19 шт.', number: '№0420', category: 'Оснастка', condition: 'inspection', location: 'На руках · Смирнова Е. В.', updated: '02.10.2026', issued: true },
  { id: '8', name: 'Лобзик Bosch PST 700', number: '№0166', category: 'Электроинструмент', condition: 'damaged', location: 'На месте · Стеллаж B1', updated: '02.10.2026', issued: false },
];

const columns: DataTableColumn<ToolRow>[] = [
  {
    key: 'tool',
    label: 'ИНСТРУМЕНТ',
    width: '23%',
    render: (row) => (
      <>
        <Typography>{row.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {row.number}
        </Typography>
      </>
    ),
  },
  { key: 'category', label: 'КАТЕГОРИЯ', width: '15%', render: (row) => row.category },
  {
    key: 'condition',
    label: 'СОСТОЯНИЕ',
    width: '14%',
    render: (row) => <StatusBadge {...conditionBadge[row.condition]} />,
  },
  { key: 'location', label: 'МЕСТОПОЛОЖЕНИЕ', width: '22%', render: (row) => row.location },
  {
    key: 'updated',
    label: 'ОБНОВЛЕНО',
    width: '12%',
    render: (row) => <Typography color="text.secondary">{row.updated}</Typography>,
  },
  {
    key: 'actions',
    label: 'ДЕЙСТВИЯ',
    width: '14%',
    render: () => <Button>Подробнее</Button>,
  },
];

const filterPredicates: Record<ToolFilter, (row: ToolRow) => boolean> = {
  all: () => true,
  inStock: (row) => !row.issued,
  issued: (row) => row.issued,
  faulty: (row) => row.condition !== 'ok',
};

const ROWS_PER_PAGE = 8;

/* ----------------------------------- Page ----------------------------------- */

/**
 * Owner "Инструменты" page body (Penpot: Tools Board → Table Board → List 1),
 * built from default MUI components only.
 *
 * The top app bar is NOT included; render <TopAppBarDesktop /> above this with
 *   title="Инструменты", supportingText="24 инструмента в хранилище, 8 на руках", statusLabel="В сети",
 *   secondaryAction={{ label: 'Печать/загрузка наклеек' }}, primaryAction={{ label: 'Добавить инструмент' }}
 */
export default function ToolsPage() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<ToolFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return toolRows.filter(
      (row) =>
        filterPredicates[filter](row) &&
        (!q || row.name.toLowerCase().includes(q) || row.number.toLowerCase().includes(q)),
    );
  }, [filter, query]);

  const pageRows = filteredRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleFilterChange = (value: ToolFilter) => {
    setFilter(value);
    setPage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
        <Tab label="Таблица" />
        <Tab label="Стенд" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="Название или номер"
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
        </>
      )}
    </Stack>
  );
}