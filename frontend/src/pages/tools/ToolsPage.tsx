import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import Box from '@mui/material/Box';
import TablePagination from '@mui/material/TablePagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import StatusBadge from '../../shared/ui/StatusBadge';
import { SearchIcon } from '../../shared/Icons';

import { type ToolRow } from '../../entities/toolsModel';

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import { toolRows } from '../../mock/tools';
import ToolCard from './ToolCard';
import { conditionBadge } from './toolCondition';

/* ----------------------------------- Data ----------------------------------- */

type ToolFilter = 'all' | 'inStock' | 'issued' | 'faulty';

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
  const theme = useTheme();
  // Same breakpoint as AppLayout / TopAppBar: phones get cards instead of a table
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
    <Stack spacing={isMobile ? 2 : 3} sx={{ p: isMobile ? 2 : 3 }}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
        <Tab label="Таблица" />
        <Tab label="Стенд" />
      </Tabs>

      {tab === 0 && (
        <>
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            sx={{ alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap' }}
          >
            <TextField
              type="search"
              label="Название или номер"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              fullWidth={isMobile}
              sx={{ minWidth: isMobile ? 0 : 320 }}
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

            {/* On phones the chips scroll horizontally instead of wrapping */}
            <Stack direction="row" spacing={1} sx={{ overflowX: isMobile ? 'auto' : 'visible', pb: isMobile ? 0.5 : 0 }}>
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

          {isMobile ? (
            <>
              <Stack spacing={1.5}>
                {pageRows.map((row) => (
                  <ToolCard key={row.id} row={row} />
                ))}

                {pageRows.length === 0 && (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Ничего не найдено
                  </Typography>
                )}
              </Stack>

              <Box>
                <TablePagination
                  component="div"
                  count={filteredRows.length}
                  page={page}
                  rowsPerPage={ROWS_PER_PAGE}
                  rowsPerPageOptions={[]}
                  onPageChange={(_, nextPage) => setPage(nextPage)}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
                />
              </Box>
            </>
          ) : (
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
          )}
        </>
      )}
    </Stack>
  );
}