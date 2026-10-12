// UsersPage.tsx
import { useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

/* Types */
import type {
  UserRole,
  UserStatus,
  UserRow,
  RoleFilter,
} from '../../entities/usersModel.ts';

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';

/* API */
import { useUsers, useAcceptUser, useDeclineUser } from '../../api';

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
  /** Open the details drawer / page for an application. */
  onDetails?: (row: UserRow) => void;
}

/**
 * "Пользователи" page body (tabs + search + role filters + table).
 *
 * Data and mutations come from `src/api/users.ts` via react-query hooks.
 * `onDetails` remains a prop because opening a drawer is a UI-navigation
 * concern, not a data mutation.
 */
export default function UsersPage({ onDetails }: UsersPageProps) {
  const { data: rows = [], isLoading, isError, error } = useUsers();
  const acceptUser = useAcceptUser();
  const declineUser = useDeclineUser();

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
        onAccept: (row) => acceptUser.mutate(row.id),
        onDecline: (row) => declineUser.mutate(row.id),
        onDetails: (row) => onDetails?.(row),
      }),
    // `acceptUser` / `declineUser` are stable refs from useMutation,
    // but referencing `.mutate` directly would create a new fn each render,
    // so we depend on the mutation objects themselves.
    [acceptUser, declineUser, onDetails],
  );

  if (isError) {
    return (
      <Stack sx={{ p: 3 }}>
        <Typography color="error">
          Не удалось загрузить пользователей
          {error instanceof Error ? `: ${error.message}` : ''}
        </Typography>
      </Stack>
    );
  }

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
      {isLoading ? (
        <Stack sx={{ alignItems: 'center', py: 6 }}>
          <CircularProgress />
        </Stack>
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
    </Stack>
  );
}