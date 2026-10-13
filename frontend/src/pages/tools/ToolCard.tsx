// ToolCard.tsx — one tool as a card (mobile replacement for a ToolsPage table row)
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusBadge from '../../shared/ui/StatusBadge';
import type { ToolRow } from '../../entities/toolsModel';
import { conditionBadge } from './toolCondition';

export interface ToolCardProps {
  row: ToolRow;
  /** When provided, the whole card is tappable and opens the details. */
  onDetails?: (row: ToolRow) => void;
}

export default function ToolCard({ row, onDetails }: ToolCardProps) {
  const content = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Name + number on the left, condition on the right */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
            {row.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.number} · {row.category}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusBadge {...conditionBadge[row.condition]} />
        </Box>
      </Stack>

      {/* Location + last update */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: row.issued ? 500 : 400 }}>
          {row.location}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {row.updated}
        </Typography>
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