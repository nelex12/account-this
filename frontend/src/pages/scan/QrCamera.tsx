// QrCamera.tsx — live camera + QR decoding, rendered inside <CameraSlot>.
//
// Owns everything about the camera (permission, stream, torch, camera switch,
// decoding). The page only passes `onDetected` and decides what to do with the text.
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { CameraswitchIcon, FlashOffIcon, FlashOnIcon, RefreshIcon } from '../../shared/Icons';
import CameraSlot from './CameraSlot';
import { useCamera, type CameraStatus } from './camera/useCamera';
import { useQrScanner } from './camera/useQrScanner';

const STARTING_TEXT = 'Запуск камеры…';

const STATUS_TEXT: Partial<Record<CameraStatus, string>> = {
  denied: 'Нет доступа к камере. Разрешите её в настройках браузера для этого сайта',
  'no-camera': 'Камера не найдена на этом устройстве',
  'in-use': 'Камера занята другим приложением. Закройте его и повторите',
  insecure: 'Камера работает только по HTTPS. Откройте приложение по защищённому адресу',
  unsupported: 'Этот браузер не поддерживает доступ к камере',
  error: 'Не удалось запустить камеру',
};

const RETRYABLE: CameraStatus[] = ['denied', 'no-camera', 'in-use', 'error'];

const floatingButton = {
  color: '#fff',
  bgcolor: 'rgba(0,0,0,0.4)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
} as const;

export interface QrCameraProps {
  /** Decoded QR text. Called once per code (repeats of the same code are filtered). */
  onDetected: (text: string) => void;
  /** Stop decoding (the stream stays on), e.g. while a result dialog is open. */
  paused?: boolean;
  /** Message from the page (e.g. "not a tool sticker"); shown only while the camera works. */
  error?: string;
  hint?: string;
}

export default function QrCamera({ onDetected, paused = false, error, hint }: QrCameraProps) {
  const { videoRef, camera: cam } = useCamera(true);
  const active = cam.status === 'active';
  const { decoderError } = useQrScanner(videoRef, { enabled: active && !paused, onDetected });

  const starting = cam.status === 'starting' || cam.status === 'idle';
  const message = !active
    ? STATUS_TEXT[cam.status]
    : decoderError
      ? 'Не удалось загрузить сканер. Проверьте соединение и повторите'
      : error;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0, position: 'relative' }}>
      <CameraSlot hint={starting ? STARTING_TEXT : hint} error={starting ? undefined : message}>
        {/* The <video> is always mounted: useCamera attaches the stream to it. */}
        <video ref={videoRef} playsInline muted autoPlay aria-label="Изображение с камеры" />
      </CameraSlot>

      <Stack spacing={1.5} sx={{ position: 'absolute', top: 12, right: 12 }}>
        {active && cam.torchSupported && (
          <IconButton
            aria-label={cam.torchOn ? 'Выключить фонарик' : 'Включить фонарик'}
            aria-pressed={cam.torchOn}
            onClick={() => void cam.toggleTorch()}
            sx={{
              ...floatingButton,
              ...(cam.torchOn && { bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }),
            }}
          >
            {cam.torchOn ? <FlashOnIcon /> : <FlashOffIcon />}
          </IconButton>
        )}
        {active && cam.canSwitch && (
          <IconButton aria-label="Сменить камеру" onClick={() => void cam.switchCamera()} sx={floatingButton}>
            <CameraswitchIcon />
          </IconButton>
        )}
      </Stack>

      {(RETRYABLE.includes(cam.status) || decoderError) && (
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={cam.retry}
          sx={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}
        >
          Повторить
        </Button>
      )}
    </Box>
  );
}
