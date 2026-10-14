// src/pages/tools/ToolCard.tsx
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../shared/ui/StatusBadge';
import {
  formatUnix,
  getToolLocation,
  isIssued,
  type Tool,
} from '../../entities/toolsModel';
import { conditionBadge } from './toolCondition';

export interface ToolCardProps {
  tool: Tool;
  /** When provided, the whole card is tappable and opens the details. */
  onDetails?: (tool: Tool) => void;
}

export default function ToolCard({ tool, onDetails }: ToolCardProps) {
  const issued = isIssued(tool);

  const content = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Name on the left, condition on the right */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
            {tool.name}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <StatusBadge {...conditionBadge[tool.condition]} />
        </Box>
      </Stack>

      {/* Location + heldSince */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
      >
        <Typography variant="body2" sx={{ fontWeight: issued ? 500 : 400 }}>
          {getToolLocation(tool)}
        </Typography>
        {tool.heldSince !== null && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0 }}
          >
            {formatUnix(tool.heldSince)}
          </Typography>
        )}
      </Stack>
    </CardContent>
  );

  return (
    <Card variant="outlined">
      {onDetails ? (
        <CardActionArea onClick={() => onDetails(tool)}>{content}</CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}