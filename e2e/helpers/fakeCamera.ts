import type { BrowserContext, Page } from '@playwright/test';

/**
 * Виртуальная камера.
 *
 * Скрипт подменяет navigator.mediaDevices.getUserMedia: вместо настоящей камеры приложение получает
 * поток из <canvas> (canvas.captureStream). Тест кладёт в canvas картинку — PNG наклейки или скриншот
 * QR-кода с экрана другого пользователя, — и сканер приложения читает её своим обычным декодером
 * (BarcodeDetector / zxing-wasm). Логика сканирования и проверки QR в приложении не подменяется.
 */
const INIT_SCRIPT = () => {
  const W = 1280;
  const H = 720;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let image: HTMLImageElement | null = null;

  const ensureCanvas = () => {
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    const draw = () => {
      if (!ctx) return;
      ctx.fillStyle = '#7a7a7a'; // "стол" вокруг QR
      ctx.fillRect(0, 0, W, H);
      if (image) {
        const side = H * 0.92;
        const scale = Math.min(side / image.width, side / image.height);
        const w = image.width * scale;
        const h = image.height * scale;
        ctx.fillStyle = '#fff';
        ctx.fillRect((W - w) / 2 - 12, (H - h) / 2 - 12, w + 24, h + 24);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, (W - w) / 2, (H - h) / 2, w, h);
      }
    };
    draw();
    setInterval(draw, 66);
    return canvas;
  };

  const w = window as unknown as {
    __e2eShowToCamera: (dataUrl: string | null) => Promise<void>;
    __e2eCameraRequests: number;
  };
  w.__e2eCameraRequests = 0;
  w.__e2eShowToCamera = (dataUrl) =>
    new Promise<void>((resolve, reject) => {
      if (!dataUrl) {
        image = null;
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => {
        image = img;
        resolve();
      };
      img.onerror = () => reject(new Error('fake camera: image failed to load'));
      img.src = dataUrl;
    });

  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    if (!constraints?.video) throw new DOMException('no audio in e2e', 'NotFoundError');
    w.__e2eCameraRequests++;
    return ensureCanvas().captureStream(15);
  };
  navigator.mediaDevices.enumerateDevices = async () =>
    [
      { deviceId: 'e2e-camera', groupId: 'e2e', kind: 'videoinput', label: 'E2E virtual camera', toJSON() { return this; } },
    ] as MediaDeviceInfo[];
};

export async function installFakeCamera(context: BrowserContext) {
  await context.addInitScript(INIT_SCRIPT);
}

/** Показывает картинку (PNG) виртуальной камере страницы. null — пустой кадр. */
export async function showToCamera(page: Page, png: Buffer | null) {
  const dataUrl = png ? `data:image/png;base64,${png.toString('base64')}` : null;
  await page.evaluate((u) => (window as unknown as { __e2eShowToCamera: (u: string | null) => Promise<void> }).__e2eShowToCamera(u), dataUrl);
}
