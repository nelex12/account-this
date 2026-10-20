// useQrScanner.ts — decode loop on top of a playing <video>.
//
// Runs a self-throttled loop (next frame is requested only after the previous
// one was decoded, ~8 fps max), so slow phones are never flooded. The same text
// is reported once, until it has been out of the picture for REPEAT_AFTER_MS.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { getQrDetector } from './qrDetector';

const INTERVAL_MS = 120;
const REPEAT_AFTER_MS = 2000;

export interface UseQrScannerOptions {
  /** Loop runs only while true (camera active and not paused). */
  enabled: boolean;
  onDetected: (text: string) => void;
}

export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  { enabled, onDetected }: UseQrScannerOptions,
): { decoderError: boolean } {
  const [decoderError, setDecoderError] = useState(false);
  const onDetectedRef = useRef(onDetected);
  const last = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    last.current = null;

    (async () => {
      let detector;
      try {
        detector = await getQrDetector();
        if (!stopped) setDecoderError(false);
      } catch {
        if (!stopped) setDecoderError(true);
        return;
      }

      const tick = async () => {
        if (stopped) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && !video.paused) {
          try {
            const text = await detector.detect(video);
            if (text && !stopped) {
              const now = Date.now();
              const prev = last.current;
              const repeated = prev?.text === text && now - prev.at < REPEAT_AFTER_MS;
              last.current = { text, at: now };
              if (!repeated) onDetectedRef.current(text);
            }
          } catch {
            /* a bad frame is not fatal, try the next one */
          }
        }
        if (!stopped) timer = setTimeout(tick, INTERVAL_MS);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled, videoRef]);

  return { decoderError };
}
