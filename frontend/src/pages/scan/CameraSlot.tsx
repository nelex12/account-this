// CameraSlot.tsx — the black camera area with the aiming frame.
//
// >>> THE CAMERA GOES HERE <<<
// Render your <video> (or a scanner component) as `children`; it is stretched
// under the frame and the hint. Without children a placeholder is shown.
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const CORNER = 44;
const THICKNESS = 3;

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = pos[0] === 't';
  const left = pos[1] === 'l';
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        width: CORNER,
        height: CORNER,
        [top ? 'top' : 'bottom']: 0,
        [left ? 'left' : 'right']: 0,
        borderColor: '#fff',
        borderStyle: 'solid',
        borderWidth: 0,
        [top ? 'borderTopWidth' : 'borderBottomWidth']: THICKNESS,
        [left ? 'borderLeftWidth' : 'borderRightWidth']: THICKNESS,
        [`border${top ? 'Top' : 'Bottom'}${left ? 'Left' : 'Right'}Radius`]: '16px',
      }}
    />
  );
}

export interface CameraSlotProps {
  /** The live camera view (<video>, scanner component...). */
  children?: ReactNode;
  /** Text in the hint bubble. */
  hint?: string;
  /** Shown instead of the hint, e.g. permission/camera errors. */
  error?: string;
}

export default function CameraSlot({
  children,
  hint = 'Наведите камеру на наклейку',
  error,
}: CameraSlotProps) {
  return (
    <Box
      data-camera-slot
      sx={{
        position: 'relative',
        flexGrow: 1,
        minHeight: 0,
        bgcolor: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Camera layer */}
      <Box sx={{ position: 'absolute', inset: 0, '& video': { width: '100%', height: '100%', objectFit: 'cover' } }}>
        {children}
      </Box>

      {/* Hint */}
      <Box
        role={error ? 'alert' : 'status'}
        sx={{
          position: 'relative',
          mt: 5,
          mx: 3,
          px: 3,
          py: 2,
          maxWidth: 300,
          borderRadius: '16px',
          bgcolor: error ? 'rgba(217,48,37,0.85)' : 'rgba(90,90,90,0.85)',
          textAlign: 'center',
        }}
      >
        <Typography variant="subtitle1" sx={{ color: '#F2F2F2', fontWeight: 500 }}>
          {error ?? hint}
        </Typography>
      </Box>

      {/* Aiming frame */}
      <Box
        sx={{
          position: 'relative',
          mt: 'auto',
          mb: 'auto',
          width: 'min(264px, 70vw)',
          aspectRatio: '1 / 1',
        }}
      >
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
      </Box>
    </Box>
  );
}