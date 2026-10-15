// ScanPage.tsx — "Scan Board" (Mobile Light), Worker role.
//
// The top app bar ("Камера" + back button) comes from the route's
// `handle.topBar` and SimpleLayout, like on the other Worker pages.
//
// Camera: NOT implemented here — mount it inside <CameraSlot> (see TODO below).
// When it decodes a sticker, call `handleDetected(text)`.
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { FlashOnIcon } from '../../shared/Icons';
import { parseToolSticker, type ScannedTool } from '../../entities/operationModel';
import CameraSlot from './CameraSlot';

export interface ScanPageProps {
  /** Called with a successfully parsed sticker. Default: go to /operation. */
  onScanned?: (tool: ScannedTool) => void;
}

export default function ScanPage({ onScanned }: ScanPageProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [torchOn, setTorchOn] = useState(false);

  /** Feed the decoded QR text here. */
  const handleDetected = useCallback(
    (text: string) => {
      const tool = parseToolSticker(text);
      if (!tool) {
        setError('Это не наклейка инструмента');
        return;
      }
      setError(undefined);
      if (onScanned) onScanned(tool);
      else navigate('/operation', { state: { tool } });
    },
    [navigate, onScanned],
  );
  void handleDetected; // remove once the camera calls it

  return (
    <Box
      sx={{
        // viewport minus the 64px mobile top bar
        height: 'calc(100dvh - 65px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* TODO(camera): start the stream and render it as children of CameraSlot,
          e.g. <CameraSlot error={error}><video ref={videoRef} playsInline muted autoPlay /></CameraSlot> */}
      <CameraSlot error={error} />

      {/* Flashlight (design has it in the top bar; here it floats over the camera) */}
      <IconButton
        aria-label={torchOn ? 'Выключить фонарик' : 'Включить фонарик'}
        aria-pressed={torchOn}
        onClick={() => setTorchOn((v) => !v)} // TODO(camera): apply via track.applyConstraints({ advanced: [{ torch }] })
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          color: '#fff',
          bgcolor: torchOn ? 'primary.main' : 'rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: torchOn ? 'primary.dark' : 'rgba(0,0,0,0.6)' },
        }}
      >
        <FlashOnIcon />
      </IconButton>
    </Box>
  );
}