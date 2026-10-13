
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusBadge from '../../shared/ui/StatusBadge';
import type { JournalAction, JournalRow } from '../../entities/journalModel';

const actionLabel: Record<JournalAction, string> = {
  issue: 'Выдача',
  return: 'Возврат',
};

export interface JournalCardProps {
  row: JournalRow;
  /** When provided, the whole card is tappable and opens the details. */
  onDetails?: (row: JournalRow) => void;
}

export default function JournalCard({ row, onDetails }: JournalCardProps) {
  const content = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Action + time */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">{actionLabel[row.action]}</Typography>
        <Typography variant="caption" color="text.secondary">
          {row.time}
        </Typography>
      </Stack>

      {/* Tool + condition */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
            {row.toolName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.toolNumber}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusBadge {...row.condition} />
        </Box>
      </Stack>

      {/* People */}
      <Stack direction="row" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            Сотрудник
          </Typography>
          <Typography variant="body2">{row.employee}</Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            Принял
          </Typography>
          <Typography variant="body2">{row.acceptedBy}</Typography>
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card variant="outlined">
      {onDetails ? (
        <CardActionArea onClick={() => onDetails(row)}>{content}</CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}