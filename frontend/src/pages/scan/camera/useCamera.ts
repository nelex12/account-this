// useCamera.ts — owns the camera stream: permission, lifecycle, torch, camera switch.
//
// Usage:
//   const cam = useCamera(true);
//   <video ref={cam.videoRef} playsInline muted autoPlay />
//   cam.status === 'active' -> stream is playing
//
// Handles: insecure context, denied/blocked permission, no camera, camera busy,
// StrictMode double-mount, tab going to background (stream is released and restored),
// track ending on its own, torch (where the browser supports it), several cameras.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type CameraStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'denied' // user (or policy) blocked the camera
  | 'no-camera'
  | 'in-use' // another app holds the camera
  | 'insecure' // not HTTPS / localhost
  | 'unsupported' // no getUserMedia at all
  | 'error';

const DEVICE_KEY = 'at.scan.cameraId';

function readSavedDevice(): string | undefined {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveDevice(id: string | undefined) {
  try {
    if (id) localStorage.setItem(DEVICE_KEY, id);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* storage unavailable: not critical */
  }
}

function errorToStatus(e: unknown): CameraStatus {
  const name = e instanceof DOMException ? e.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-camera';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    default:
      return 'error';
  }
}

/** Ideal 1080p: dense QR codes (the worker's QR is ~1 KB of text) need pixels. */
const SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } };

async function openStream(deviceId: string | undefined): Promise<MediaStream> {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, ...SIZE },
        audio: false,
      });
    } catch (e) {
      // Saved camera disappeared / was never valid: forget it and use the default.
      const name = e instanceof DOMException ? e.name : '';
      if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw e;
      saveDevice(undefined);
    }
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, ...SIZE },
    audio: false,
  });
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export interface CameraState {
  status: CameraStatus;
  /** Torch exists on this device/browser (iOS Safari: no). */
  torchSupported: boolean;
  torchOn: boolean;
  toggleTorch: () => Promise<void>;
  /** More than one camera available. */
  canSwitch: boolean;
  switchCamera: () => Promise<void>;
  /** Tries to start again (after an error / granting permission). */
  retry: () => void;
}

export function useCamera(enabled = true): {
  videoRef: RefObject<HTMLVideoElement | null>;
  camera: CameraState;
} {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deviceIdRef = useRef<string | undefined>(readSavedDevice());
  const statusRef = useRef<CameraStatus>('idle');
  const torchRef = useRef(false);

  const [status, setStatusState] = useState<CameraStatus>('idle');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');

  // Known up front, so it is derived during render instead of set from an effect.
  const blocked: CameraStatus | null = !window.isSecureContext
    ? 'insecure'
    : !navigator.mediaDevices?.getUserMedia
      ? 'unsupported'
      : null;

  const setStatus = useCallback((s: CameraStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  // Release the camera while the tab/app is in the background (and take it back later).
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // If the user fixes the permission in the browser UI, pick it up without a reload.
  useEffect(() => {
    let permission: PermissionStatus | undefined;
    let disposed = false;
    const onChange = () => {
      if (permission?.state === 'granted' && statusRef.current === 'denied') {
        setAttempt((a) => a + 1);
      }
    };
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((p) => {
        if (disposed) return;
        permission = p;
        p.addEventListener('change', onChange);
      })
      .catch(() => {
        /* Safari/Firefox do not support the 'camera' permission name */
      });
    return () => {
      disposed = true;
      permission?.removeEventListener('change', onChange);
    };
  }, []);

  // The stream itself.
  useEffect(() => {
    if (!enabled || !visible) return;

    if (blocked) return;

    let cancelled = false;
    const video = videoRef.current;

    (async () => {
      setStatus('starting');
      try {
        const stream = await openStream(deviceIdRef.current);
        if (cancelled || !video) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        track.addEventListener('ended', () => {
          if (!cancelled) setStatus('error');
        });

        video.srcObject = stream;
        await video.play();
        if (cancelled) return;

        // Capabilities are reliable only once the stream is running.
        const caps = (track.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchSupported(Boolean(caps.torch));
        if (caps.focusMode?.includes('continuous')) {
          track
            .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
            .catch(() => {});
        }

        // Labels/ids are available after permission was granted.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setDeviceCount(devices.filter((d) => d.kind === 'videoinput').length);

        setStatus('active');
      } catch (e) {
        if (cancelled) return;
        // play() interrupted by a new load request is not an error
        if (e instanceof DOMException && e.name === 'AbortError' && streamRef.current) return;
        stopStream(streamRef.current);
        streamRef.current = null;
        setStatus(errorToStatus(e));
      }
    })();

    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (video) video.srcObject = null;
      torchRef.current = false;
      setTorchOn(false);
      setTorchSupported(false);
    };
  }, [enabled, visible, attempt, blocked, setStatus]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchRef.current;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      torchRef.current = next;
      setTorchOn(next);
    } catch {
      // The browser said it supports it but refused: hide the button.
      setTorchSupported(false);
      setTorchOn(false);
      torchRef.current = false;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    if (devices.length < 2) return;
    const currentId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const index = devices.findIndex((d) => d.deviceId === currentId);
    const next = devices[(index + 1) % devices.length];
    deviceIdRef.current = next.deviceId;
    saveDevice(next.deviceId);
    setAttempt((a) => a + 1);
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return {
    videoRef,
    camera: {
      status: blocked ?? status,
      torchSupported,
      torchOn,
      toggleTorch,
      canSwitch: deviceCount > 1,
      switchCamera,
      retry,
    },
  };
}
