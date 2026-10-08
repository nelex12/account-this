// UsersPage.tsx
import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import DataTable, { type DataTableColumn } from '../../components/DataTable';

/* ----------------------------------- Data ----------------------------------- */

type UserRole = 'сотрудник' | 'заведующий' | 'владелец';
type UserStatus = 'ожидает' | 'одобрена' | 'отклонена';

type RoleFilter = 'all' | UserRole;

interface UserRow {
  id: string;
  applicant: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  /** Date the application was submitted */
  requestedAt: string;
}

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

const userRows: UserRow[] = [
  { id: '1',  applicant: 'Иванов И. И.',    phone: '+7 900 123-45-67', role: 'сотрудник',  status: 'ожидает',  requestedAt: '01.10.2026' },
  { id: '2',  applicant: 'Петров П. П.',    phone: '+7 900 234-56-78', role: 'заведующий', status: 'одобрена', requestedAt: '02.10.2026' },
  { id: '3',  applicant: 'Сидоров С. С.',   phone: '+7 900 345-67-89', role: 'владелец',   status: 'отклонена', requestedAt: '02.10.2026' },
  { id: '4',  applicant: 'Кузнецова А. А.', phone: '+7 900 456-78-90', role: 'сотрудник',  status: 'ожидает',  requestedAt: '03.10.2026' },
  { id: '5',  applicant: 'Смирнова Е. В.',  phone: '+7 900 567-89-01', role: 'сотрудник',  status: 'одобрена', requestedAt: '03.10.2026' },
  { id: '6',  applicant: 'Кузнецов Д. А.',  phone: '+7 900 678-90-12', role: 'заведующий', status: 'отклонена', requestedAt: '04.10.2026' },
  { id: '7',  applicant: 'Орлов М. К.',     phone: '+7 900 789-01-23', role: 'сотрудник',  status: 'ожидает',  requestedAt: '05.10.2026' },
  { id: '8',  applicant: 'Васильев П. Н.',  phone: '+7 900 890-12-34', role: 'владелец',   status: 'одобрена', requestedAt: '06.10.2026' },
  { id: '9',  applicant: 'Новиков С. Р.',   phone: '+7 900 901-23-45', role: 'сотрудник',  status: 'отклонена', requestedAt: '06.10.2026' },
  { id: '10', applicant: 'Козлов Т. Е.',    phone: '+7 900 012-34-56', role: 'заведующий', status: 'ожидает',  requestedAt: '07.10.2026' },
];

/* --------------------------------- Callbacks -------------------------------- */

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

/**
 * "Пользователи" page body (tabs + search + role filters + table),
 * built from default MUI components only.
 *
 * Layout:
 *   - Tabs row: Заявки / Пользователи / Уволены
 *   - Filters row: search field + role filter chips
 *   - Users table with per-row actions and pagination
 *
 * The top app bar is NOT included; render it above this component.
 */
export default function UsersPage() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return userRows.filter(
      (row) =>
        filterPredicates[filter](row) &&
        (!q ||
          row.applicant.toLowerCase().includes(q) ||
          row.phone.toLowerCase().includes(q)),
    );
  }, [filter, query]);

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
        onAccept: (row) => {
          // TODO: call API to approve the application
          console.log('accept', row.id);
        },
        onDecline: (row) => {
          // TODO: call API to reject the application
          console.log('decline', row.id);
        },
        onDetails: (row) => {
          // TODO: open a details drawer/dialog
          console.log('details', row.id);
        },
      }),
    [],
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
          label="Поиск по имени или телефону"
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