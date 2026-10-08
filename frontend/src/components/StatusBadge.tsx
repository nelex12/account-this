import Chip from '@mui/material/Chip';

export type StatusBadgeColor = 'success' | 'error' | 'warning' | 'info';

export interface StatusBadgeProps {
  label: string;
  color: StatusBadgeColor;
}

/** Status pill: default MUI outlined Chip in a semantic color. */
export default function StatusBadge({ label, color }: StatusBadgeProps) {
  return <Chip size="small" color={color} variant="outlined" label={label} />;
}