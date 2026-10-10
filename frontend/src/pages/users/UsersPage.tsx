// UsersPage.tsx
import { useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

/* Types */
import { 
  type UserRole,
  type UserStatus,
  type UserRow,
  type RoleFilter,
} from '../../entities/usersModel.ts'

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';

import { defaultUserRows } from '../../mock/users.ts'

/* ----------------------------------- Data ----------------------------------- */

const tabs = ['Заявки', 'Пользователи', 'Уволены'] as const;

const filters: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'сотрудник', label: 'Сотрудник' },
  { value: 'заведующий', label: 'Заведующий' },
  { value: 'владелец', label: 'Владелец' },
];

const roleLabel: Record<UserRole, string> = {
  сотрудник: 'Сотрудник',
  заведующий: 'Заведующий',
  владелец: 'Владелец',
};

const statusLabel: Record<UserStatus, string> = {
  ожидает: 'Ожидает',
  одобрена: 'Одобрена',
  отклонена: 'Отклонена',
};

/* --------------------------------- Columns ---------------------------------- */

interface RowActions {
  onAccept: (row: UserRow) => void;
  onDecline: (row: UserRow) => void;
  onDetails: (row: UserRow) => void;
}

// Column widths from the design (Заявитель / Телефон / Роль / Статус / Дата заявки / Действия),
// as % of the visible columns
const buildColumns = (actions: RowActions): DataTableColumn<UserRow>[] => [
  { key: 'applicant', label: 'ЗАЯВИТЕЛЬ',   width: '20%', render: (row) => row.applicant },
  { key: 'phone',     label: 'ТЕЛЕФОН',     width: '16%', render: (row) => row.phone },
  { key: 'role',      label: 'РОЛЬ',        width: '14%', render: (row) => roleLabel[row.role] },
  { key: 'status',    label: 'СТАТУС',      width: '13%', render: (row) => statusLabel[row.status] },
  { key: 'requested', label: 'ДАТА ЗАЯВКИ', width: '13%', render: (row) => row.requestedAt },
  {
    key: 'actions',
    label: 'ДЕЙСТВИЯ',
    width: '24%',
    render: (row) => (
      <Stack direction="row" spacing={1}>
        {row.status === 'ожидает' && (
          <>
            <Button size="small" onClick={() => actions.onAccept(row)}>
              Принять
            </Button>
            <Button size="small" color="error" onClick={() => actions.onDecline(row)}>
              Отклонить
            </Button>
          </>
        )}
        <Button size="small" onClick={() => actions.onDetails(row)}>
          Подробнее
        </Button>
      </Stack>
    ),
  },
];

const filterPredicates: Record<RoleFilter, (row: UserRow) => boolean> = {
  all: () => true,
  сотрудник: (row) => row.role === 'сотрудник',
  заведующий: (row) => row.role === 'заведующий',
  владелец: (row) => row.role === 'владелец',
};

const ROWS_PER_PAGE = 8;

/* ----------------------------------- Page ----------------------------------- */

export interface UsersPageProps {
  /** Applications to display. Defaults to the built-in mock data. */
  rows?: UserRow[];
  /** Approve an application. */
  onAccept?: (row: UserRow) => void;
  /** Reject an application. */
  onDecline?: (row: UserRow) => void;
  /** Open the details drawer / page for an application. */
  onDetails?: (row: UserRow) => void;
}

/**
 * "Пользователи" page body (tabs + search + role filters + table),
 * built from default MUI components only.
 *
 * Data and row actions come in via props; sensible no-op defaults keep the page
 * working standalone while you're still wiring up a data source.
 *
 * Layout:
 *   - Tabs row: Заявки / Пользователи / Уволены
 *   - Filters row: search field + role filter chips
 *   - Users table with per-row actions and pagination
 *
 * The top app bar is NOT included; render it above this component.
 */
export default function UsersPage({
  rows = defaultUserRows,
  onAccept,
  onDecline,
  onDetails,
}: UsersPageProps) {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) =>
        filterPredicates[filter](row) &&
        (!q ||
          row.applicant.toLowerCase().includes(q) ||
          row.phone.toLowerCase().includes(q)),
    );
  }, [rows, filter, query]);

  const pageRows = filteredRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleFilterChange = (value: RoleFilter) => {
    setFilter(value);
    setPage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  const columns = useMemo(
    () =>
      buildColumns({
        onAccept: (row) => onAccept?.(row),
        onDecline: (row) => onDecline?.(row),
        onDetails: (row) => onDetails?.(row),
      }),
    [onAccept, onDecline, onDetails],
  );

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, value: number) => setTab(value)}
        variant="standard"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((label) => (
          <Tab key={label} label={label} />
        ))}
      </Tabs>

      {/* Filters: search + chips */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          type="search"
          label="Поиск по имени или телефону"
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

      {/* Users table */}
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