// qrDetector.ts — one place that knows how QR codes are decoded.
//
// Strategy:
//   1. If the browser has a native BarcodeDetector with QR support (Chrome on Android,
//      Safari 17+...), use it: fast, hardware/OS-backed, no extra download.
//   2. Otherwise use the `barcode-detector` ponyfill (zxing-cpp compiled to WASM).
//      The .wasm file is bundled by Vite (NOT loaded from a CDN), so scanning works
//      offline and the service worker can precache it (see vite.config.ts).
//
// The rest of the app only sees `QrDetector.detect(video) -> text | null`.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export interface QrDetector {
  /** Decodes the current frame of the video. Returns the QR text or null. */
  detect(video: HTMLVideoElement): Promise<string | null>;
}

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

type DetectorCtor = {
  new (options: { formats: string[] }): DetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

async function createNative(): Promise<DetectorLike | null> {
  const Native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats = (await Native.getSupportedFormats?.()) ?? [];
    if (!formats.includes('qr_code')) return null;
    return new Native({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

async function createPonyfill(): Promise<DetectorLike> {
  // Dynamic import: the WASM reader is only pulled in when it is really needed.
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
    },
    fireImmediately: false,
  });
  return new BarcodeDetector({ formats: ['qr_code'] });
}

let cached: Promise<QrDetector> | null = null;

/** Creates (once) and returns the shared detector. Rejects if neither backend works. */
export function getQrDetector(): Promise<QrDetector> {
  cached ??= (async (): Promise<QrDetector> => {
    const native = await createNative();
    let inner: DetectorLike = native ?? (await createPonyfill());
    let isNative = native !== null;

    return {
      async detect(video: HTMLVideoElement) {
        try {
          const found = await inner.detect(video);
          return found[0]?.rawValue ?? null;
        } catch (e) {
          // Native detector can throw on some devices/frames: fall back to WASM once.
          if (isNative) {
            inner = await createPonyfill();
            isNative = false;
            return null;
          }
          throw e;
        }
      },
    };
  })().catch((e) => {
    cached = null; // allow retry
    throw e;
  });
  return cached;
}
