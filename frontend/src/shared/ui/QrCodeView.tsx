// QrCodeView.tsx — draws a QR code as inline SVG (no network, scales to its container).
// Made for showing a long AT1 string on a phone screen: error correction L keeps modules big,
// the quiet zone is part of the picture, colors are fixed black on white (scanners need contrast
// whatever the app theme is).
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import QRCode from 'qrcode';

const QUIET_ZONE = 4; // modules, as the QR standard asks

export interface QrCodeViewProps {
  value: string;
  /** L = fewest modules (best for long strings on a screen), H = most redundancy (for print) */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** Accessible description of what the code holds */
  label: string;
  /** Square side, any CSS size. Default: fill the container */
  size?: string;
}

export default function QrCodeView({ value, errorCorrection = 'L', label, size = '100%' }: QrCodeViewProps) {
  const { total, path } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: errorCorrection });
    const n = modules.size;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; ) {
        if (modules.get(r, c) !== 1) {
          c++;
          continue;
        }
        let end = c;
        while (end < n && modules.get(r, end) === 1) end++;
        d += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h${end - c}v1h-${end - c}z`;
        c = end;
      }
    }
    return { total: n + QUIET_ZONE * 2, path: d };
  }, [value, errorCorrection]);

  return (
    <Box
      component="svg"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      sx={{ display: 'block', width: size, height: 'auto', aspectRatio: '1 / 1', bgcolor: '#fff' }}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </Box>
  );
}
