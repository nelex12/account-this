// src/pages/tools/ToolDetailsDrawer.tsx
// Right-side drawer with one tool:
//   - data comes from GET /api/tools/{id} (also works for written-off tools);
//   - condition and comment are edited via PATCH /api/tools/{id}.
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ApiError } from '../../api/auth';
import { useDeleteTool, useTool, useUpdateToolCondition } from '../../api/tools';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  formatUnix,
  getToolLocation,
  type Tool,
  type ToolCondition,
  type UpdateToolConditionRequest,
} from '../../entities/toolsModel';
import { CloseIcon } from '../../shared/Icons';
import StatusBadge from '../../shared/ui/StatusBadge';
import { conditionBadge } from './toolCondition';

const conditions: ToolCondition[] = ['Good', 'Damaged', 'Broken'];

interface ToolDetailsDrawerProps {
  /** id of the tool to show; null = closed. */
  toolId: string | null;
  onClose: () => void;
}

export default function ToolDetailsDrawer({ toolId, onClose }: ToolDetailsDrawerProps) {
  const open = toolId !== null;
  const { data: tool, isLoading, error } = useTool(toolId ?? '');
  const update = useUpdateToolCondition();
  const writeOff = useDeleteTool();

  const closeNow = () => {
    update.reset();
    writeOff.reset();
    onClose();
  };

  const handleClose = () => {
    if (update.isPending || writeOff.isPending) return;
    closeNow();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      slotProps={{ paper: { sx: { width: 380, maxWidth: '100vw' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2 }}
        >
          <Typography variant="h6">Данные инструмента</Typography>
          <IconButton onClick={handleClose} aria-label="Закрыть" edge="end">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">
              {error instanceof ApiError ? error.message : 'Не удалось загрузить инструмент'}
            </Alert>
          </Box>
        )}

        {tool && (
          // key: when the server data changes (after a save) the form restarts from it
          <ToolDetailsBody
            key={`${tool.id}:${tool.condition}:${tool.comment ?? ''}`}
            tool={tool}
            update={update}
            writeOff={writeOff}
            onClose={handleClose}
            onWrittenOff={closeNow}
          />
        )}
      </Box>
    </Drawer>
  );
}

/* ---------------------------------- Body ----------------------------------- */

interface ToolDetailsBodyProps {
  tool: Tool;
  update: ReturnType<typeof useUpdateToolCondition>;
  writeOff: ReturnType<typeof useDeleteTool>;
  onClose: () => void;
  /** Called after a successful write-off; closes the drawer unconditionally. */
  onWrittenOff: () => void;
}

function ToolDetailsBody({ tool, update, writeOff, onClose, onWrittenOff }: ToolDetailsBodyProps) {
  const { user } = useAuth();
  // DELETE /api/tools/{id} is Owner only; written-off tools can't be written off again
  const canWriteOff = user?.role === 'Owner' && tool.isActive;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [condition, setCondition] = useState<ToolCondition>(tool.condition);
  const [comment, setComment] = useState(tool.comment ?? '');

  const conditionChanged = condition !== tool.condition;
  const commentChanged = comment !== (tool.comment ?? '');
  const changed = conditionChanged || commentChanged;

  const { isPending, isSuccess, error, reset, mutate } = update;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : undefined;
  const generalError =
    error && !fieldErrors
      ? error instanceof ApiError
        ? error.message
        : 'Не удалось сохранить. Проверьте соединение'
      : null;

  const handleSave = () => {
    // Only changed fields are sent: absent = unchanged; comment "" clears it
    const payload: UpdateToolConditionRequest = {};
    if (conditionChanged) payload.condition = condition;
    if (commentChanged) payload.comment = comment;
    mutate({ id: tool.id, payload });
  };

  const handleWriteOff = () => {
    writeOff.mutate(tool.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onWrittenOff();
      },
    });
  };

  return (
    <>
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 3, py: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Typography variant="h6" sx={{ flexGrow: 1, wordBreak: 'break-word' }}>
            {tool.name}
          </Typography>
          {!tool.isActive && <Chip size="small" label="Списан" />}
        </Stack>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 2, wordBreak: 'break-all' }}
        >
          {tool.id}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 2,
            rowGap: 2,
            mb: 3,
          }}
        >
          <Field label="Состояние">
            <StatusBadge {...conditionBadge[tool.condition]} />
          </Field>
          <Field label="Где находится">
            <Typography variant="body2">{getToolLocation(tool)}</Typography>
          </Field>
          <Field label="На руках с">
            <Typography variant="body2">
              {tool.heldSince !== null ? formatUnix(tool.heldSince) : '—'}
            </Typography>
          </Field>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Изменить вручную
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Для случаев вне выдачи и возврата: заметили повреждение или
          инструмент отремонтирован.
        </Typography>

        <Stack spacing={2}>
          {generalError && <Alert severity="error">{generalError}</Alert>}
          {writeOff.error && !confirmOpen && (
            <Alert severity="error">
              {writeOff.error instanceof ApiError
                ? writeOff.error.message
                : 'Не удалось списать инструмент. Проверьте соединение'}
            </Alert>
          )}
          {isSuccess && <Alert severity="success">Сохранено</Alert>}

          <TextField
            select
            label="Состояние"
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value as ToolCondition);
              if (error || isSuccess) reset();
            }}
            error={Boolean(fieldErrors?.condition)}
            helperText={fieldErrors?.condition?.[0]}
            disabled={isPending}
            fullWidth
          >
            {conditions.map((value) => (
              <MenuItem key={value} value={value}>
                {conditionBadge[value].label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Комментарий"
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              if (error || isSuccess) reset();
            }}
            error={Boolean(fieldErrors?.comment)}
            helperText={fieldErrors?.comment?.[0] ?? 'Пустое поле очистит комментарий'}
            disabled={isPending}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </Box>

      <Divider />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', px: 3, py: 2 }}>
        {canWriteOff && (
          <Button
            color="error"
            onClick={() => setConfirmOpen(true)}
            disabled={isPending}
          >
            Списать
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={isPending}>
          Закрыть
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!changed || isPending}
          startIcon={isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Сохранить
        </Button>
      </Stack>

      <Dialog
        open={confirmOpen}
        onClose={() => !writeOff.isPending && setConfirmOpen(false)}
      >
        <DialogTitle>Списать инструмент?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            «{tool.name}» исчезнет из реестра. Действие необратимо; записи в
            журнале останутся.
          </DialogContentText>
          {writeOff.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {writeOff.error instanceof ApiError
                ? writeOff.error.message
                : 'Не удалось списать инструмент. Проверьте соединение'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={writeOff.isPending}>
            Отмена
          </Button>
          <Button
            color="error"
            onClick={handleWriteOff}
            disabled={writeOff.isPending}
            startIcon={
              writeOff.isPending ? <CircularProgress size={16} color="inherit" /> : undefined
            }
          >
            Списать
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/* --------------------------------- Helpers --------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}