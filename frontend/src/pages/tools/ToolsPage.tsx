import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import StatusBadge, { type StatusBadgeColor } from '../../shared/ui/StatusBadge';
import { SearchIcon } from '../../shared/Icons';

import { 
  type ToolCondition, 
  type Tool, 
  type ToolRow
} from '../../entities/toolsModel';

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import { toolRows } from '../../mock/tools';

/* ----------------------------------- Data ----------------------------------- */

type ToolFilter = 'all' | 'inStock' | 'issued' | 'faulty';

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
              type="search"
              label="Название или номер"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              sx={{ minWidth: 320 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
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