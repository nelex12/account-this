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
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { ApiError } from '../../api/auth';
import { useTool, useUpdateToolCondition } from '../../api/tools';
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

  const handleClose = () => {
    if (update.isPending) return;
    update.reset();
    onClose();
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
            onClose={handleClose}
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
  onClose: () => void;
}

function ToolDetailsBody({ tool, update, onClose }: ToolDetailsBodyProps) {
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
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', px: 3, py: 2 }}>
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