import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import StatusBadge, { type StatusBadgeColor } from '../../shared/ui/StatusBadge';

/* ----------------------------------- Data ----------------------------------- */

type UserRole = 'worker' | 'issuer' | 'owner';
type RequestStatus = 'pending' | 'approved' | 'rejected';
type RoleFilter = 'all' | UserRole;

interface RequestRow {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
  status: RequestStatus;
  date: string;
}

const roleLabel: Record<UserRole, string> = {
  worker: 'Сотрудник',
  issuer: 'Заведующий',
  owner: 'Владелец',
};

const statusBadge: Record<RequestStatus, { label: string; color: StatusBadgeColor }> = {
  pending: { label: 'Ожидает', color: 'warning' },
  approved: { label: 'Одобрена', color: 'success' },
  rejected: { label: 'Отклонена', color: 'error' },
};

const filters: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'worker', label: roleLabel.worker },
  { value: 'issuer', label: roleLabel.issuer },
  { value: 'owner', label: roleLabel.owner },
];

const requestRows: RequestRow[] = [
  { id: '1', fullName: 'Иванов Алексей Петрович', phone: '+7 (900) 123-45-67', role: 'worker', status: 'pending', date: '29.09.2026' },
  { id: '2', fullName: 'Смирнова Мария Игоревна', phone: '+7 (916) 245-80-31', role: 'issuer', status: 'pending', date: '30.09.2026' },
  { id: '3', fullName: 'Кузнецов Дмитрий Олегович', phone: '+7 (925) 770-14-52', role: 'worker', status: 'pending', date: '01.10.2026' },
  { id: '4', fullName: 'Попов Сергей Андреевич', phone: '+7 (903) 318-92-06', role: 'worker', status: 'approved', date: '27.09.2026' },
  { id: '5', fullName: 'Васильева Елена Сергеевна', phone: '+7 (999) 456-73-18', role: 'issuer', status: 'approved', date: '26.09.2026' },
  { id: '6', fullName: 'Морозов Игорь Николаевич', phone: '+7 (905) 681-27-40', role: 'worker', status: 'rejected', date: '25.09.2026' },
  { id: '7', fullName: 'Новикова Ольга Викторовна', phone: '+7 (911) 502-66-93', role: 'issuer', status: 'approved', date: '24.09.2026' },
  { id: '8', fullName: 'Фёдоров Артём Максимович', phone: '+7 (962) 134-09-85', role: 'issuer', status: 'rejected', date: '22.09.2026' },
];

/** "Иванов Алексей Петрович" → "ИА" (first letters of surname and name) */
function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

// Column widths from the design (400 / 240 / 210 / 200 / 150 / 291 px), as % of the table
const columns: DataTableColumn<RequestRow>[] = [
  {
    key: 'applicant',
    label: 'ЗАЯВИТЕЛЬ',
    width: '27%',
    render: (row) => (
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Avatar>{getInitials(row.fullName)}</Avatar>
        <Typography>{row.fullName}</Typography>
      </Stack>
    ),
  },
  { key: 'phone', label: 'ТЕЛЕФОН', width: '16%', render: (row) => row.phone },
  { key: 'role', label: 'РОЛЬ', width: '14%', render: (row) => roleLabel[row.role] },
  {
    key: 'status',
    label: 'СТАТУС',
    width: '13%',
    render: (row) => <StatusBadge {...statusBadge[row.status]} />,
  },
  {
    key: 'date',
    label: 'ДАТА ЗАЯВКИ',
    width: '10%',
    render: (row) => <Typography color="text.secondary">{row.date}</Typography>,
  },
  {
    key: 'actions',
    label: 'ДЕЙСТВИЯ',
    width: '20%',
    render: (row) =>
      row.status === 'pending' ? (
        <Stack direction="row" spacing={1}>
          <Button>Принять</Button>
          <Button>Отклонить</Button>
        </Stack>
      ) : (
        <Button>Подробнее</Button>
      ),
  },
];

const ROWS_PER_PAGE = 8;

/* ----------------------------------- Page ----------------------------------- */

/**
 * "Пользователи" page body (Penpot: Users Board → Content Board → Body),
 * built from default MUI components only.
 *
 * Layout (24px vertical gap):
 *   - Tabs: Заявки / Сотрудники / Уволены
 *   - Toolbar: search field + role filter chips
 *   - Requests table with pagination
 *
 * The top app bar is NOT included; render <TopAppBarDesktop /> above this with
 *   title="Пользователи", supportingText="48 сотрудников · 3 новые заявки"
 * (no status chip and no action buttons in the design).
 *
 * Only the "Заявки" tab is designed, so the other two tabs are empty for now.
 */
export default function UsersPage() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requestRows.filter(
      (row) =>
        (filter === 'all' || row.role === filter) &&
        (!q || row.fullName.toLowerCase().includes(q) || row.phone.includes(q)),
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

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)}>
        <Tab label="Заявки" />
        <Tab label="Сотрудники" />
        <Tab label="Уволены" />
      </Tabs>

      {tab === 0 && (
        <>
          {/* Toolbar: search + role chips */}
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

          {/* Requests table */}
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