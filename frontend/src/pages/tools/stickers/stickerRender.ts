// stickerRender.ts — turns tools into printable / downloadable stickers.
//
// A sticker = QR (payload from buildToolSticker, readable by the Worker's scanner)
// + the tool name under it. Everything is generated locally, no network: works offline.
//   - stickersPrintHtml()  : A4 sheet(s) with a grid of stickers, for window.print()
//   - stickerToPng()       : one sticker as a PNG (300 dpi)
//   - stickersToZip()      : many PNGs in one .zip
import QRCode from 'qrcode';
import { zipSync } from 'fflate';
import { buildToolSticker } from '../../../entities/operationModel';

export interface StickerTool {
  id: string;
  name: string;
}

export type StickerSizeId = 'S' | 'M' | 'L';

/** Sticker width in mm (height depends on the name length, up to 3 lines). */
export const STICKER_SIZES: { id: StickerSizeId; label: string; widthMm: number }[] = [
  { id: 'S', label: 'Маленькая, 30 мм', widthMm: 30 },
  { id: 'M', label: 'Средняя, 40 мм', widthMm: 40 },
  { id: 'L', label: 'Крупная, 60 мм', widthMm: 60 },
];

const QUIET = 4; // quiet zone, in modules (QR spec)
const PAD_MM = 1;
const NAME_MAX_LINES = 3;
const FONT_RATIO = 0.085; // name font size relative to sticker width
const PX_PER_MM = 11.8; // ~300 dpi

/* ---------------------------------- QR ------------------------------------ */

function qrMatrix(text: string): { size: number; dark: (row: number, col: number) => boolean } {
  // M: ~15% of damage can be restored; stickers get scratched and dirty
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (r, c) => modules.get(r, c) === 1 };
}

/** QR as an inline SVG (with quiet zone), scales to the width of its container. */
export function qrSvg(text: string): string {
  const { size, dark } = qrMatrix(text);
  const total = size + QUIET * 2;
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; ) {
      if (!dark(r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end < size && dark(r, end)) end++;
      path += `M${c + QUIET} ${r + QUIET}h${end - c}v1h-${end - c}z`;
      c = end;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
  );
}

/* --------------------------------- Print ---------------------------------- */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Full HTML document: an A4 sheet(s) with stickers, with dashed cut lines. */
export function stickersPrintHtml(tools: StickerTool[], widthMm: number): string {
  const fontMm = (widthMm * FONT_RATIO).toFixed(2);
  const stickers = tools
    .map(
      (tool) =>
        `<div class="s">${qrSvg(buildToolSticker(tool))}<div class="n">${escapeHtml(tool.name)}</div></div>`,
    )
    .join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Наклейки</title><style>
@page { size: A4; margin: 10mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
.grid { display: flex; flex-wrap: wrap; gap: 2mm; }
.s { width: ${widthMm}mm; padding: ${PAD_MM}mm; border: 0.2mm dashed #888; text-align: center; break-inside: avoid; page-break-inside: avoid; }
.s svg { display: block; width: 100%; height: auto; }
.n { margin-top: 0.5mm; font-size: ${fontMm}mm; line-height: 1.15; font-weight: 600; word-break: break-word;
     display: -webkit-box; -webkit-line-clamp: ${NAME_MAX_LINES}; -webkit-box-orient: vertical; overflow: hidden; }
</style></head><body><div class="grid">${stickers}</div></body></html>`;
}

/**
 * Prints through a hidden iframe (the app itself is not replaced by the sheet).
 * Resolves when the print dialog was opened.
 */
export function printStickers(tools: StickerTool[], widthMm: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('print frame unavailable'));
        return;
      }
      win.addEventListener('afterprint', cleanup);
      try {
        win.focus();
        win.print();
        resolve();
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error('print failed'));
      }
    };
    iframe.srcdoc = stickersPrintHtml(tools, widthMm);
    document.body.appendChild(iframe);
  });
}

/* --------------------------------- Images --------------------------------- */

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const push = (l: string) => lines.push(l);
  for (const word of words) {
    // a single very long word: break it by characters
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
      if (line) {
        push(line);
        line = '';
      }
      push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    const candidate = line ? `${line} ${rest}` : rest;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      push(line);
      line = rest;
    }
  }
  if (line) push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/** One sticker as a PNG (white background, ~300 dpi). */
export function stickerToPng(tool: StickerTool, widthMm: number): Promise<Blob> {
  const width = Math.round(widthMm * PX_PER_MM);
  const pad = Math.round(PAD_MM * PX_PER_MM);
  const inner = width - pad * 2;

  const { size, dark } = qrMatrix(buildToolSticker(tool));
  const total = size + QUIET * 2;
  const module = Math.max(1, Math.floor(inner / total)); // whole pixels: sharp modules
  const qrPx = module * total;
  const qrX = Math.round((width - qrPx) / 2);

  const fontPx = Math.round(width * FONT_RATIO);
  const font = `600 ${fontPx}px Arial, Helvetica, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = font;
  const lines = wrapText(measure, tool.name, inner, NAME_MAX_LINES);
  const lineHeight = Math.round(fontPx * 1.15);
  const height = pad + qrPx + Math.round(pad / 2) + lines.length * lineHeight + pad;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (dark(r, c)) ctx.fillRect(qrX + (c + QUIET) * module, pad + (r + QUIET) * module, module, module);
    }
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) =>
    ctx.fillText(l, width / 2, pad + qrPx + Math.round(pad / 2) + i * lineHeight),
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
  );
}

/** "Дрель Bosch" + id -> "Дрель_Bosch_3f2a9c1d.png" (safe for all file systems, unique). */
export function stickerFileName(tool: StickerTool): string {
  const safe = [...tool.name]
    .filter((ch) => ch.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(ch))
    .join('')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return `${safe || 'tool'}_${tool.id.slice(0, 8)}.png`;
}

/** Many stickers -> one zip of PNGs. */
export async function stickersToZip(tools: StickerTool[], widthMm: number): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  for (const tool of tools) {
    const png = await stickerToPng(tool, widthMm);
    files[stickerFileName(tool)] = new Uint8Array(await png.arrayBuffer());
  }
  // PNG is already compressed: store, do not deflate again
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
