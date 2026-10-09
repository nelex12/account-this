// OperationDetailsDrawer.tsx
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';

/* ----------------------------------- Data ----------------------------------- */

export type OperationStatus = 'подтверждено' | 'ожидает' | 'расхождение';

export interface OperationDetails {
  id: string;
  /** Tool title, e.g. "Перфоратор Bosch GBH 2-26" */
  toolName: string;
  /** Tool inventory number, e.g. "№0142" */
  toolNumber: string;
  /** Short action label shown next to the number, e.g. "Возврат" */
  actionLabel: string;
  status: OperationStatus;
  /** Time of the operation */
  time: string;
  /** "Выдача" / "Возврат" */
  action: string;
  employee: string;
  declared: string;
  acceptedBy: string;
  /** Where the tool was sent / is stored */
  destination: string;
  comment?: string;
}

const statusLabel: Record<OperationStatus, string> = {
  подтверждено: 'Подтверждено',
  ожидает: 'Ожидает',
  расхождение: 'Расхождение',
};

const statusColor: Record<OperationStatus, 'success' | 'warning' | 'error'> = {
  подтверждено: 'success',
  ожидает: 'warning',
  расхождение: 'error',
};

interface OperationDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Data to render; when null the drawer renders empty. */
  operation?: OperationDetails | null;
  onEdit?: (operation: OperationDetails) => void;
}

/* -------------------------------- Component ------------------------------- */

/**
 * Right-side drawer with operation details.
 *
 * Layout:
 *   [ Title ............... close ]
 *   ─────────────────────────────
 *   Tool name
 *   №number · action
 *   [ status chip ]
 *
 *   two-column grid of label/value pairs
 *   comment block
 *
 *   [ Закрыть   Изменить ]  (bottom-right)
 */
export default function DetailsDrawer({
  open,
  onClose,
  operation,
  onEdit,
}: OperationDetailsDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ width: 360, maxWidth: '100vw' }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
          }}
        >
          <Typography variant="h6">Детали операции</Typography>
          <IconButton onClick={onClose} aria-label="Закрыть" edge="end">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        {/* Body */}
        {operation && (
          <Box sx={{ flexGrow: 1, overflow: 'auto', px: 3, py: 2 }}>
            <Typography variant="h6">{operation.toolName}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {operation.toolNumber} · {operation.actionLabel}
            </Typography>

            <Chip
              size="small"
              color={statusColor[operation.status]}
              label={statusLabel[operation.status]}
              sx={{ mb: 3 }}
            />

            {/* Two-column grid of label/value pairs */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: 2,
                rowGap: 2,
              }}
            >
              <Field label="Время операции" value={operation.time} />
              <Field label="Действие" value={operation.action} />

              <Field label="Сотрудник" value={operation.employee} />
              <Field label="Заявлено" value={operation.declared} />

              <Field label="Принял" value={operation.acceptedBy} />
              <Field label="Отправлено" value={operation.destination} />
            </Box>

            {operation.comment && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Комментарий
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {operation.comment}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Actions */}
        <Divider />
        <Stack
          direction="row"
          spacing={2}
          sx={{ justifyContent: 'flex-end', px: 3, py: 2 }}
        >
          <Button onClick={onClose}>Закрыть</Button>
          <Button
            onClick={() => operation && onEdit?.(operation)}
            disabled={!operation}
          >
            Изменить
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

/* --------------------------------- Helpers -------------------------------- */

interface FieldProps {
  label: string;
  value: string;
}

function Field({ label, value }: FieldProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}