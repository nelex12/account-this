// JournalPage.tsx
import { useMemo, useState } from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable.tsx';
import StatusBadge from '../../shared/ui/StatusBadge';

import type {
  JournalAction,
  JournalFilter,
  JournalRow,
} from '../../entities/journalModel.ts';

import { defaultJournalRows } from '../../mock/journal.ts';

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
  {
    key: 'condition',
    label: 'СОСТОЯНИЕ',
    width: '17%',
    render: (row) => <StatusBadge {...row.condition} />,
  },
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

export interface JournalPageProps {
  rows?: JournalRow[];
  onEdit?: (row: JournalRow) => void;
}

export default function JournalPage({
  rows = defaultJournalRows,
  onEdit,
}: JournalPageProps) {
  const [filter, setFilter] = useState<JournalFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        filterPredicates[filter](row) &&
        (!q ||
          row.toolName.toLowerCase().includes(q) ||
          row.toolNumber.toLowerCase().includes(q) ||
          row.employee.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

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
          type="search"
          label="Инструмент или сотрудник"
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

      <Typography variant="body1" color="text.secondary">
        Сводка по проверке · {pluralizeOperations(filteredRows.length)}
      </Typography>

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