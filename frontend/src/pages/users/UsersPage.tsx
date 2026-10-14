// UsersPage.tsx
import { useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';

import {
  formatPhone,
  type RoleFilter,
  type UserRole,
  type UserRow,
  type UserStatus,
} from '../../entities/usersModel.ts';

import DataTable, { type DataTableColumn } from '../../shared/ui/DataTable';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  useApproveUser,
  useDeactivateUser,
  useMyCompany,
  useUsers,
} from '../../api';

/* ----------------------------------- Data ----------------------------------- */

/** Tab order = index of `tab` state. */
const tabs: { label: string; status: UserStatus }[] = [
  { label: 'Заявки', status: 'pending' },
  { label: 'Пользователи', status: 'active' },
  { label: 'Уволены', status: 'fired' },
];

const filters: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'Worker', label: 'Сотрудник' },
  { value: 'Issuer', label: 'Завхоз' },
  { value: 'Owner', label: 'Владелец' },
];

const roleLabel: Record<UserRole, string> = {
  Worker: 'Сотрудник',
  Issuer: 'Завхоз',
  Owner: 'Владелец',
};

const statusLabel: Record<UserStatus, string> = {
  pending: 'Ожидает',
  active: 'Активен',
  fired: 'Уволен',
};

const ROWS_PER_PAGE = 8;

/* --------------------------------- Columns ---------------------------------- */

interface RowActions {
  /** id of the signed-in Owner: the server forbids firing yourself (409) */
  currentUserId?: string;
  busyId?: string;
  onApprove: (row: UserRow) => void;
  /** Rejecting an application and firing both deactivate the user. */
  onDeactivate: (row: UserRow) => void;
  onDetails?: (row: UserRow) => void;
}

const buildColumns = (a: RowActions): DataTableColumn<UserRow>[] => [
  { key: 'fullName', label: 'ФИО',     width: '28%', render: (row) => row.fullName },
  { key: 'phone',    label: 'ТЕЛЕФОН', width: '18%', render: (row) => formatPhone(row.phone) },
  { key: 'role',     label: 'РОЛЬ',    width: '15%', render: (row) => roleLabel[row.role] },
  { key: 'status',   label: 'СТАТУС',  width: '13%', render: (row) => statusLabel[row.status] },
  {
    key: 'actions',
    label: 'ДЕЙСТВИЯ',
    width: '26%',
    render: (row) => {
      const busy = a.busyId === row.id;
      const isSelf = row.id === a.currentUserId;
      return (
        <Stack direction="row" spacing={1}>
          {row.status === 'pending' && (
            <>
              <Button size="small" disabled={busy} onClick={() => a.onApprove(row)}>
                Принять
              </Button>
              <Button size="small" color="error" disabled={busy} onClick={() => a.onDeactivate(row)}>
                Отклонить
              </Button>
            </>
          )}
          {row.status === 'active' && !isSelf && (
            <Button size="small" color="error" disabled={busy} onClick={() => a.onDeactivate(row)}>
              Уволить
            </Button>
          )}
          {a.onDetails && (
            <Button size="small" onClick={() => a.onDetails?.(row)}>
              Подробнее
            </Button>
          )}
        </Stack>
      );
    },
  },
];

/* ----------------------------------- Page ----------------------------------- */

export interface UsersPageProps {
  /** Open the details drawer / page for a user. */
  onDetails?: (row: UserRow) => void;
}

/**
 * "Пользователи" page (Owner only): applications / active users / fired.
 * Data: GET /api/users; actions: POST /api/users/{id}/approve and
 * DELETE /api/users/{id}. Status is derived from isApproved / isActive.
 */
export default function UsersPage({ onDetails }: UsersPageProps) {
  const { user: me } = useAuth();
  const { data: rows = [], isLoading, isError, error } = useUsers();
  const { data: company } = useMyCompany();
  const approve = useApproveUser();
  const deactivate = useDeactivateUser();

  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<UserRow | null>(null); // awaiting confirmation

  const counts = useMemo(() => {
    const c: Record<UserStatus, number> = { pending: 0, active: 0, fired: 0 };
    for (const row of rows) c[row.status] += 1;
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return rows.filter(
      (row) =>
        row.status === tabs[tab].status &&
        (filter === 'all' || row.role === filter) &&
        (!q ||
          row.fullName.toLowerCase().includes(q) ||
          (qDigits !== '' && row.phone.includes(qDigits))),
    );
  }, [rows, tab, filter, query]);

  const pageRows = filteredRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const busyId = approve.isPending
    ? approve.variables
    : deactivate.isPending
      ? deactivate.variables
      : undefined;

  const { mutate: approveMutate } = approve;

  const columns = useMemo(
    () =>
      buildColumns({
        currentUserId: me?.id,
        busyId,
        onApprove: (row) => approveMutate(row.id),
        onDeactivate: (row) => setTarget(row),
        onDetails,
      }),
    [me?.id, busyId, approveMutate, onDetails],
  );

  const mutationError = approve.error ?? deactivate.error;

  const confirmDeactivate = () => {
    if (!target) return;
    deactivate.mutate(target.id);
    setTarget(null);
  };

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
      {company && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => navigator.clipboard.writeText(company.id)}>
              Копировать id
            </Button>
          }
        >
          Чтобы сотрудник или завхоз мог зарегистрироваться в «{company.name}», сообщите ему id компании:{' '}
          <b>{company.id}</b>
        </Alert>
      )}

      {mutationError && (
        <Alert
          severity="error"
          onClose={() => {
            approve.reset();
            deactivate.reset();
          }}
        >
          {mutationError.message}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, value: number) => {
          setTab(value);
          setPage(0);
        }}
        variant="standard"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map(({ label, status }) => (
          <Tab key={status} label={`${label} (${counts[status]})`} />
        ))}
      </Tabs>

      {/* Filters: search + chips */}
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          type="search"
          label="Поиск по имени или телефону"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
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
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
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

      {/* Irreversible: no reactivation endpoint exists */}
      <Dialog open={target !== null} onClose={() => setTarget(null)}>
        <DialogTitle>
          {target?.status === 'pending' ? 'Отклонить заявку?' : 'Уволить сотрудника?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {target?.fullName}: аккаунт будет деактивирован, все его сессии завершены.
            Вернуть доступ нельзя, а телефон останется занятым.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)}>Отмена</Button>
          <Button color="error" onClick={confirmDeactivate}>
            {target?.status === 'pending' ? 'Отклонить' : 'Уволить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}