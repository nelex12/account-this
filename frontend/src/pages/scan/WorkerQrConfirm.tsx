// WorkerQrConfirm.tsx — the Issuer's screen after a valid Worker QR: who, what, which tool,
// warnings from comparing with the local registry, and "Подтвердить" / "Отклонить".
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { conditionFromApi } from '../../entities/journalModel';
import type { AcceptedScan } from '../../offline/issuerScan';
import StatusBadge from '../../shared/ui/StatusBadge';

export interface WorkerQrConfirmProps {
  scan: AcceptedScan | undefined;
  busy?: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}

export default function WorkerQrConfirm({ scan, busy = false, onConfirm, onDecline }: WorkerQrConfirmProps) {
  // Keep showing the last scan while the dialog fades out (otherwise it flashes empty).
  const [last, setLast] = useState(scan);
  if (scan && scan !== last) setLast(scan);
  const shown = scan ?? last;
  const op = shown?.payload.operation;
  const isTake = op?.action === 'TAKE';
  return (
    <Dialog open={scan !== undefined} onClose={busy ? undefined : onDecline} fullWidth maxWidth="xs">
      <DialogTitle>{isTake ? 'Выдача инструмента' : 'Возврат инструмента'}</DialogTitle>
      <DialogContent>
        {shown && op && (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <div>
              <Typography variant="body2" color="text.secondary">
                Сотрудник
              </Typography>
              <Typography variant="body1">{shown.payload.tokenData.fio}</Typography>
            </div>
            <div>
              <Typography variant="body2" color="text.secondary">
                Инструмент
              </Typography>
              <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                {op.toolName}
              </Typography>
            </div>
            <div>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Состояние по словам сотрудника
              </Typography>
              <StatusBadge {...conditionFromApi[op.toolCondition]} />
            </div>
            {shown.warnings.map((w) =>
              w.kind === 'UNKNOWN_TOOL' ? (
                <Alert key={w.kind} severity="warning">
                  Этого инструмента нет в вашем списке (возможно, он добавлен недавно). Проверьте инструмент
                  и решите, подтверждать ли.
                </Alert>
              ) : (
                <Alert key={w.kind} severity="warning">
                  В списке инструмент числится как «{conditionFromApi[w.registered].label.toLowerCase()}», а
                  сотрудник указал «{conditionFromApi[w.claimed].label.toLowerCase()}». Осмотрите инструмент.
                </Alert>
              ),
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onDecline} disabled={busy}>
          Отклонить
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={busy} autoFocus>
          Подтвердить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
