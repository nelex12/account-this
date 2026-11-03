// AppLogo.tsx — app logo. Placeholder icon for now: swap the body for the real SVG/img later.
import Box from '@mui/material/Box';
import { HandymanIcon } from '../Icons';

interface AppLogoProps {
  /** Side of the square logo, px */
  size?: number;
}

export default function AppLogo({ size = 36 }: AppLogoProps) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '10px',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
      }}
    >
      <HandymanIcon sx={{ fontSize: size * 0.6 }} />
    </Box>
  );
}