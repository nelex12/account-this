// JournalPage.tsx
import { useMemo, useState } from 'react';
import { useJournal } from '../../api';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import TablePagination from '@mui/material/TablePagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable.tsx';
import StatusBadge from '../../shared/ui/StatusBadge';

import type {
  JournalAction,
  JournalFilter,
  JournalRow,
} from '../../entities/journalModel.ts';

import CircularProgress from '@mui/material/CircularProgress';
import JournalCard from './JournalCard';

/* ----------------------------------- Data ----------------------------------- */

const actionLabel: Record<JournalAction, string> = {
  issue: 'Выдача',
  return: 'Возврат',
};

const filters: { value: JournalFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'issue', label: 'Выдача' },
  { value: 'return', label: 'Возврат' },
];

/* --------------------------------- Columns ---------------------------------- */

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
    render: (row) => <Typography>{row.toolName}</Typography>,
  },
  { key: 'employee', label: 'СОТРУДНИК', width: '16%', render: (row) => row.employee },
  {
    key: 'condition',
    label: 'СОСТОЯНИЕ',
    width: '17%',
    render: (row) => <StatusBadge {...row.condition} />,
  },
  {
    key: 'validation',
    label: 'ПРОВЕРКА',
    width: '10%',
    render: (row) => <StatusBadge label={row.validation.label} color={row.validation.color} />,
  },
];

const ROWS_PER_PAGE = 8;

export interface JournalPageProps {
  onEdit?: (row: JournalRow) => void;
}

export default function JournalPage({ onEdit }: JournalPageProps) {
  const theme = useTheme();
  // Same breakpoint as AppLayout / TopAppBar: phones get cards instead of a table
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [filter, setFilter] = useState<JournalFilter>('all');
  // The action filter goes to the server (GET /api/logs?action=...)
  const { data: rows = [], isLoading, isError, error } = useJournal(filter);

  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        !q ||
        row.toolName.toLowerCase().includes(q) ||
        row.employee.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const pageRows = filteredRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleFilterChange = (value: JournalFilter) => {
    setFilter(value);
    setPage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  if (isError) {
    return (
      <Stack sx={{ p: isMobile ? 2 : 3 }}>
        <Alert severity="error">
          Не удалось загрузить журнал{error instanceof Error ? `: ${error.message}` : ''}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={isMobile ? 2 : 3} sx={{ p: isMobile ? 2 : 3 }}>
      {/* Filters: search + chips */}
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={2}
        sx={{ alignItems: isMobile ? 'stretch' : 'center', flexWrap: 'wrap' }}
      >
        <TextField
          type="search"
          label="Инструмент или сотрудник"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
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

      <Typography variant="body1" color="text.secondary">
        Сводка по проверке · {(filteredRows.length)}
      </Typography>

      {isLoading ? (
        <Stack sx={{ alignItems: 'center', py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : isMobile ? (
        <>
          <Stack spacing={1.5}>
            {pageRows.map((row) => (
              <JournalCard key={row.id} row={row} />
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
          getRowId={(row) => String(row.id)}
          pagination={{
            count: filteredRows.length,
            page,
            rowsPerPage: ROWS_PER_PAGE,
            onPageChange: setPage,
          }}
        />
      )}
    </Stack>
  );
}