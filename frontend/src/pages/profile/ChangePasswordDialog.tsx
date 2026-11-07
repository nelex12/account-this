// ChangePasswordDialog.tsx
// Dialog for changing the password: POST /api/auth/change-password (any role).
// Server answers: 400 -> field errors `currentPassword` (wrong current password) and
// `newPassword` (empty, or same as the current one); 403 -> account deactivated.
// On success the new access token is already stored (AuthProvider.changePassword) and the
// other devices are signed out; this one stays signed in.
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { ApiError } from '../../api/auth';
import { useChangePassword } from '../../api/password';
import { VisibilityIcon, VisibilityOffIcon } from '../../shared/Icons';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the password was changed (the dialog closes itself). */
  onChanged?: () => void;
}

export default function ChangePasswordDialog({
  open,
  onClose,
  onChanged,
}: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { mutate, isPending, error, reset } = useChangePassword();

  // Fresh form (and no stale error) each time the dialog opens
  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswords(false);
      setSubmitted(false);
      reset();
    }
  }, [open, reset]);

  /* ------------------------------ validation ------------------------------ */

  const localErrors = {
    current: submitted && currentPassword.length === 0 ? 'Введите текущий пароль' : null,
    next:
      submitted && newPassword.trim().length === 0
        ? 'Введите новый пароль'
        : submitted && newPassword === currentPassword
          ? 'Новый пароль совпадает с текущим'
          : null,
    confirm:
      confirmPassword.length > 0 && confirmPassword !== newPassword
        ? 'Пароли не совпадают'
        : submitted && confirmPassword.length === 0
          ? 'Повторите новый пароль'
          : null,
  };

  // Server-side messages (400), shown under the matching field
  const apiError = error instanceof ApiError ? error : null;
  const serverErrors = {
    current: apiError?.fieldErrors?.currentPassword?.[0],
    next: apiError?.fieldErrors?.newPassword?.[0],
  };
  const hasServerFieldError = Boolean(serverErrors.current || serverErrors.next);

  // Anything else (403, 5xx, network): shown above the form
  const generalError =
    error && !hasServerFieldError
      ? apiError
        ? apiError.message
        : 'Не удалось изменить пароль. Проверьте соединение'
      : null;

  const currentError = localErrors.current ?? serverErrors.current ?? null;
  const nextError = localErrors.next ?? serverErrors.next ?? null;
  const confirmError = localErrors.confirm;

  const isValid =
    currentPassword.length > 0 &&
    newPassword.trim().length > 0 &&
    newPassword !== currentPassword &&
    confirmPassword === newPassword;

  /* ------------------------------- handlers -------------------------------- */

  const handleClose = () => {
    if (!isPending) onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid || isPending) return;

    mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          onChanged?.();
          onClose();
        },
      },
    );
  };

  const clearError = () => {
    if (error) reset();
  };

  const visibilityToggle = (
    <InputAdornment position="end">
      <IconButton
        edge="end"
        aria-label={showPasswords ? 'Скрыть пароли' : 'Показать пароли'}
        onClick={() => setShowPasswords((v) => !v)}
        onMouseDown={(event) => event.preventDefault()}
        disabled={isPending}
      >
        {showPasswords ? <VisibilityOffIcon /> : <VisibilityIcon />}
      </IconButton>
    </InputAdornment>
  );

  const fieldType = showPasswords ? 'text' : 'password';

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Изменить пароль</DialogTitle>

        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            После смены пароля вы останетесь в системе на этом устройстве, а на всех
            остальных потребуется войти заново.
          </DialogContentText>

          <Stack spacing={2}>
            {generalError && <Alert severity="error">{generalError}</Alert>}

            <TextField
              autoFocus
              required
              fullWidth
              type={fieldType}
              label="Текущий пароль"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                clearError();
              }}
              autoComplete="current-password"
              error={currentError !== null}
              helperText={currentError ?? ' '}
              disabled={isPending}
              slotProps={{ input: { endAdornment: visibilityToggle } }}
            />

            <TextField
              required
              fullWidth
              type={fieldType}
              label="Новый пароль"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                clearError();
              }}
              autoComplete="new-password"
              error={nextError !== null}
              helperText={nextError ?? ' '}
              disabled={isPending}
            />

            <TextField
              required
              fullWidth
              type={fieldType}
              label="Повторите новый пароль"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearError();
              }}
              autoComplete="new-password"
              error={confirmError !== null}
              helperText={confirmError ?? ' '}
              disabled={isPending}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isPending ? 'Сохранение...' : 'Изменить пароль'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
