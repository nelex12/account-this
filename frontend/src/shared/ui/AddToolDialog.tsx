// AddToolDialog.tsx
// Dialog for creating a tool: POST /api/tools (Issuer, Owner).
// api.yaml CreateToolRequest has a single field — `name` (required, max 100 chars,
// it ends up in the employee's QR). On success the tools list is refetched
// (useCreateTool invalidates it) and the dialog closes.
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { ApiError } from '../../api/auth';
import { useCreateTool } from '../../api/tools';

/** api.yaml CreateToolRequest.name maxLength. */
export const TOOL_NAME_MAX_LENGTH = 100;

interface AddToolDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddToolDialog({ open, onClose }: AddToolDialogProps) {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const { mutate, isPending, error, reset } = useCreateTool();

  // Fresh form (and no stale error) each time the dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setTouched(false);
      reset();
    }
  }, [open, reset]);

  const trimmedName = name.trim();
  const localError =
    name.length > TOOL_NAME_MAX_LENGTH
      ? `Не более ${TOOL_NAME_MAX_LENGTH} символов`
      : touched && trimmedName.length === 0
        ? 'Введите название инструмента'
        : null;

  // Server-side validation message for `name` (400), if any
  const serverFieldError =
    error instanceof ApiError ? error.fieldErrors?.name?.[0] : undefined;
  // Anything else (403, 5xx, network): shown above the form
  const generalError =
    error && !serverFieldError
      ? error instanceof ApiError
        ? error.message
        : 'Не удалось добавить инструмент. Проверьте соединение'
      : null;

  const fieldError = localError ?? serverFieldError ?? null;
  const canSubmit =
    trimmedName.length > 0 && name.length <= TOOL_NAME_MAX_LENGTH && !isPending;

  const handleClose = () => {
    if (!isPending) onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    mutate({ name: trimmedName }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>Добавить инструмент</DialogTitle>

        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Инструмент появится в реестре вашей компании. Идентификатор
            присваивается автоматически — по нему печатается QR-наклейка.
          </DialogContentText>

          <Stack spacing={2}>
            {generalError && <Alert severity="error">{generalError}</Alert>}

            <TextField
              autoFocus
              required
              label="Название"
              placeholder="Например, Дрель Bosch GSB 16 RE"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) reset();
              }}
              onBlur={() => setTouched(true)}
              error={fieldError !== null}
              helperText={
                fieldError ??
                `Марка и модель · ${name.length}/${TOOL_NAME_MAX_LENGTH}`
              }
              disabled={isPending}
              fullWidth
            />

            <DialogContentText variant="body2">
              Новый инструмент создаётся в состоянии «Исправен», без комментария
              и без держателя. Состояние и комментарий можно изменить позже.
            </DialogContentText>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!canSubmit}
            startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Добавить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}