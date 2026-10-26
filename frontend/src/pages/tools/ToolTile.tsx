// src/pages/tools/ToolTile.tsx
// A square "box" for the Стенд tab: one tool on the board.
// Same data as ToolCard, but boxier: fixed 1:1 shape, a colored top edge showing the
// condition at a glance, name on top, condition + location at the bottom.
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';

import StatusBadge from '../../shared/ui/StatusBadge';
import { isIssued, type Tool } from '../../entities/toolsModel';
import { conditionBadge } from './toolCondition';

export interface ToolTileProps {
  tool: Tool;
  /** When provided, the whole tile is tappable and opens the details. */
  onDetails?: (tool: Tool) => void;
}

export default function ToolTile({ tool, onDetails }: ToolTileProps) {
  const issued = isIssued(tool);
  const badge = conditionBadge[tool.condition];

  const content = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 1,
        p: { xs: 1.25, sm: 1.75 },
        // Colored top edge = condition (Good / Damaged / Broken)
        borderTop: 4,
        borderColor: `${badge.color}.main`,
        // Tools that are out with an employee are tinted, so the board reads at a glance
        bgcolor: issued ? 'action.hover' : 'transparent',
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          wordBreak: 'break-word',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {tool.name}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75, minWidth: 0 }}>
        <StatusBadge {...badge} />
        <Typography
          variant="caption"
          color={issued ? 'text.primary' : 'text.secondary'}
          sx={{ fontWeight: issued ? 500 : 400, maxWidth: '100%', wordBreak: 'break-word' }}
        >
          {issued ? tool.holderName ?? 'На руках' : 'На месте'}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        aspectRatio: '1 / 1',
        minWidth: 0,
        // Boxy: noticeably squarer corners than the regular cards
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {onDetails ? (
        <CardActionArea sx={{ height: '100%' }} onClick={() => onDetails(tool)}>
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}
