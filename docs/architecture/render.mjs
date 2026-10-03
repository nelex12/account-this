// Перерисовывает схемы *.mmd в images/*.png. Ширина картинки задаётся в пикселях (4K — 3840, 8K — 7680),
// масштаб подбирается по натуральной ширине схемы. Mermaid CLI скачивается через npx при первом запуске.
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const config = join(dir, 'mermaid-config.json');
const background = '#0d1117';

// Имя файла картинки → ширина в пикселях
const diagrams = {
    '1-context': { '1-context': 3840 },
    '2-containers': { '2-containers': 3840 },
    '3-components': { '3-components': 3840, '3-components-8k': 7680 },
    '4-detailed': { '4-detailed': 3840, '4-detailed-8k': 7680 },
};

const mmdc = (input, output, scale = 1) =>
    execSync(
        `npx -y @mermaid-js/mermaid-cli -q -i "${input}" -o "${output}" -c "${config}" -b "${background}" -s ${scale}`,
        { stdio: 'inherit' });

// Картинка может быть ненадолго занята просмотрщиком или антивирусом — повторяем копирование
function copyWithRetry(from, to, attempts = 10) {
    for (let attempt = 1; ; attempt++) {
        try {
            copyFileSync(from, to);
            return;
        } catch (error) {
            if (attempt === attempts) {
                throw new Error(`Не удалось записать ${to} — закройте его в просмотрщике`, { cause: error });
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        }
    }
}

const temp = mkdtempSync(join(tmpdir(), 'diagrams-'));
mkdirSync(join(dir, 'images'), { recursive: true });

try {
    for (const [source, outputs] of Object.entries(diagrams)) {
        const input = join(dir, `${source}.mmd`);

        // Натуральная ширина — из viewBox SVG
        const svg = join(temp, `${source}.svg`);
        mmdc(input, svg);
        const [, , width] = readFileSync(svg, 'utf8').match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);

        for (const [name, targetWidth] of Object.entries(outputs)) {
            const scale = (targetWidth / width).toFixed(3);
            const png = join(temp, `${name}.png`);
            mmdc(input, png, scale);
            copyWithRetry(png, join(dir, 'images', `${name}.png`));
            console.log(`${name}.png — ширина ${targetWidth}, масштаб ${scale}`);
        }
    }
} finally {
    rmSync(temp, { recursive: true, force: true });
}
