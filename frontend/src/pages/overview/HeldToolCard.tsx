// HeldToolCard.tsx — "Tool Card" from the Worker overview design:
// image placeholder on the left, tool name and inventory number on the right.
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import type { ToolRow } from '../../entities/toolsModel';

export interface HeldToolCardProps {
  tool: Pick<ToolRow, 'id' | 'name' | 'number'>;
  /** When provided, the whole card is tappable. */
  onClick?: (tool: HeldToolCardProps['tool']) => void;
}

export default function HeldToolCard({ tool, onClick }: HeldToolCardProps) {
  const content = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
      {/* Tool image (placeholder until tools have photos) */}
      <Box
        aria-hidden
        sx={{
          width: 72,
          height: 72,
          flexShrink: 0,
          borderRadius: '12px',
          bgcolor: 'action.selected',
        }}
      />

      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5, justifyContent: 'center' }}>
        <Typography variant="subtitle1" sx={{ wordBreak: 'break-word' }}>
          {tool.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {tool.number}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Card variant="outlined">
      {onClick ? <CardActionArea onClick={() => onClick(tool)}>{content}</CardActionArea> : content}
    </Card>
  );
}